import { config } from '../config.js';
import { get } from '../db/index.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { randomToken, safeEqual, verifySession } from '../lib/security.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Charge l'utilisateur courant a partir du cookie de session (si present). */
export function attachUser(req, _res, next) {
  req.user = null;
  const token = req.cookies?.[config.cookieName];
  if (!token) return next();

  const payload = verifySession(token);
  if (!payload) return next();

  const user = get(
    `SELECT u.*, e.name AS establishment_name, c.label AS cohort_label,
            p.name AS program_name, p.level AS program_level, p.id AS program_id
       FROM user u
       LEFT JOIN establishment e ON e.id = u.establishment_id
       LEFT JOIN cohort c        ON c.id = u.cohort_id
       LEFT JOIN program p       ON p.id = c.program_id
      WHERE u.id = ?`,
    [payload.sub],
  );

  if (user && user.active) req.user = user;
  return next();
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  return next();
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden('Role insuffisant pour cette action'));
    return next();
  };
}

/** Depose le cookie CSRF (lisible par le client) s'il est absent. */
export function issueCsrfCookie(req, res) {
  let token = req.cookies?.[config.csrfCookieName];
  if (!token) {
    token = randomToken(24);
    res.cookie(config.csrfCookieName, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: config.env === 'production',
      maxAge: config.sessionHours * 3600 * 1000,
      path: '/',
    });
  }
  return token;
}

/** Double-submit cookie : le client renvoie le jeton dans l'en-tete X-CSRF-Token. */
export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies?.[config.csrfCookieName];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    return next(forbidden('Jeton CSRF invalide ou absent'));
  }
  return next();
}
