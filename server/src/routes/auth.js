import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { get, logEvent, run } from '../db/index.js';
import { asyncHandler, badRequest, conflict, unauthorized } from '../lib/errors.js';
import {
  changePasswordSchema,
  loginSchema,
  profileSchema,
  registerSchema,
} from '../lib/schemas.js';
import { publicUser } from '../lib/serialize.js';
import {
  hashPassword,
  sessionCookieOptions,
  signSession,
  verifyPassword,
} from '../lib/security.js';
import { issueCsrfCookie, requireAuth } from '../middleware/auth.js';

const router = Router();

const MAX_FAILED = 8;
const LOCK_MINUTES = 15;

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, reessayez dans quelques minutes.' },
});

function loadFullUser(id) {
  return get(
    `SELECT u.*, e.name AS establishment_name, c.label AS cohort_label,
            p.name AS program_name, p.level AS program_level, p.id AS program_id
       FROM user u
       LEFT JOIN establishment e ON e.id = u.establishment_id
       LEFT JOIN cohort c        ON c.id = u.cohort_id
       LEFT JOIN program p       ON p.id = c.program_id
      WHERE u.id = ?`,
    [id],
  );
}

function openSession(res, req, user) {
  res.cookie(config.cookieName, signSession(user), sessionCookieOptions());
  const csrf = issueCsrfCookie(req, res);
  run("UPDATE user SET last_login_at = datetime('now'), failed_attempts = 0, locked_until = NULL WHERE id = ?", [
    user.id,
  ]);
  logEvent(user.id, 'login');
  return csrf;
}

/** Verifie la coherence promotion / etablissement avant rattachement. */
function resolveCohort(establishmentId, cohortId) {
  if (!cohortId) return null;
  const row = get(
    `SELECT c.id, p.establishment_id
       FROM cohort c JOIN program p ON p.id = c.program_id
      WHERE c.id = ?`,
    [cohortId],
  );
  if (!row) throw badRequest('Promotion inconnue');
  if (row.establishment_id && establishmentId && row.establishment_id !== establishmentId) {
    throw badRequest("La promotion choisie n'appartient pas a cet etablissement");
  }
  return row.id;
}

router.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const data = registerSchema.parse(req.body);

    if (get('SELECT id FROM user WHERE email = ?', [data.email])) {
      throw conflict('Un compte existe deja avec cette adresse e-mail');
    }
    if (data.establishment_id && !get('SELECT id FROM establishment WHERE id = ?', [data.establishment_id])) {
      throw badRequest('Etablissement inconnu');
    }
    const cohortId = resolveCohort(data.establishment_id, data.cohort_id);

    const hash = await hashPassword(data.password);
    const { lastInsertRowid } = run(
      `INSERT INTO user (email, password_hash, first_name, last_name, role, establishment_id, cohort_id, phone, city)
       VALUES (?, ?, ?, ?, 'student', ?, ?, ?, ?)`,
      [
        data.email,
        hash,
        data.first_name,
        data.last_name,
        data.establishment_id,
        cohortId,
        data.phone,
        data.city,
      ],
    );

    // CV vierge cree d'office : l'etudiant arrive directement dans l'editeur.
    run(
      `INSERT INTO cv (user_id, title, contact_email, contact_phone, contact_city, is_default)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [lastInsertRowid, 'Mon CV', data.email, data.phone, data.city],
    );

    const user = loadFullUser(lastInsertRowid);
    const csrf = openSession(res, req, user);
    logEvent(user.id, 'register');
    res.status(201).json({ user: publicUser(user), csrf_token: csrf });
  }),
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = get('SELECT * FROM user WHERE email = ?', [email]);
    const invalid = unauthorized('Identifiants incorrects');

    if (!user) {
      await hashPassword('dummy-timing-equalizer');
      throw invalid;
    }
    if (user.locked_until && new Date(`${user.locked_until}Z`) > new Date()) {
      throw unauthorized('Compte temporairement bloque suite a trop de tentatives. Reessayez plus tard.');
    }
    if (!user.active) throw unauthorized('Compte desactive, contactez un administrateur');

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      const attempts = user.failed_attempts + 1;
      if (attempts >= MAX_FAILED) {
        run(
          `UPDATE user SET failed_attempts = ?, locked_until = datetime('now', '+${LOCK_MINUTES} minutes') WHERE id = ?`,
          [attempts, user.id],
        );
      } else {
        run('UPDATE user SET failed_attempts = ? WHERE id = ?', [attempts, user.id]);
      }
      logEvent(user.id, 'login_failed');
      throw invalid;
    }

    const full = loadFullUser(user.id);
    const csrf = openSession(res, req, full);
    res.json({ user: publicUser(full), csrf_token: csrf });
  }),
);

router.post('/logout', (req, res) => {
  if (req.user) logEvent(req.user.id, 'logout');
  res.clearCookie(config.cookieName, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const csrf = issueCsrfCookie(req, res);
  res.json({
    user: publicUser(req.user),
    csrf_token: csrf,
    platform_name: config.platformName,
  });
});

router.put(
  '/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = profileSchema.parse(req.body);
    const cohortId = resolveCohort(data.establishment_id, data.cohort_id);
    run(
      `UPDATE user
          SET first_name = ?, last_name = ?, phone = ?, city = ?, birthdate = ?,
              establishment_id = ?, cohort_id = ?, updated_at = datetime('now')
        WHERE id = ?`,
      [
        data.first_name,
        data.last_name,
        data.phone,
        data.city,
        data.birthdate,
        data.establishment_id,
        cohortId,
        req.user.id,
      ],
    );
    res.json({ user: publicUser(loadFullUser(req.user.id)) });
  }),
);

router.put(
  '/password',
  requireAuth,
  authLimiter,
  asyncHandler(async (req, res) => {
    const { current_password, new_password } = changePasswordSchema.parse(req.body);
    const user = get('SELECT * FROM user WHERE id = ?', [req.user.id]);
    if (!(await verifyPassword(current_password, user.password_hash))) {
      throw unauthorized('Mot de passe actuel incorrect');
    }
    const hash = await hashPassword(new_password);
    run(
      "UPDATE user SET password_hash = ?, must_change_password = 0, updated_at = datetime('now') WHERE id = ?",
      [hash, req.user.id],
    );
    logEvent(req.user.id, 'password_changed');
    res.json({ ok: true });
  }),
);

export default router;
