import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { idParams, pagination, paged, validate } from '../middleware/validate.js';

const router = Router();

const eligibleObserversSql = readFileSync(
  new URL('../../db/queries/eligible_observers.sql', import.meta.url),
  'utf8',
);

const STATUSES = [
  'signed_up',
  'candidates_generated',
  'pending_ac_approval', // Legacy records only; new selections skip AC review.
  'approved',
  'completed',
  'not_eligible',
  'postponed',
  'cancelled',
];

const toAssessment = (r) => ({
  id: r.id,
  teacherId: r.teacher_id,
  sectionId: r.section_id,
  dueTermId: r.due_term_id,
  status: r.status,
  signedUpAt: r.signed_up_at,
  completedAt: r.completed_at,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const listQuery = z.object({
  teacherId: z.coerce.number().int().positive().optional(),
  termId: z.coerce.number().int().positive().optional(),
  status: z.enum(STATUSES).optional(),
  ...pagination,
});

// GET /api/assessments?teacherId=&termId=&status=&page=&pageSize=   (AC / admin)
router.get(
  '/',
  requireRole(...AC_OR_ADMIN),
  validate(listQuery, 'query'),
  async (req, res) => {
    const { teacherId, termId, status, page, pageSize } = req.valid.query;
    const where = [];
    const params = [];

    const add = (sql, value) => {
      params.push(value);
      where.push(sql.replaceAll('?', `$${params.length}`));
    };

    if (teacherId) add('teacher_id = ?', teacherId);
    if (termId) add('due_term_id = ?', termId);
    if (status) add('status = ?', status);

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [{ rows }, { rows: count }] = await Promise.all([
      query(
        `SELECT * FROM assessments ${clause}
         ORDER BY signed_up_at DESC
         LIMIT $${params.length + 1}
         OFFSET $${params.length + 2}`,
        [...params, pageSize, (page - 1) * pageSize],
      ),
      query(
        `SELECT count(*)::int AS total
         FROM assessments ${clause}`,
        params,
      ),
    ]);

    res.json(paged(rows.map(toAssessment), count[0].total, page, pageSize));
  },
);

// GET /api/assessments/mine   (faculty)
router.get('/mine', async (req, res) => {
  if (!req.user.teacherId) {
    throw new HttpError(
      403,
      'forbidden',
      'This account is not linked to a teacher profile',
    );
  }

  const { rows } = await query(
    'SELECT * FROM assessments WHERE teacher_id = $1 ORDER BY signed_up_at DESC',
    [req.user.teacherId],
  );

  res.json({ data: rows.map(toAssessment) });
});

// GET /api/assessments/:id
router.get('/:id', validate(idParams, 'params'), async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM assessments WHERE id = $1',
    [req.valid.params.id],
  );

  if (!rows[0]) throw notFound('Assessment');

  const isOwner = req.user.teacherId === rows[0].teacher_id;

  if (!isOwner && !AC_OR_ADMIN.includes(req.user.role)) {
    throw new HttpError(
      403,
      'forbidden',
      'You do not have permission to do that',
    );
  }

  res.json(toAssessment(rows[0]));
});

const signUpBody = z.object({
  sectionId: z.number().int().positive(),
  teacherId: z.number().int().positive().optional(),
});

