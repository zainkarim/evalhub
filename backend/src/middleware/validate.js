import { z } from 'zod';

/**
 * Validate req[source] and expose the parsed result on req.valid[source].
 * (Express 5 makes req.query read-only, so we never assign back onto req.)
 * A ZodError thrown here is turned into a 400 by errorHandler.
 */
export const validate = (schema, source = 'body') => (req, res, next) => {
  req.valid = { ...req.valid, [source]: schema.parse(req[source]) };
  next();
};

export const idParams = z.object({ id: z.coerce.number().int().positive() });

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

export const paged = (rows, total, page, pageSize) => ({ data: rows, page, pageSize, total });
