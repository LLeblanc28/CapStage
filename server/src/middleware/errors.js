import { ZodError } from 'zod';
import { ApiError } from '../lib/errors.js';
import { config } from '../config.js';

export function notFoundHandler(req, res, next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route API inconnue' });
  }
  return next();
}

// eslint-disable-next-line no-unused-vars -- signature Express a 4 arguments
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Donnees invalides',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Fichier trop volumineux' });
  }

  if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE' || /UNIQUE constraint/i.test(err?.message || '')) {
    return res.status(409).json({ error: 'Cet enregistrement existe deja' });
  }

  console.error('[capstage] erreur non geree:', err);
  return res.status(500).json({
    error: 'Erreur interne du serveur',
    details: config.env === 'production' ? undefined : String(err?.message || err),
  });
}