// POST /api/assessments/sign-up
router.post('/sign-up', validate(signUpBody), async (req, res) => {
  const { sectionId, teacherId: requestedTeacherId } = req.valid.body;

  let teacherId = req.user.teacherId;

  if (requestedTeacherId && requestedTeacherId !== teacherId) {
    if (!AC_OR_ADMIN.includes(req.user.role)) {
      throw new HttpError(
        403,
        'forbidden',
        'Only AC/admin can sign up on behalf of another teacher',
      );
    }

    teacherId = requestedTeacherId;
  }

  if (!teacherId) {
    throw new HttpError(
      400,
      'validation_error',
      'No teacher specified and this account has no linked teacher profile',
    );
  }

  const { rows: sectionRows } = await query(
    `SELECT
        cs.id,
        cs.term_id,
        cs.teacher_id AS instructor_id,
        c.school,
        c.course_level
       FROM course_sections cs
       JOIN courses c ON c.id = cs.course_id
      WHERE cs.id = $1`,
    [sectionId],
  );

  const section = sectionRows[0];

  if (!section) throw notFound('Section');

  if (section.instructor_id !== teacherId) {
    throw new HttpError(
      409,
      'conflict',
      'This teacher is not the instructor of that section',
    );
  }

  const { rows } = await query(
    `INSERT INTO assessments (teacher_id, section_id, due_term_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [teacherId, sectionId, section.term_id],
  );

  res.status(201).json(toAssessment(rows[0]));
});

const cancelBody = z.object({
  reason: z.enum(['not_eligible', 'left_department', 'other']).optional(),
  notes: z.string().trim().max(2000).optional(),
});

// POST /api/assessments/:id/cancel
router.post(
  '/:id/cancel',
  requireRole(...AC_OR_ADMIN),
  validate(idParams, 'params'),
  validate(cancelBody),
  async (req, res) => {
    const { reason, notes } = req.valid.body;

    const { rows } = await query(
      `UPDATE assessments
          SET status = 'cancelled',
              notes = COALESCE($2, notes)
        WHERE id = $1
          AND status NOT IN ('completed', 'cancelled')
        RETURNING *`,
      [
        req.valid.params.id,
        reason ? `[${reason}] ${notes ?? ''}`.trim() : notes ?? null,
      ],
    );

    if (!rows[0]) throw notFound('Cancellable assessment');

    res.json(toAssessment(rows[0]));
  },
);

// POST /api/assessments/:id/candidates
router.post(
  '/:id/candidates',
  validate(idParams, 'params'),
  async (req, res) => {
    const assessmentId = req.valid.params.id;

    // 1. Find the assessment
    const { rows: assessmentRows } = await query(
      'SELECT * FROM assessments WHERE id = $1',
      [assessmentId],
    );

    if (!assessmentRows[0]) throw notFound('Assessment');

    const assessment = assessmentRows[0];

    if (['approved', 'completed', 'not_eligible', 'postponed', 'cancelled', 'pending_ac_approval'].includes(assessment.status)) {
      throw new HttpError(409, 'conflict', 'This assessment is not open for observer selection');
    }

    // 2. Only the owner or AC/admin may generate candidates
    const isOwner = req.user.teacherId === assessment.teacher_id;

    if (!isOwner && !AC_OR_ADMIN.includes(req.user.role)) {
      throw new HttpError(
        403,
        'forbidden',
        'You do not have permission to generate candidates for this assessment',
      );
    }

    // 3. Get the section + course information
    const { rows: sectionRows } = await query(
      `SELECT
          cs.id,
          cs.teacher_id AS observee_id,
          c.school,
          c.course_level
         FROM course_sections cs
         JOIN courses c ON c.id = cs.course_id
        WHERE cs.id = $1`,
      [assessment.section_id],
    );

    if (!sectionRows[0]) throw notFound('Section');

    const section = sectionRows[0];

    // 4. Get configurable matching settings
    const { rows: settingRows } = await query(
      `SELECT key, value
         FROM app_settings
        WHERE key IN ('candidate_list_size', 'observer_lookback_years')`,
    );

    const candidateListSetting = settingRows.find(
      (row) => row.key === 'candidate_list_size',
    );

    const lookbackSetting = settingRows.find(
      (row) => row.key === 'observer_lookback_years',
    );

    const listSize = Number(candidateListSetting?.value ?? 5);
    const lookbackYears = Number(lookbackSetting?.value ?? 2);

    // 5. Run the matching query
    const { rows: candidates } = await query(
      eligibleObserversSql,
      [
        section.observee_id,
        section.school,
        section.course_level,
        new Date().toISOString().slice(0, 10),
        listSize,
        lookbackYears,
      ],
    );

    // 6. Determine total eligible pool
    const poolSize = candidates.length > 0
      ? Number(candidates[0].pool_size)
      : 0;

    // 7. If nobody qualifies, do not create a candidate list.
    if (poolSize === 0) {
      res.json({
        assessment: toAssessment(assessment),
        matchingInputs: {
          observeeId: section.observee_id,
          targetSchool: section.school,
          targetLevel: section.course_level,
        },
        poolSize: 0,
        listSize: 0,
        candidates: [],
        acStepIn: true,
      });

      return;
    }

    // 8. Save the generated candidate list
    const { rows: listRows } = await query(
      `INSERT INTO candidate_lists
        (assessment_id, target_level, target_school, pool_size, list_size, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        assessmentId,
        section.course_level,
        section.school,
        poolSize,
        candidates.length,
        req.user.id,
      ],
    );

    const candidateList = listRows[0];

    // 9. Save each candidate in the generated list
    for (let i = 0; i < candidates.length; i += 1) {
      await query(
        `INSERT INTO observer_candidates
          (list_id, teacher_id, position)
         VALUES ($1, $2, $3)`,
        [
          candidateList.id,
          candidates[i].id,
          i + 1,
        ],
      );
    }

    // 10. Mark the assessment as having candidates
    const { rows: updatedAssessmentRows } = await query(
      `UPDATE assessments
          SET status = 'candidates_generated'
        WHERE id = $1
        RETURNING *`,
      [assessmentId],
    );

    const updatedAssessment = updatedAssessmentRows[0];

    // 11. Return the generated list
    res.json({
      assessment: toAssessment(updatedAssessment),
      candidateList: {
        id: candidateList.id,
        targetSchool: candidateList.target_school,
        targetLevel: candidateList.target_level,
        poolSize: candidateList.pool_size,
        listSize: candidateList.list_size,
      },
      candidates: candidates.map((candidate, index) => ({
        id: candidate.id,
        firstName: candidate.first_name,
        lastName: candidate.last_name,
        email: candidate.email,
        position: index + 1,
      })),
    });
  },
);

