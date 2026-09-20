import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { AC_OR_ADMIN, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const toTerm = (r) => ({
  id: r.id,
  season: r.season,
  year: r.year,
  startDate: r.start_date,
  endDate: r.end_date,
  isLongTerm: r.is_long_term,
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const termBody = z.object({
  season: z.enum(['spring', 'summer', 'fall']),
  year: z.number().int().min(2000).max(2100),
  startDate: isoDate,
  endDate: isoDate,
}).refine((t) => t.endDate > t.startDate, { message: 'endDate must be after startDate', path: ['endDate'] });

// GET /api/terms  (any authenticated user) — newest first
router.get('/', async (req, res) => {
  const { rows } = await query('SELECT * FROM terms ORDER BY start_date DESC');
  res.json({ data: rows.map(toTerm) });
});

// POST /api/terms  (AC / admin)
router.post('/', requireRole(...AC_OR_ADMIN), validate(termBody), async (req, res) => {
  const { season, year, startDate, endDate } = req.valid.body;
  const { rows } = await query(
    'INSERT INTO terms (season, year, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING *',
    [season, year, startDate, endDate],
  );
  res.status(201).json(toTerm(rows[0]));
});

export default router;
