import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AC_OR_ADMIN } from '../middleware/auth.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { idParams, validate } from '../middleware/validate.js';

const router = Router();

const reviewBody = z.object({
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().trim().max(2000).optional(),
});

// POST /api/observations/:id/review
router.post(
  '/:id/review',
  validate(idParams, 'params'),
  validate(reviewBody),
  async (req, res) => {
    if (!AC_OR_ADMIN.includes(req.user.role)) {
      throw new HttpError(
        403,
        'forbidden',
        'Only AC/admin can review observations',
      );
    }

    const observationId = req.valid.params.id;
    const { decision, notes } = req.valid.body;

    // 1. Find the observation
    const { rows: observationRows } = await query(
      'SELECT * FROM observations WHERE id = $1',
      [observationId],
    );

    if (!observationRows[0]) throw notFound('Observation');

    const observation = observationRows[0];

    // 2. Only proposed observations can be reviewed
    if (observation.status !== 'proposed') {
      throw new HttpError(
        409,
        'conflict',
        'Only proposed observations can be reviewed',
      );
    }

    // 3. Update the observation
    const { rows: updatedRows } = await query(
      `UPDATE observations
          SET status = $2,
              ac_reviewed_by = $3,
              ac_reviewed_at = now(),
              ac_notes = $4
        WHERE id = $1
        RETURNING *`,
      [
        observationId,
        decision,
        req.user.id,
        notes ?? null,
      ],
    );

    // 4. Update the parent assessment
    const newAssessmentStatus =
      decision === 'approved'
        ? 'approved'
        : 'candidates_generated';

    await query(
      `UPDATE assessments
          SET status = $2
        WHERE id = $1`,
      [observation.assessment_id, newAssessmentStatus],
    );

    res.json({
      observation: {
        id: updatedRows[0].id,
        assessmentId: updatedRows[0].assessment_id,
        observeeId: updatedRows[0].observee_id,
        observerId: updatedRows[0].observer_id,
        attemptNo: updatedRows[0].attempt_no,
        sourceListId: updatedRows[0].source_list_id,
        isAcStepin: updatedRows[0].is_ac_stepin,
        status: updatedRows[0].status,
        acReviewedBy: updatedRows[0].ac_reviewed_by,
        acReviewedAt: updatedRows[0].ac_reviewed_at,
        acNotes: updatedRows[0].ac_notes,
      },
      assessment: {
        id: observation.assessment_id,
        status: newAssessmentStatus,
      },
    });
  },
);

export default router;