const observationBody = z.object({
  observerId: z.number().int().positive(),
  candidateListId: z.number().int().positive().optional(),
});

// POST /api/assessments/:id/observations
router.post(
  '/:id/observations',
  validate(idParams, 'params'),
  validate(observationBody),
  async (req, res) => {
    const assessmentId = req.valid.params.id;
    const { observerId, candidateListId } = req.valid.body;

    // 1. Find the assessment
    const { rows: assessmentRows } = await query(
      'SELECT * FROM assessments WHERE id = $1',
      [assessmentId],
    );

    if (!assessmentRows[0]) throw notFound('Assessment');

    const assessment = assessmentRows[0];

    if (['approved', 'completed', 'not_eligible', 'postponed', 'cancelled', 'pending_ac_approval'].includes(assessment.status)) {
      throw new HttpError(409, 'conflict', 'This assessment is not open for observer selection');
    }

    // 2. Only the owner or AC/admin may choose an observer
    const isOwner = req.user.teacherId === assessment.teacher_id;

    if (!isOwner && !AC_OR_ADMIN.includes(req.user.role)) {
      throw new HttpError(
        403,
        'forbidden',
        'You do not have permission to select an observer for this assessment',
      );
    }

    // 3. Normal flow: candidateListId must be supplied and observer
    //    must actually belong to that candidate list.
    if (candidateListId) {
      const { rows: candidateRows } = await query(
        `SELECT oc.teacher_id
           FROM observer_candidates oc
           JOIN candidate_lists cl ON cl.id = oc.list_id
          WHERE cl.id = $1
            AND cl.assessment_id = $2
            AND oc.teacher_id = $3`,
        [candidateListId, assessmentId, observerId],
      );

      if (!candidateRows[0]) {
        throw new HttpError(
          409,
          'conflict',
          'The selected observer is not on the candidate list for this assessment',
        );
      }
    } else {
      // AC/admin may override matching only when the current eligible pool is empty.
      if (!AC_OR_ADMIN.includes(req.user.role)) {
        throw new HttpError(
          403,
          'forbidden',
          'A candidate list is required unless an AC/admin is stepping in',
        );
      }

      const { rows: sectionRows } = await query(
        `SELECT cs.teacher_id AS observee_id, c.school, c.course_level
           FROM course_sections cs
           JOIN courses c ON c.id = cs.course_id
          WHERE cs.id = $1`,
        [assessment.section_id],
      );

      if (!sectionRows[0]) throw notFound('Section');

      const section = sectionRows[0];

      const { rows: settings } = await query(
        "SELECT value FROM app_settings WHERE key = 'observer_lookback_years'",
      );

      const lookbackYears = Number(settings[0]?.value ?? 2);

      if (!Number.isFinite(lookbackYears) || lookbackYears < 0) {
        throw new HttpError(
          500,
          'configuration_error',
          'Invalid observer lookback setting',
        );
      }

      // A limit of one is sufficient to establish whether anybody qualifies.
      const { rows: eligible } = await query(eligibleObserversSql, [
        section.observee_id,
        section.school,
        section.course_level,
        new Date().toISOString().slice(0, 10),
        1,
        lookbackYears,
      ]);

      if (eligible.length > 0) {
        throw new HttpError(
          409,
          'conflict',
          'AC override is only allowed when there are no eligible observers',
        );
      }
    }

    if (observerId === assessment.teacher_id) {
      throw new HttpError(
        409,
        'conflict',
        'A teacher cannot observe themselves',
      );
    }

    const { rows: observerRows } = await query(
      'SELECT id, is_active FROM teachers WHERE id = $1',
      [observerId],
    );

    if (!observerRows[0]) throw notFound('Observer');

    if (!observerRows[0].is_active) {
      throw new HttpError(
        409,
        'conflict',
        'The selected observer is inactive',
      );
    }

    // 4. Determine the next attempt number
    const { rows: attemptRows } = await query(
      `SELECT COALESCE(MAX(attempt_no), 0) + 1 AS next_attempt
         FROM observations
        WHERE assessment_id = $1`,
      [assessmentId],
    );

    const attemptNo = Number(attemptRows[0].next_attempt);

    // 5. Create the observation
    const { rows: observationRows } = await query(
      `INSERT INTO observations
        (
          assessment_id,
          observee_id,
          observer_id,
          attempt_no,
          source_list_id,
          is_ac_stepin,
          status
        )
       VALUES ($1, $2, $3, $4, $5, $6, 'approved')
       RETURNING *`,
      [
        assessmentId,
        assessment.teacher_id,
        observerId,
        attemptNo,
        candidateListId ?? null,
        candidateListId ? false : true,
      ],
    );

    const observation = observationRows[0];

    // 6. Ready to proceed immediately; 'approved' is the existing DB status.
    // No AC review occurs. Rename this status when the SQL schema is updated.
    const { rows: updatedAssessmentRows } = await query(
      `UPDATE assessments
          SET status = 'approved'
        WHERE id = $1
        RETURNING *`,
      [assessmentId],
    );

    res.status(201).json({
      observation: {
        id: observation.id,
        assessmentId: observation.assessment_id,
        observeeId: observation.observee_id,
        observerId: observation.observer_id,
        attemptNo: observation.attempt_no,
        sourceListId: observation.source_list_id,
        isAcStepin: observation.is_ac_stepin,
        status: observation.status,
      },
      assessment: toAssessment(updatedAssessmentRows[0]),
    });
  },
);

export default router;