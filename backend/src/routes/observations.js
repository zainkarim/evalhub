import { Router } from 'express';
import { HttpError } from '../middleware/errors.js';
import { idParams, validate } from '../middleware/validate.js';

const router = Router();

// Retired endpoint: selecting an observer no longer requires AC approval.
// Keep an explicit response so old clients cannot silently use the old workflow.
router.post('/:id/review', validate(idParams, 'params'), async () => {
  throw new HttpError(
    410,
    'ac_review_removed',
    'AC approval is no longer part of the observation workflow. Select an eligible observer, or use AC override when no eligible observers exist.',
  );
});

export default router;