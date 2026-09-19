import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { query } from './db/pool.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/courses.js';
import sectionRoutes from './routes/sections.js';
import teacherRoutes from './routes/teachers.js';
import termRoutes from './routes/terms.js';

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
  app.use('/api/teachers', authenticate, teacherRoutes);
  app.use('/api/terms', authenticate, termRoutes);
  app.use('/api/courses', authenticate, courseRoutes);
  app.use('/api/sections', authenticate, sectionRoutes);

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: `No route for ${req.method} ${req.path}` } });
  });
  app.use(errorHandler);
  return app;
}
