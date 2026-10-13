import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { findTeacherConflict } from '../lib/availability.js';
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

// courseCode/sectionCode only appear when the query joined courses/course_sections
// in (course_subject, course_number, section_number aliases) — see the queries
// below. Bare numeric sectionId/teacherId were the "confusing IDs" the professor
// flagged; everywhere an assessment is shown to a person, it should carry a
// human-readable course+section identifier (e.g. "CS1337.001") alongside them.
const toAssessment = (r) => {
  const courseCode = r.course_subject && r.course_number
    ? `${r.course_subject}${r.course_number}`
    : null;
  return {
    id: r.id,
    teacherId: r.teacher_id,
    sectionId: r.section_id,
    courseCode,
    sectionCode: courseCode && r.section_number ? `${courseCode}.${r.section_number}` : null,
    dueTermId: r.due_term_id,
    status: r.status,
    signedUpAt: r.signed_up_at,
    completedAt: r.completed_at,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

// Joined onto `assessments AS a` wherever a human will read the result, so
// courseCode/sectionCode above can be populated.
const ASSESSMENT_COURSE_JOIN = `
  LEFT JOIN course_sections cs ON cs.id = a.section_id
  LEFT JOIN courses c ON c.id = cs.course_id
`;
const ASSESSMENT_COURSE_SELECT = `c.subject AS course_subject, c.course_number, cs.section_number`;

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

    // where[] references bare column names (teacher_id, due_term_id, status) with
    // no table prefix, which is fine against `assessments a` since none of those
    // names collide with the joined course_sections/courses columns.
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [{ rows }, { rows: count }] = await Promise.all([
      query(
        `SELECT a.*, ${ASSESSMENT_COURSE_SELECT}
           FROM assessments a ${ASSESSMENT_COURSE_JOIN} ${clause}
         ORDER BY signed_up_at DESC
         LIMIT $${params.length + 1}
         OFFSET $${params.length + 2}`,
        [...params, pageSize, (page - 1) * pageSize],
      ),
      query(
        `SELECT count(*)::int AS total
         FROM assessments a ${clause}`,
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
    `SELECT a.*, ${ASSESSMENT_COURSE_SELECT}
       FROM assessments a ${ASSESSMENT_COURSE_JOIN}
      WHERE a.teacher_id = $1 ORDER BY a.signed_up_at DESC`,
    [req.user.teacherId],
  );

  res.json({ data: rows.map(toAssessment) });
});

// GET /api/assessments/:id
router.get('/:id', validate(idParams, 'params'), async (req, res) => {
  const { rows } = await query(
    `SELECT a.*, ${ASSESSMENT_COURSE_SELECT}
       FROM assessments a ${ASSESSMENT_COURSE_JOIN}
      WHERE a.id = $1`,
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
  // Optional cross-check: if the caller also knows which course this section
  // is supposed to belong to (e.g. the UI resolved "CS1337.001" to a
  // sectionId but still has the courseId on hand), pass it and the server
  // will verify the two actually match before creating the assessment.
  // Catches the case the professor flagged: a bare numeric sectionId gives
  // no guarantee you signed up for the section you meant to (e.g. picking
  // CS1337.002 when you meant CS1337.001) unless something also checks the
  // course side of that relationship.
  courseId: z.number().int().positive().optional(),
  teacherId: z.number().int().positive().optional(),
});

// POST /api/assessments/sign-up
router.post('/sign-up', validate(signUpBody), async (req, res) => {
  const { sectionId, courseId: expectedCourseId, teacherId: requestedTeacherId } = req.valid.body;

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
        cs.course_id,
        cs.section_number,
        c.school,
        c.subject,
        c.course_number,
        c.course_level
       FROM course_sections cs
       JOIN courses c ON c.id = cs.course_id
      WHERE cs.id = $1`,
    [sectionId],
  );

  const section = sectionRows[0];

  if (!section) throw notFound('Section');

  const courseCode = `${section.subject}${section.course_number}`;

  // The actual "check course with section" fix: a wrong/stale courseId
  // (picked a different section than intended, e.g. .002 instead of .001
  // of the same course, or a totally different course) is rejected here
  // with the readable course code rather than silently signing up for the
  // wrong section.
  if (expectedCourseId !== undefined && expectedCourseId !== section.course_id) {
    throw new HttpError(
      409,
      'conflict',
      `That section belongs to ${courseCode}, not the course you specified`,
      { sectionId, actualCourseId: section.course_id, courseCode },
    );
  }

  if (section.instructor_id !== teacherId) {
    throw new HttpError(
      409,
      'conflict',
      `This teacher is not the instructor of ${courseCode}.${section.section_number}`,
      { courseCode, sectionCode: `${courseCode}.${section.section_number}` },
    );
  }

  let rows;
  try {
    ({ rows } = await query(
      `INSERT INTO assessments (teacher_id, section_id, due_term_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [teacherId, sectionId, section.term_id],
    ));
  } catch (err) {
    // 23505 on assessments_section_id_key = this exact section already has an
    // assessment. Previously surfaced as a bare constraint name; naming the
    // actual course+section here is the other half of the professor's
    // "confusing IDs" feedback -- the error itself was one of the opaque
    // numeric-ID responses he flagged.
    if (err.code === '23505' && err.constraint === 'assessments_section_id_key') {
      throw new HttpError(
        409,
        'conflict',
        `${courseCode}.${section.section_number} already has an observation assessment`,
        { sectionId, courseCode, sectionCode: `${courseCode}.${section.section_number}` },
      );
    }
    throw err;
  }

  res.status(201).json(toAssessment({
    ...rows[0],
    course_subject: section.subject,
    course_number: section.course_number,
    section_number: section.section_number,
  }));
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
          c.subject,
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
        section.subject,
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
          targetDepartment: section.subject,
          targetLevel: section.course_level,
        },
        poolSize: 0,
        listSize: 0,
        candidates: [],
        acStepIn: true,
      });

      return;
    }

    // 8. Save the generated candidate list.
    // NOTE: candidate_lists.target_school is a pre-10/13 column name kept
    // as-is to avoid another migration; as of the department-matching fix it
    // actually stores the department code (e.g. 'CS'), not a school code.
    // See migration 005_teacher_department.sql / eligible_observers.sql.
    const { rows: listRows } = await query(
      `INSERT INTO candidate_lists
        (assessment_id, target_level, target_school, pool_size, list_size, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        assessmentId,
        section.course_level,
        section.subject,
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
        targetDepartment: candidateList.target_school,
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
        `SELECT cs.teacher_id AS observee_id, c.subject, c.course_level
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
        section.subject,
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

// POST /api/assessments/:id/time-options   (the observee who owns this assessment, or AC/admin)
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected HH:MM (24h)');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const toTimeOption = (r) => ({
  id: r.id,
  assessmentId: r.assessment_id,
  proposedDate: r.proposed_date,
  startTime: r.start_time ? r.start_time.slice(0, 5) : null,
  endTime: r.end_time ? r.end_time.slice(0, 5) : null,
  // offeredToTeacherId is the pre-fix-#6 single-observer column, kept only
  // for any already-sent batches from before this migration -- new sends go
  // through time_option_offers instead (see the `offers` array below),
  // which supports more than one observer per option.
  offeredToTeacherId: r.offered_to_teacher_id,
  confirmedTeacherId: r.confirmed_teacher_id,
  isConfirmed: r.is_confirmed,
  offers: r.offers ?? undefined,
});

