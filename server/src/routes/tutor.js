import { Router } from 'express';
import { all, get } from '../db/index.js';
import { asyncHandler, forbidden } from '../lib/errors.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { canViewStudent, studentScope, tutorCohortIds } from '../services/scope.js';

const router = Router();
router.use(requireAuth, requireRole('tutor', 'admin'));

/** Liste des etudiants suivis, avec l'avancement de leur recherche. */
router.get(
  '/students',
  asyncHandler(async (req, res) => {
    const scope = studentScope(req.user);
    const where = [scope.sql, "u.role = 'student'"];
    const params = [...scope.params];

    if (req.query.cohort_id) {
      where.push('u.cohort_id = ?');
      params.push(Number(req.query.cohort_id));
    }
    if (req.query.q) {
      where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
    }

    const items = all(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.last_login_at,
              e.name AS establishment_name, c.label AS cohort_label,
              p.name AS program_name, p.level AS program_level,
              (SELECT count(*) FROM cv WHERE cv.user_id = u.id) AS cv_count,
              (SELECT id FROM cv WHERE cv.user_id = u.id ORDER BY is_default DESC, updated_at DESC LIMIT 1) AS main_cv_id,
              (SELECT max(updated_at) FROM cv WHERE cv.user_id = u.id) AS cv_updated_at,
              (SELECT count(*) FROM application a WHERE a.user_id = u.id) AS applications,
              (SELECT count(*) FROM application a WHERE a.user_id = u.id AND a.status = 'entretien') AS interviews,
              (SELECT count(*) FROM application a WHERE a.user_id = u.id AND a.status = 'acceptee') AS accepted,
              (SELECT count(*) FROM visit v JOIN application a ON a.id = v.application_id WHERE a.user_id = u.id) AS visits
         FROM user u
         LEFT JOIN establishment e ON e.id = u.establishment_id
         LEFT JOIN cohort c        ON c.id = u.cohort_id
         LEFT JOIN program p       ON p.id = c.program_id
        WHERE ${where.join(' AND ')}
        ORDER BY u.last_name, u.first_name`,
      params,
    );

    res.json({ items, scoped_cohorts: tutorCohortIds(req.user.id) });
  }),
);

/** Fiche de suivi d'un etudiant : CV, candidatures et comptes rendus de visite. */
router.get(
  '/students/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!canViewStudent(req.user, id)) throw forbidden('Etudiant hors de votre perimetre');

    const student = get(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.city, u.last_login_at,
              e.name AS establishment_name, c.label AS cohort_label,
              p.name AS program_name, p.level AS program_level
         FROM user u
         LEFT JOIN establishment e ON e.id = u.establishment_id
         LEFT JOIN cohort c        ON c.id = u.cohort_id
         LEFT JOIN program p       ON p.id = c.program_id
        WHERE u.id = ?`,
      [id],
    );

    const cvs = all(
      `SELECT id, title, template, headline, visibility, searching, search_kind, updated_at, pdf_exports
         FROM cv WHERE user_id = ? ORDER BY is_default DESC, updated_at DESC`,
      [id],
    );

    const applications = all(
      `SELECT a.*, (SELECT count(*) FROM visit v WHERE v.application_id = a.id) AS visit_count
         FROM application a WHERE a.user_id = ? ORDER BY a.sent_at DESC`,
      [id],
    );

    const visits = all(
      `SELECT v.*, a.company, a.position,
              au.first_name AS author_first_name, au.last_name AS author_last_name
         FROM visit v
         JOIN application a ON a.id = v.application_id
         LEFT JOIN user au  ON au.id = v.author_id
        WHERE a.user_id = ? ORDER BY v.visit_date DESC`,
      [id],
    );

    res.json({ student, cvs, applications, visits });
  }),
);

/** Indicateurs agreges sur le perimetre du referent. */
router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const scope = studentScope(req.user);
    const base = `FROM user u WHERE ${scope.sql} AND u.role = 'student'`;

    const students = get(`SELECT count(*) AS n ${base}`, scope.params).n;
    const withCv = get(
      `SELECT count(*) AS n ${base} AND EXISTS (SELECT 1 FROM cv WHERE cv.user_id = u.id)`,
      scope.params,
    ).n;
    const searching = get(
      `SELECT count(*) AS n ${base} AND EXISTS (SELECT 1 FROM cv WHERE cv.user_id = u.id AND cv.searching = 1)`,
      scope.params,
    ).n;
    const placed = get(
      `SELECT count(*) AS n ${base} AND EXISTS (SELECT 1 FROM application a WHERE a.user_id = u.id AND a.status = 'acceptee')`,
      scope.params,
    ).n;
    const noApplication = get(
      `SELECT count(*) AS n ${base} AND NOT EXISTS (SELECT 1 FROM application a WHERE a.user_id = u.id)`,
      scope.params,
    ).n;
    const applications = get(
      `SELECT count(*) AS n FROM application a JOIN user u ON u.id = a.user_id WHERE ${scope.sql}`,
      scope.params,
    ).n;
    const visits = get(
      `SELECT count(*) AS n FROM visit v JOIN application a ON a.id = v.application_id
         JOIN user u ON u.id = a.user_id WHERE ${scope.sql}`,
      scope.params,
    ).n;
    const byStatus = all(
      `SELECT a.status, count(*) AS n FROM application a JOIN user u ON u.id = a.user_id
        WHERE ${scope.sql} GROUP BY a.status`,
      scope.params,
    );
    const byCohort = all(
      `SELECT COALESCE(c.label, 'Sans promotion') AS label,
              count(DISTINCT u.id) AS students,
              count(a.id) AS applications
         FROM user u
         LEFT JOIN cohort c      ON c.id = u.cohort_id
         LEFT JOIN application a ON a.user_id = u.id
        WHERE ${scope.sql} AND u.role = 'student'
        GROUP BY u.cohort_id ORDER BY 1`,
      scope.params,
    );

    res.json({
      students,
      with_cv: withCv,
      searching,
      placed,
      without_application: noApplication,
      applications,
      visits,
      coverage_rate: students ? Math.round((withCv / students) * 100) : 0,
      placement_rate: students ? Math.round((placed / students) * 100) : 0,
      by_status: byStatus,
      by_cohort: byCohort,
    });
  }),
);

export default router;
