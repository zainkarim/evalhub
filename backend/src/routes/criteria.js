import { Router } from 'express';
import { query } from '../db/pool.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import { idParams, validate } from '../middleware/validate.js';
import { buildUpdate } from '../db/sql.js';
import { HttpError, notFound } from '../middleware/errors.js';


const router = Router();

const toCriterion = (row) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  weight: Number(row.weight),
  maxScore: row.max_score,
  sortOrder: row.sort_order,
  isActive: row.is_active,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const createBody = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  sortOrder: z.number().int().min(0).max(32767).optional(),
}).strict();

const updateBody = createBody.partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update',
  });

const COLUMNS = {
  name: 'name',
  description: 'description',
  sortOrder: 'sort_order',
};

// Criteria management follows the existing AC/admin convention.
router.use(requireRole(...AC_OR_ADMIN));

// GET /api/criteria?active=true
router.get('/', async (req, res) => {
  const active = req.query.active;

  if (active !== undefined && active !== 'true' && active !== 'false') {
    throw new HttpError(
      400,
      'validation_error',
      'active must be true or false',
    );
  }

  const { rows } = await query(
    `SELECT * FROM evaluation_criteria
     ${active === undefined ? '' : 'WHERE is_active = $1'}
     ORDER BY sort_order, id`,
    active === undefined ? [] : [active === 'true'],
  );

  res.json({ data: rows.map(toCriterion) });
});

// POST /api/criteria
router.post('/', validate(createBody), async (req, res) => {
  const body = req.valid.body;

  const { rows } = await query(
    `INSERT INTO evaluation_criteria
       (name, description, sort_order, updated_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      body.name,
      body.description ?? null,
      body.sortOrder ?? 0,
      req.user.id,
    ],
  );

  res.status(201).json(toCriterion(rows[0]));
});

// PATCH /api/criteria/:id
router.patch(
  '/:id',
  validate(idParams, 'params'),
  validate(updateBody),
  async (req, res) => {
    const { sets, values } = buildUpdate(req.valid.body, COLUMNS);

    values.push(req.user.id);
    sets.push(`updated_by = $${values.length}`);

    values.push(req.valid.params.id);

    const { rows } = await query(
      `UPDATE evaluation_criteria
       SET ${sets.join(', ')}
       WHERE id = $${values.length}
       RETURNING *`,
      values,
    );

    if (!rows[0]) throw notFound('Criterion');

    res.json(toCriterion(rows[0]));
  },
);

// DELETE /api/criteria/:id — deactivate the criterion
router.delete(
  '/:id',
  validate(idParams, 'params'),
  async (req, res) => {
    const { rows } = await query(
      `UPDATE evaluation_criteria
       SET is_active = FALSE, updated_by = $1
       WHERE id = $2
       RETURNING id`,
      [req.user.id, req.valid.params.id],
    );

    if (!rows[0]) throw notFound('Criterion');

    res.status(204).end();
  },
);

export default router;