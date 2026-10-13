// evaluation_criteria CRUD. Not one of the numbered tickets (#21-23), but
// #23 ("API: submit + view questionnaire responses") explicitly lists
// "criteria CRUD" as a dependency, and nothing in the codebase provided it
// before this file -- the table has existed since migration 002, but there
// was no way to actually create or manage the AC-configurable questions it
// stores (clarity, engagement, preparedness, etc. -- see that migration's
// comment). Built now so #23 has something real to depend on.
import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { buildUpdate } from '../db/sql.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { HttpError, notFound } from '../middleware/errors.js';
import { idParams, validate } from '../middleware/validate.js';

const router = Router();

const toCriterion = (r) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  weight: Number(r.weight),
  maxScore: r.max_score,
  sortOrder: r.sort_order,
  isActive: r.is_active,
  updatedBy: r.updated_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const criterionFields = {
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  weight: z.number().min(0).optional(),
  maxScore: z.number().int().positive().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
};
const createBody = z.object(criterionFields);
const updateBody = z.object(criterionFields).partial()
  .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' });

const COLUMNS = {
  name: 'name',
  description: 'description',
  weight: 'weight',
  maxScore: 'max_score',
  sortOrder: 'sort_order',
  isActive: 'is_active',
};

const listQuery = z.object({
  includeInactive: z.enum(['true', 'false']).optional(),
});

// GET /api/criteria?includeInactive=   (any authenticated user -- an
// observer needs to see the active questions to answer #23's questionnaire)
router.get('/', validate(listQuery, 'query'), async (req, res) => {
  const includeInactive = req.valid.query.includeInactive === 'true';
  const { rows } = await query(
    `SELECT * FROM evaluation_criteria ${includeInactive ? '' : 'WHERE is_active'} ORDER BY sort_order, id`,
  );
  res.json({ data: rows.map(toCriterion) });
});

// GET /api/criteria/:id
router.get('/:id', validate(idParams, 'params'), async (req, res) => {
  const { rows } = await query('SELECT * FROM evaluation_criteria WHERE id = $1', [req.valid.params.id]);
  if (!rows[0]) throw notFound('Criterion');
  res.json(toCriterion(rows[0]));
});

// POST /api/criteria   (AC / admin -- "AC-configurable criteria", migration 002's own wording)
router.post('/', requireRole(...AC_OR_ADMIN), validate(createBody), async (req, res) => {
  const b = req.valid.body;
  const { rows } = await query(
    `INSERT INTO evaluation_criteria (name, description, weight, max_score, sort_order, is_active, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      b.name,
      b.description ?? null,
      b.weight ?? 1,
      b.maxScore ?? 5,
      b.sortOrder ?? 0,
      b.isActive ?? true,
      req.user.id,
    ],
  );
  res.status(201).json(toCriterion(rows[0]));
});

// PATCH /api/criteria/:id   (AC / admin)
// Editing is allowed (e.g. fixing a typo, retiring a question via
// isActive:false) -- what's NOT allowed is an *observer* changing a
// question after answering it, which #23 enforces on its own side by never
// exposing an edit path on observation_responses. This endpoint only
// touches the question definitions themselves.
router.patch('/:id', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), validate(updateBody), async (req, res) => {
  const { sets, values } = buildUpdate(req.valid.body, COLUMNS, 1);
  const { rows } = await query(
    `UPDATE evaluation_criteria SET ${sets.join(', ')}, updated_by = $${values.length + 1}
      WHERE id = $${values.length + 2}
     RETURNING *`,
    [...values, req.user.id, req.valid.params.id],
  );
  if (!rows[0]) throw notFound('Criterion');
  res.json(toCriterion(rows[0]));
});

// DELETE /api/criteria/:id   (AC / admin) -- blocked by the DB (23503 ->
// 409 via errorHandler) once any observation has actually answered this
// criterion (observation_responses.criterion_id ON DELETE RESTRICT,
// migration 008). Deactivate it instead (PATCH isActive:false) once it's
// been used; delete is only really for a question created by mistake.
router.delete('/:id', requireRole(...AC_OR_ADMIN), validate(idParams, 'params'), async (req, res) => {
  const { rowCount } = await query('DELETE FROM evaluation_criteria WHERE id = $1', [req.valid.params.id]);
  if (!rowCount) throw notFound('Criterion');
  res.status(204).end();
});

export default router;
