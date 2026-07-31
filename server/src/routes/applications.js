import { Router } from 'express';
import { all, get, logEvent, run } from '../db/index.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/errors.js';
import { applicationSchema, visitSchema } from '../lib/schemas.js';
import { requireAuth } from '../middleware/auth.js';
import { canViewStudent, studentScope } from '../services/scope.js';

const router = Router();
router.use(requireAuth);

const FIELDS = [
  'cv_id',
  'company',
  'position',
  'city',
  'contact_name',
  'contact_email',
  'contact_phone',
  'kind',
  'channel',
  'sent_at',
  'status',
  'start_date',
  'end_date',
  'company_tutor',
  'notes',
];

function loadApplication(id) {
  const row = get(
    `SELECT a.*, u.first_name, u.last_name, u.email, u.establishment_id, u.cohort_id,
            c.label AS cohort_label, p.name AS program_name
       FROM application a
       JOIN user u        ON u.id = a.user_id
       LEFT JOIN cohort c ON c.id = u.cohort_id
       LEFT JOIN program p ON p.id = c.program_id
      WHERE a.id = ?`,
    [id],
  );
  if (!row) throw notFound('Candidature introuvable');
  return row;
}

function visitsFor(applicationId, viewer, ownerId) {
  const rows = all(
    `SELECT v.*, a.first_name AS author_first_name, a.last_name AS author_last_name
       FROM visit v LEFT JOIN user a ON a.id = v.author_id
      WHERE v.application_id = ? ORDER BY v.visit_date DESC, v.id DESC`,
    [applicationId],
  );
  // Un etudiant ne voit que les comptes rendus que le referent a choisi de partager.
  if (viewer.role === 'student' && viewer.id === ownerId) {
    return rows.filter((v) => v.shared_with_student);
  }
  return rows;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, kind, user_id: userIdParam, q } = req.query;
    const scope = studentScope(req.user);
    const where = [scope.sql];
    const params = [...scope.params];

    if (userIdParam) {
      where.push('a.user_id = ?');
      params.push(Number(userIdParam));
    }
    if (status) {
      where.push('a.status = ?');
      params.push(String(status));
    }
    if (kind) {
      where.push('a.kind = ?');
      params.push(String(kind));
    }
    if (q) {
      where.push('(a.company LIKE ? OR a.position LIKE ? OR a.city LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const items = all(
      `SELECT a.*, u.first_name, u.last_name,
              (SELECT count(*) FROM visit v WHERE v.application_id = a.id) AS visit_count
         FROM application a JOIN user u ON u.id = a.user_id
        WHERE ${where.join(' AND ')}
        ORDER BY a.sent_at DESC, a.id DESC`,
      params,
    );
    res.json({ items });
  }),
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const scope = studentScope(req.user);
    const byStatus = all(
      `SELECT a.status, count(*) AS n FROM application a JOIN user u ON u.id = a.user_id
        WHERE ${scope.sql} GROUP BY a.status`,
      scope.params,
    );
    const byKind = all(
      `SELECT a.kind, count(*) AS n FROM application a JOIN user u ON u.id = a.user_id
        WHERE ${scope.sql} GROUP BY a.kind`,
      scope.params,
    );
    const byMonth = all(
      `SELECT substr(a.sent_at, 1, 7) AS month, count(*) AS n
         FROM application a JOIN user u ON u.id = a.user_id
        WHERE ${scope.sql} GROUP BY month ORDER BY month DESC LIMIT 12`,
      scope.params,
    );
    const total = all(
      `SELECT count(*) AS n FROM application a JOIN user u ON u.id = a.user_id WHERE ${scope.sql}`,
      scope.params,
    )[0].n;
    res.json({ total, by_status: byStatus, by_kind: byKind, by_month: byMonth.reverse() });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = applicationSchema.parse(req.body);
    const targetUser = req.user.role === 'admin' && req.body.user_id ? Number(req.body.user_id) : req.user.id;
    if (targetUser !== req.user.id && !canViewStudent(req.user, targetUser)) {
      throw forbidden('Utilisateur hors de votre perimetre');
    }
    if (data.cv_id) {
      const owned = get('SELECT id FROM cv WHERE id = ? AND user_id = ?', [data.cv_id, targetUser]);
      if (!owned) throw badRequest("Le CV selectionne n'appartient pas a cet utilisateur");
    }
    const cols = ['user_id', ...FIELDS];
    const { lastInsertRowid } = run(
      `INSERT INTO application (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      [targetUser, ...FIELDS.map((f) => data[f] ?? null)],
    );
    logEvent(req.user.id, 'application_created', { id: lastInsertRowid });
    res.status(201).json({ application: loadApplication(lastInsertRowid) });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = loadApplication(Number(req.params.id));
    if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
      throw forbidden('Seul le proprietaire peut modifier cette candidature');
    }
    const data = applicationSchema.parse(req.body);
    run(
      `UPDATE application SET ${FIELDS.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now')
        WHERE id = ?`,
      [...FIELDS.map((f) => data[f] ?? null), existing.id],
    );
    res.json({ application: loadApplication(existing.id) });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = loadApplication(Number(req.params.id));
    if (existing.user_id !== req.user.id && req.user.role !== 'admin') {
      throw forbidden('Seul le proprietaire peut supprimer cette candidature');
    }
    run('DELETE FROM application WHERE id = ?', [existing.id]);
    res.json({ ok: true });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = loadApplication(Number(req.params.id));
    if (!canViewStudent(req.user, existing.user_id)) throw forbidden('Acces refuse');
    res.json({
      application: existing,
      visits: visitsFor(existing.id, req.user, existing.user_id),
    });
  }),
);

/* ------------------------------------------------ visites de stage */

router.post(
  '/:id/visits',
  asyncHandler(async (req, res) => {
    const existing = loadApplication(Number(req.params.id));
    if (!['tutor', 'admin'].includes(req.user.role)) {
      throw forbidden('Seuls les referents et administrateurs saisissent un compte rendu de visite');
    }
    if (!canViewStudent(req.user, existing.user_id)) throw forbidden('Etudiant hors de votre perimetre');

    const data = visitSchema.parse(req.body);
    const { lastInsertRowid } = run(
      `INSERT INTO visit (application_id, author_id, visit_date, mode, comment, rating, shared_with_student)
       VALUES (?, ?, COALESCE(?, date('now')), ?, ?, ?, ?)`,
      [
        existing.id,
        req.user.id,
        data.visit_date,
        data.mode,
        data.comment,
        data.rating,
        data.shared_with_student,
      ],
    );
    logEvent(req.user.id, 'visit_created', { application_id: existing.id, visit_id: lastInsertRowid });
    res.status(201).json({ visits: visitsFor(existing.id, req.user, existing.user_id) });
  }),
);

router.delete(
  '/:id/visits/:visitId',
  asyncHandler(async (req, res) => {
    const existing = loadApplication(Number(req.params.id));
    const visit = get('SELECT * FROM visit WHERE id = ? AND application_id = ?', [
      Number(req.params.visitId),
      existing.id,
    ]);
    if (!visit) throw notFound('Compte rendu introuvable');
    if (req.user.role !== 'admin' && visit.author_id !== req.user.id) {
      throw forbidden('Seul son auteur peut supprimer ce compte rendu');
    }
    run('DELETE FROM visit WHERE id = ?', [visit.id]);
    res.json({ visits: visitsFor(existing.id, req.user, existing.user_id) });
  }),
);

export default router;