// Only truly terminal states block new date proposals. 'postponed' is
// deliberately NOT in this list -- requirements.md section 4.3 step 8 says a
// postponed sign-up should be rescheduled within the same semester where
// possible, which means proposing fresh dates on it is the normal path,
// not an error case.
const TIME_OPTIONS_BLOCKED_STATUSES = ['completed', 'cancelled', 'not_eligible'];

const addOptionsBody = z.object({
  options: z.array(z.object({
    proposedDate: isoDate,
    startTime: hhmm,
    endTime: hhmm,
  })).min(1).max(8),
});

router.post(
  '/:id/time-options',
  validate(idParams, 'params'),
  validate(addOptionsBody),
  async (req, res) => {
    const assessmentId = req.valid.params.id;

    const { rows: assessmentRows } = await query(
      'SELECT * FROM assessments WHERE id = $1',
      [assessmentId],
    );

    if (!assessmentRows[0]) throw notFound('Assessment');

    const assessment = assessmentRows[0];

    if (TIME_OPTIONS_BLOCKED_STATUSES.includes(assessment.status)) {
      throw new HttpError(409, 'conflict', 'This assessment is no longer open for scheduling');
    }

    const isOwner = req.user.teacherId === assessment.teacher_id;

    if (!isOwner && !AC_OR_ADMIN.includes(req.user.role)) {
      throw new HttpError(
        403,
        'forbidden',
        'Only the observee (or AC/admin) can propose dates for this assessment',
      );
    }

    // Fix #4 (professor feedback 10/13): proposed dates must reflect when the
    // observee is actually free, not be arbitrary/typed-in dates. Reject the
    // whole batch (rather than silently dropping some) if any proposed slot
    // conflicts with the observee's own teaching schedule or an existing
    // confirmed observation -- the caller picks different times and resubmits.
    for (const opt of req.valid.body.options) {
      const conflict = await findTeacherConflict(assessment.teacher_id, opt.proposedDate, opt.startTime, opt.endTime);
      if (conflict) {
        throw new HttpError(
          409,
          'conflict',
          `Proposed slot ${opt.proposedDate} ${opt.startTime}-${opt.endTime} conflicts with the observee's own schedule: ${conflict.detail}`,
          { proposedDate: opt.proposedDate, startTime: opt.startTime, endTime: opt.endTime, reason: conflict.reason },
        );
      }
    }

    const inserted = [];

    for (const opt of req.valid.body.options) {
      const { rows } = await query(
        `INSERT INTO assessment_time_options (assessment_id, proposed_date, start_time, end_time)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [assessmentId, opt.proposedDate, opt.startTime, opt.endTime],
      );

      inserted.push(rows[0]);
    }

    res.status(201).json({ data: inserted.map(toTimeOption) });
  },
);

// GET /api/assessments/:id/time-options   (owner, the offered observer, or AC/admin)
router.get('/:id/time-options', validate(idParams, 'params'), async (req, res) => {
  const assessmentId = req.valid.params.id;

  const { rows: assessmentRows } = await query(
    'SELECT * FROM assessments WHERE id = $1',
    [assessmentId],
  );

  if (!assessmentRows[0]) throw notFound('Assessment');

  const { rows } = await query(
    `SELECT ato.*,
            COALESCE(
              (SELECT json_agg(json_build_object('id', o.id, 'optionId', o.option_id, 'teacherId', o.teacher_id, 'status', o.status) ORDER BY o.id)
                 FROM time_option_offers o WHERE o.option_id = ato.id),
              '[]'
            ) AS offers
       FROM assessment_time_options ato
      WHERE ato.assessment_id = $1
      ORDER BY ato.proposed_date, ato.start_time`,
    [assessmentId],
  );

  const isOwner = req.user.teacherId === assessmentRows[0].teacher_id;
  const isOfferedObserver = rows.some((r) =>
    r.offered_to_teacher_id === req.user.teacherId
    || r.offers.some((o) => o.teacherId === req.user.teacherId));

  if (!isOwner && !isOfferedObserver && !AC_OR_ADMIN.includes(req.user.role)) {
    throw new HttpError(
      403,
      'forbidden',
      'You do not have permission to view these time options',
    );
  }

  res.json({ data: rows.map(toTimeOption) });
});

// Fix #6 (professor feedback 10/13): flipped from "send every open date to
// ONE observer" to "send to several candidates at once" -- accepts either
// teacherIds (plural, the new multi-observer flow) or the old single
// teacherId for backward compatibility with any existing callers/scripts.
const sendRequestBody = z.object({
  teacherId: z.number().int().positive().optional(),
  teacherIds: z.array(z.number().int().positive()).min(1).max(10).optional(),
}).refine((b) => b.teacherId !== undefined || b.teacherIds !== undefined, {
  message: 'Provide teacherId or teacherIds',
});

// POST /api/assessments/:id/time-options/send   (owner, or AC/admin)
// Sends the observee's open (unconfirmed) date options to one or more
// observer candidates. Each candidate only gets offered the slots they are
// actually free for (fix #4's availability check) -- a candidate busy for
// every proposed slot is simply skipped, not an error, since the other
// candidates in the batch may still be fine.
router.post(
  '/:id/time-options/send',
  validate(idParams, 'params'),
  validate(sendRequestBody),
  async (req, res) => {
    const assessmentId = req.valid.params.id;
    const teacherIds = [...new Set(req.valid.body.teacherIds ?? [req.valid.body.teacherId])];

    const { rows: assessmentRows } = await query(
      'SELECT * FROM assessments WHERE id = $1',
      [assessmentId],
    );

    if (!assessmentRows[0]) throw notFound('Assessment');

    const assessment = assessmentRows[0];

    if (TIME_OPTIONS_BLOCKED_STATUSES.includes(assessment.status)) {
      throw new HttpError(409, 'conflict', 'This assessment is no longer open for scheduling');
    }

    const isOwner = req.user.teacherId === assessment.teacher_id;

    if (!isOwner && !AC_OR_ADMIN.includes(req.user.role)) {
      throw new HttpError(
        403,
        'forbidden',
        'Only the observee (or AC/admin) can send this request',
      );
    }

    if (teacherIds.includes(assessment.teacher_id)) {
      throw new HttpError(400, 'validation_error', 'An observee cannot be offered as their own observer');
    }

    const { rows: openOptions } = await query(
      `SELECT * FROM assessment_time_options WHERE assessment_id = $1 AND NOT is_confirmed`,
      [assessmentId],
    );

    if (!openOptions.length) {
      throw new HttpError(400, 'validation_error', 'No open date options to send -- add some first');
    }

    // Fix #3/#4 (professor feedback 10/13): the candidate pool check at
    // generation time can't know whether an observer is free, because no
    // dates exist yet -- that has to happen here, once real dates do.
    const results = [];
    for (const teacherId of teacherIds) {
      const freeOptionIds = [];
      for (const opt of openOptions) {
        const conflict = await findTeacherConflict(
          teacherId,
          opt.proposed_date,
          opt.start_time.slice(0, 5),
          opt.end_time.slice(0, 5),
        );
        if (!conflict) freeOptionIds.push(opt.id);
      }

      if (!freeOptionIds.length) {
        results.push({ teacherId, offered: 0, reason: 'not free for any proposed slot' });
        continue;
      }

      const { rows: offerRows } = await query(
        `INSERT INTO time_option_offers (option_id, teacher_id, status)
           SELECT id, $2, 'pending' FROM unnest($1::int[]) AS id
         ON CONFLICT (option_id, teacher_id)
           DO UPDATE SET status = 'pending', updated_at = now()
         RETURNING *`,
        [freeOptionIds, teacherId],
      );

      results.push({ teacherId, offered: offerRows.length });
    }

    const sentToAny = results.some((r) => r.offered > 0);
    if (!sentToAny) {
      throw new HttpError(
        409,
        'conflict',
        'None of the given observers are free at any of the proposed times -- propose different dates or choose other observers',
        { results },
      );
    }

    res.json({ results });
  },
);

// POST /api/time-options/offers/:id/respond (an observer accepting/declining
// a date) is mounted from timeOptions.js under /api/time-options -- this
// file only owns the pieces that are nested under a specific assessment.

// POST /api/assessments/:id/time-options/:optionId/finalize   (owner, or AC/admin)
// Fix #6's actual "flip": the OBSERVEE now makes the final call, picking one
// accepted offer (a specific observer, for a specific already-proposed
// date/time) out of however many came back, rather than whichever observer
// confirms first/only winning by default. Re-checks both sides' availability
// defensively, same as timeOptions.js's /:id/confirm, since time may have
// passed since the offer was accepted.
router.post(
  '/:id/time-options/:optionId/finalize',
  validate(z.object({ id: z.coerce.number().int().positive(), optionId: z.coerce.number().int().positive() }), 'params'),
  validate(z.object({ teacherId: z.number().int().positive() })),
  async (req, res) => {
    const assessmentId = req.valid.params.id;
    const optionId = req.valid.params.optionId;
    const { teacherId } = req.valid.body;

    const { rows: assessmentRows } = await query('SELECT * FROM assessments WHERE id = $1', [assessmentId]);
    if (!assessmentRows[0]) throw notFound('Assessment');
    const assessment = assessmentRows[0];

    const isOwner = req.user.teacherId === assessment.teacher_id;
    if (!isOwner && !AC_OR_ADMIN.includes(req.user.role)) {
      throw new HttpError(403, 'forbidden', 'Only the observee (or AC/admin) can finalize a date');
    }

    const { rows: optionRows } = await query(
      'SELECT * FROM assessment_time_options WHERE id = $1 AND assessment_id = $2',
      [optionId, assessmentId],
    );
    const option = optionRows[0];
    if (!option) throw notFound('Time option');
    if (option.is_confirmed) throw new HttpError(409, 'conflict', 'This assessment already has a confirmed date');

    const { rows: offerRows } = await query(
      `SELECT * FROM time_option_offers WHERE option_id = $1 AND teacher_id = $2`,
      [optionId, teacherId],
    );
    const offer = offerRows[0];
    if (!offer || offer.status !== 'accepted') {
      throw new HttpError(409, 'conflict', 'That observer has not accepted this date/time');
    }

    const proposedDate = option.proposed_date;
    const startTime = option.start_time.slice(0, 5);
    const endTime = option.end_time.slice(0, 5);

    // No double-booking: neither the chosen observer nor the observee
    // themselves can already be committed elsewhere at this slot.
    const observerConflict = await findTeacherConflict(teacherId, proposedDate, startTime, endTime);
    if (observerConflict) {
      throw new HttpError(409, 'conflict', `The observer is no longer free at that time: ${observerConflict.detail}`);
    }
    const observeeConflict = await findTeacherConflict(assessment.teacher_id, proposedDate, startTime, endTime);
    if (observeeConflict) {
      throw new HttpError(409, 'conflict', `You are no longer free at that time: ${observeeConflict.detail}`);
    }

    const { rows: confirmed } = await query(
      `UPDATE assessment_time_options
          SET is_confirmed = TRUE, confirmed_teacher_id = $2
        WHERE id = $1
        RETURNING *`,
      [optionId, teacherId],
    );

    // Every other offer on every other (still-open) option for this
    // assessment is now moot -- decline them so a stale "accept" elsewhere
    // can't be finalized into a second, conflicting confirmation.
    await query(
      `UPDATE time_option_offers
          SET status = 'declined', updated_at = now()
        WHERE option_id IN (SELECT id FROM assessment_time_options WHERE assessment_id = $1 AND id <> $2)
          AND status <> 'declined'`,
      [assessmentId, optionId],
    );

    res.json(toTimeOption(confirmed[0]));
  },
);

export default router;