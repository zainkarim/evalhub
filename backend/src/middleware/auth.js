import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from './errors.js';

/** Issue a signed JWT. Payload: sub = user id, role, tid = linked teacher id. */
export function signToken(user) {
  return jwt.sign(
    { role: user.role, tid: user.teacher_id ?? null },
    config.jwtSecret,
    { algorithm: 'HS256', subject: String(user.id), expiresIn: config.jwtExpiresIn },
  );
}

/** Require a valid Bearer token; sets req.user = { id, role, teacherId }. */
export function authenticate(req, res, next) {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'unauthorized', 'Missing bearer token'));
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    req.user = { id: Number(payload.sub), role: payload.role, teacherId: payload.tid ?? null };
    return next();
  } catch {
    return next(new HttpError(401, 'unauthorized', 'Invalid or expired token'));
  }
}

/** Allow only the listed roles, e.g. requireRole('ac_member', 'admin'). */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new HttpError(403, 'forbidden', 'You do not have permission to do that'));
  }
  return next();
};

export const AC_OR_ADMIN = ['ac_member', 'admin'];

// Department Head and Annual Review Committee: read-only access to completed
// observations only (requirements §3, §4.6). Not linked to a teacher profile.
export const VIEW_ONLY_ROLES = ['dept_head', 'annual_review'];
export const isViewOnly = (user) => VIEW_ONLY_ROLES.includes(user?.role);

/** Keep view-only accounts out of a whole router (e.g. sign-ups, teachers). */
export function denyViewOnly(req, res, next) {
  if (isViewOnly(req.user)) {
    return next(new HttpError(403, 'forbidden', 'This account has view-only access to completed observations'));
  }
  return next();
}

/** Let view-only accounts read (GET) but never write. */
export function readOnlyForViewOnly(req, res, next) {
  if (isViewOnly(req.user) && req.method !== 'GET') {
    return next(new HttpError(403, 'forbidden', 'This account has view-only access'));
  }
  return next();
}
