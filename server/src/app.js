import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { applySchema, get } from './db/index.js';
import { attachUser, csrfProtection, requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import cvRoutes from './routes/cvs.js';
import directoryRoutes from './routes/directory.js';
import applicationRoutes from './routes/applications.js';
import referentielRoutes from './routes/referentiel.js';
import tutorRoutes from './routes/tutor.js';
import adminRoutes from './routes/admin.js';

/** Construit l'application Express (separee du demarrage pour les tests). */
export function createApp({ rateLimits = true } = {}) {
  applySchema();

  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(attachUser);

  if (rateLimits) {
    app.use(
      '/api',
      rateLimit({
        windowMs: 60 * 1000,
        limit: 300,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Trop de requetes, merci de patienter.' },
      }),
    );
  }
  app.use('/api', csrfProtection);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      env: config.env,
      users: get('SELECT count(*) AS n FROM user').n,
      platform: config.platformName,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/referentiel', referentielRoutes);
  app.use('/api/cvs', cvRoutes);
  app.use('/api/directory', directoryRoutes);
  app.use('/api/applications', applicationRoutes);
  app.use('/api/tutor', tutorRoutes);
  app.use('/api/admin', adminRoutes);

  // Photos de CV : reservees aux utilisateurs connectes.
  app.use('/uploads', requireAuth, express.static(config.uploadDir, { maxAge: '1h', index: false }));

  app.use(notFoundHandler);

  // Interface React compilee (npm run build) servie par le meme serveur.
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      return res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
