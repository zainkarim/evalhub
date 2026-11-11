import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFound = (what) => new HttpError(404, 'not_found', `${what} not found`);

const send = (res, status, code, message, details) =>
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });

// Express identifies error handlers by their 4-argument signature.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return send(res, err.status, err.code, err.message, err.details);

  if (err instanceof ZodError) {
    return send(res, 400, 'validation_error', 'Invalid request',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }

  if (err.type === 'entity.parse.failed') return send(res, 400, 'invalid_json', 'Request body is not valid JSON');

  // PostgreSQL error codes
  switch (err.code) {
    case '23505': return send(res, 409, 'conflict', 'A record with these values already exists', { constraint: err.constraint });
    case '23503': return send(res, 409, 'foreign_key_violation', 'Referenced record does not exist or is still in use', { constraint: err.constraint });
    case '23514': return send(res, 400, 'check_violation', 'Value violates a data rule', { constraint: err.constraint });
    case '22P02': return send(res, 400, 'invalid_input', 'Invalid input value');
    default: break;
  }

  console.error(err);
  return send(res, 500, 'internal_error', 'Something went wrong');
}
