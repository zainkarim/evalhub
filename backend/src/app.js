import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { query } from './db/pool.js';
import { authenticate, denyViewOnly, readOnlyForViewOnly } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import assessmentRoutes from './routes/assessments.js';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import criteriaRoutes from './routes/criteria.js';
import observationRoutes from './routes/observations.js';
import sectionRoutes from './routes/sections.js';
import teacherRoutes from './routes/teachers.js';
import termRoutes from './routes/terms.js';
import timeOptionRoutes from './routes/timeOptions.js';

export function createApp() {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '100kb' }));

  // Unauthenticated liveness + DB check (used by hosting health probes)
  app.get('/api/health', async (req, res) => {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes); // /login is public; /me and /register authenticate inside the router
  // View-only roles (Dept Head, Annual Review Committee) are allow-listed:
  // they can read terms, criteria and completed observations, and nothing
  // else. New routers are closed to them unless added here on purpose.
  app.use('/api/assessments', authenticate, denyViewOnly, assessmentRoutes);
  app.use('/api/teachers', authenticate, denyViewOnly, teacherRoutes);
  app.use('/api/terms', authenticate, readOnlyForViewOnly, termRoutes);
  app.use('/api/courses', authenticate, denyViewOnly, courseRoutes);
  app.use('/api/sections', authenticate, denyViewOnly, sectionRoutes);
  app.use('/api/time-options', authenticate, denyViewOnly, timeOptionRoutes);
  app.use('/api/criteria', authenticate, readOnlyForViewOnly, criteriaRoutes);
  // observations.js was never mounted before this -- its one existing route
  // (POST /:id/review, the retired AC-review stub) was unreachable dead
  // code. #23 adds real routes to this same file (sign-off, response
  // submit/view), so it needs to actually be wired in.
  // View-only roles can read completed observations; observations.js filters them.
  app.use('/api/observations', authenticate, readOnlyForViewOnly, observationRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
  });
  app.use(errorHandler);
  return app;
}
