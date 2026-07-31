import { Router } from 'express';
import { all, get, logEvent, run, transaction } from '../db/index.js';
import { asyncHandler, badRequest, conflict, notFound } from '../lib/errors.js';
import { parseCsv, toCsv } from '../lib/csv.js';
import {
  adminUserCreateSchema,
  adminUserPatchSchema,
  cohortSchema,
  establishmentSchema,
  programSchema,
} from '../lib/schemas.js';
import { publicUser } from '../lib/serialize.js';
import { generateTempPassword, hashPassword } from '../lib/security.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/* --------------------------------------------------------- tableau de bord */

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const scalar = (sql, params = []) => get(sql, params)?.n ?? 0;

    const usersByRole = all('SELECT role, count(*) AS n FROM user GROUP BY role');
    // Attention : SQLite resout un GROUP BY portant le nom d'une colonne existante
    // vers cette colonne et non vers l'alias de sortie. On groupe donc explicitement
    // sur l'expression source.
    const usersByEstablishment = all(
      `SELECT COALESCE(e.name, 'Non rattache') AS label, count(*) AS n
         FROM user u LEFT JOIN establishment e ON e.id = u.establishment_id
        GROUP BY u.establishment_id ORDER BY n DESC LIMIT 12`,
    );
    const usersByLevel = all(
      `SELECT COALESCE(p.level, 'non_renseigne') AS label, count(*) AS n
         FROM user u
         LEFT JOIN cohort c  ON c.id = u.cohort_id
         LEFT JOIN program p ON p.id = c.program_id
        WHERE u.role = 'student'
        GROUP BY COALESCE(p.level, 'non_renseigne') ORDER BY n DESC`,
    );
    const applicationsByStatus = all('SELECT status, count(*) AS n FROM application GROUP BY status');
    const applicationsByMonth = all(
      `SELECT substr(sent_at, 1, 7) AS month, count(*) AS n
         FROM application GROUP BY month ORDER BY month DESC LIMIT 12`,
    );
    const topSkills = all(
      `SELECT lower(name) AS label, count(*) AS n FROM cv_skill GROUP BY lower(name) ORDER BY n DESC LIMIT 15`,
    );
    const activity = all(
      `SELECT date(created_at) AS day, count(*) AS n
         FROM event_log WHERE created_at >= datetime('now', '-30 days')
        GROUP BY day ORDER BY day`,
    );
    const eventsByType = all(
      `SELECT type, count(*) AS n FROM event_log
        WHERE created_at >= datetime('now', '-30 days') GROUP BY type ORDER BY n DESC`,
    );
    const withoutCv = scalar(
      `SELECT count(*) AS n FROM user u
        WHERE u.role = 'student' AND NOT EXISTS (SELECT 1 FROM cv WHERE cv.user_id = u.id)`,
    );
    const searchingStudents = scalar(
      "SELECT count(DISTINCT user_id) AS n FROM cv WHERE searching = 1",
    );
    const studentsWithPlacement = scalar(
      "SELECT count(DISTINCT user_id) AS n FROM application WHERE status = 'acceptee'",
    );
    const totalStudents = scalar("SELECT count(*) AS n FROM user WHERE role = 'student'");

    res.json({
      totals: {
        users: scalar('SELECT count(*) AS n FROM user'),
        students: totalStudents,
        cvs: scalar('SELECT count(*) AS n FROM cv'),
        pdf_exports: scalar('SELECT COALESCE(sum(pdf_exports), 0) AS n FROM cv'),
        applications: scalar('SELECT count(*) AS n FROM application'),
        visits: scalar('SELECT count(*) AS n FROM visit'),
        establishments: scalar('SELECT count(*) AS n FROM establishment'),
        programs: scalar('SELECT count(*) AS n FROM program'),
        cohorts: scalar('SELECT count(*) AS n FROM cohort'),
        students_without_cv: withoutCv,
        students_searching: searchingStudents,
        students_with_placement: studentsWithPlacement,
        placement_rate: totalStudents ? Math.round((studentsWithPlacement / totalStudents) * 100) : 0,
        logins_30d: scalar(
          "SELECT count(*) AS n FROM event_log WHERE type = 'login' AND created_at >= datetime('now', '-30 days')",
        ),
      },
      users_by_role: usersByRole,
      users_by_establishment: usersByEstablishment,
      users_by_level: usersByLevel,
      applications_by_status: applicationsByStatus,
      applications_by_month: applicationsByMonth.reverse(),
      top_skills: topSkills,
      activity_30d: activity,
      events_by_type: eventsByType,
    });
  }),
);

/* ------------------------------------------------------------ utilisateurs */

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const { q, role, establishment_id, cohort_id, active } = req.query;
    const where = ['1 = 1'];
    const params = [];
    if (q) {
      where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (role) {
      where.push('u.role = ?');
      params.push(String(role));
    }
    if (establishment_id) {
      where.push('u.establishment_id = ?');
      params.push(Number(establishment_id));
    }
    if (cohort_id) {
      where.push('u.cohort_id = ?');
      params.push(Number(cohort_id));
    }
    if (active === '0' || active === '1') {
      where.push('u.active = ?');
      params.push(Number(active));
    }

    const items = all(
      `SELECT u.*, e.name AS establishment_name, c.label AS cohort_label,
              p.name AS program_name, p.level AS program_level, p.id AS program_id,
              (SELECT count(*) FROM cv WHERE cv.user_id = u.id) AS cv_count,
              (SELECT count(*) FROM application a WHERE a.user_id = u.id) AS application_count
         FROM user u
         LEFT JOIN establishment e ON e.id = u.establishment_id
         LEFT JOIN cohort c        ON c.id = u.cohort_id
         LEFT JOIN program p       ON p.id = c.program_id
        WHERE ${where.join(' AND ')}
        ORDER BY u.last_name, u.first_name`,
      params,
    );

    res.json({
      items: items.map((u) => ({
        ...publicUser(u),
        cv_count: u.cv_count,
        application_count: u.application_count,
      })),
    });
  }),
);

router.post(
  '/users',
  asyncHandler(async (req, res) => {
    const data = adminUserCreateSchema.parse(req.body);
    if (get('SELECT id FROM user WHERE email = ?', [data.email])) {
      throw conflict('Cette adresse e-mail est deja utilisee');
    }
    const tempPassword = generateTempPassword();
    const hash = await hashPassword(tempPassword);
    const { lastInsertRowid } = run(
      `INSERT INTO user (email, password_hash, first_name, last_name, role, establishment_id, cohort_id, must_change_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [data.email, hash, data.first_name, data.last_name, data.role, data.establishment_id, data.cohort_id],
    );
    if (data.role === 'student') {
      run('INSERT INTO cv (user_id, title, contact_email, is_default) VALUES (?, ?, ?, 1)', [
        lastInsertRowid,
        'Mon CV',
        data.email,
      ]);
    }
    logEvent(req.user.id, 'admin_user_created', { user_id: lastInsertRowid });
    res.status(201).json({ id: lastInsertRowid, temp_password: tempPassword });
  }),
);

router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const user = get('SELECT * FROM user WHERE id = ?', [id]);
    if (!user) throw notFound('Utilisateur introuvable');
    const data = adminUserPatchSchema.parse(req.body);

    if (data.email && data.email !== user.email && get('SELECT id FROM user WHERE email = ?', [data.email])) {
      throw conflict('Cette adresse e-mail est deja utilisee');
    }
    if (id === req.user.id && data.role && data.role !== 'admin') {
      throw badRequest('Vous ne pouvez pas retirer votre propre role administrateur');
    }
    if (id === req.user.id && data.active !== undefined && !toBool(data.active)) {
      throw badRequest('Vous ne pouvez pas desactiver votre propre compte');
    }

    const updates = [];
    const params = [];
    for (const field of ['first_name', 'last_name', 'email', 'role']) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(data[field]);
      }
    }
    for (const field of ['establishment_id', 'cohort_id']) {
      if (field in req.body) {
        updates.push(`${field} = ?`);
        params.push(data[field]);
      }
    }
    if (data.active !== undefined) {
      updates.push('active = ?');
      params.push(toBool(data.active) ? 1 : 0);
    }
    if (updates.length) {
      run(`UPDATE user SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ?`, [...params, id]);
    }

    if (data.cohort_ids) {
      transaction(() => {
        run('DELETE FROM tutor_cohort WHERE tutor_id = ?', [id]);
        for (const cohortId of data.cohort_ids) {
          run('INSERT OR IGNORE INTO tutor_cohort (tutor_id, cohort_id) VALUES (?, ?)', [id, cohortId]);
        }
      });
    }

    logEvent(req.user.id, 'admin_user_updated', { user_id: id });
    res.json({ ok: true });
  }),
);

router.post(
  '/users/:id/reset-password',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!get('SELECT id FROM user WHERE id = ?', [id])) throw notFound('Utilisateur introuvable');
    const tempPassword = generateTempPassword();
    run(
      "UPDATE user SET password_hash = ?, must_change_password = 1, failed_attempts = 0, locked_until = NULL WHERE id = ?",
      [await hashPassword(tempPassword), id],
    );
    logEvent(req.user.id, 'admin_password_reset', { user_id: id });
    res.json({ temp_password: tempPassword });
  }),
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) throw badRequest('Vous ne pouvez pas supprimer votre propre compte');
    if (!get('SELECT id FROM user WHERE id = ?', [id])) throw notFound('Utilisateur introuvable');
    run('DELETE FROM user WHERE id = ?', [id]);
    logEvent(req.user.id, 'admin_user_deleted', { user_id: id });
    res.json({ ok: true });
  }),
);

/**
 * Import d'utilisateurs depuis un CSV (interoperabilite avec le SI existant).
 * Colonnes attendues : email;prenom;nom;role;etablissement;promotion
 */
router.post(
  '/users/import',
  asyncHandler(async (req, res) => {
    const rows = parseCsv(req.body?.csv || '');
    if (!rows.length) throw badRequest('CSV vide ou illisible');
    if (rows.length > 1000) throw badRequest('Import limite a 1000 lignes par fichier');

    const created = [];
    const errors = [];

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const email = (row.email || row.mail || '').toLowerCase().trim();
      const firstName = row.prenom || row.first_name || '';
      const lastName = row.nom || row.last_name || '';
      try {
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('e-mail invalide');
        if (!firstName || !lastName) throw new Error('prenom et nom requis');
        if (get('SELECT id FROM user WHERE email = ?', [email])) throw new Error('compte deja existant');

        const establishmentName = row.etablissement || row.establishment || '';
        let establishmentId = null;
        if (establishmentName) {
          const found = get('SELECT id FROM establishment WHERE name = ?', [establishmentName]);
          establishmentId = found
            ? found.id
            : run('INSERT INTO establishment (name) VALUES (?)', [establishmentName]).lastInsertRowid;
        }

        const cohortLabel = row.promotion || row.cohort || '';
        let cohortId = null;
        if (cohortLabel) {
          const found = get(
            `SELECT c.id FROM cohort c JOIN program p ON p.id = c.program_id
              WHERE c.label = ? AND (p.establishment_id IS ? OR ? IS NULL)`,
            [cohortLabel, establishmentId, establishmentId],
          );
          if (found) cohortId = found.id;
          else errors.push({ line, email, error: `promotion inconnue : ${cohortLabel}` });
        }

        const role = ['student', 'tutor', 'admin'].includes(row.role) ? row.role : 'student';
        const tempPassword = generateTempPassword();
        const { lastInsertRowid } = run(
          `INSERT INTO user (email, password_hash, first_name, last_name, role, establishment_id, cohort_id, must_change_password)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            email,
            // eslint-disable-next-line no-await-in-loop -- import sequentiel volontaire
            await hashPassword(tempPassword),
            firstName.trim(),
            lastName.trim(),
            role,
            establishmentId,
            cohortId,
          ],
        );
        if (role === 'student') {
          run('INSERT INTO cv (user_id, title, contact_email, is_default) VALUES (?, ?, ?, 1)', [
            lastInsertRowid,
            'Mon CV',
            email,
          ]);
        }
        created.push({ email, first_name: firstName, last_name: lastName, temp_password: tempPassword });
      } catch (err) {
        errors.push({ line, email, error: err.message });
      }
    }

    logEvent(req.user.id, 'admin_import', { created: created.length, errors: errors.length });
    res.json({ created, errors });
  }),
);

/* ------------------------------------------------------------- exports CSV */

function sendCsv(res, filename, rows, columns) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(rows, columns));
}

router.get(
  '/export/users.csv',
  asyncHandler(async (_req, res) => {
    const rows = all(
      `SELECT u.email, u.first_name, u.last_name, u.role, e.name AS establishment,
              p.name AS program, p.level, c.label AS cohort, u.active, u.last_login_at, u.created_at
         FROM user u
         LEFT JOIN establishment e ON e.id = u.establishment_id
         LEFT JOIN cohort c        ON c.id = u.cohort_id
         LEFT JOIN program p       ON p.id = c.program_id
        ORDER BY u.last_name`,
    );
    sendCsv(res, 'capstage-utilisateurs.csv', rows, [
      { key: 'email', label: 'Email' },
      { key: 'first_name', label: 'Prenom' },
      { key: 'last_name', label: 'Nom' },
      { key: 'role', label: 'Role' },
      { key: 'establishment', label: 'Etablissement' },
      { key: 'program', label: 'Formation' },
      { key: 'level', label: 'Niveau' },
      { key: 'cohort', label: 'Promotion' },
      { key: 'active', label: 'Actif' },
      { key: 'last_login_at', label: 'Derniere connexion' },
      { key: 'created_at', label: 'Cree le' },
    ]);
  }),
);

router.get(
  '/export/cvs.csv',
  asyncHandler(async (_req, res) => {
    const rows = all(
      `SELECT u.last_name, u.first_name, u.email, e.name AS establishment, p.name AS program,
              c.label AS cohort, cv.title, cv.headline, cv.template, cv.visibility, cv.searching,
              cv.search_kind, cv.pdf_exports, cv.views, cv.updated_at,
              (SELECT group_concat(s.name, ' | ') FROM cv_skill s WHERE s.cv_id = cv.id) AS skills
         FROM cv
         JOIN user u               ON u.id = cv.user_id
         LEFT JOIN establishment e ON e.id = u.establishment_id
         LEFT JOIN cohort c        ON c.id = u.cohort_id
         LEFT JOIN program p       ON p.id = c.program_id
        ORDER BY u.last_name`,
    );
    sendCsv(res, 'capstage-cv.csv', rows, [
      { key: 'last_name', label: 'Nom' },
      { key: 'first_name', label: 'Prenom' },
      { key: 'email', label: 'Email' },
      { key: 'establishment', label: 'Etablissement' },
      { key: 'program', label: 'Formation' },
      { key: 'cohort', label: 'Promotion' },
      { key: 'title', label: 'Titre du CV' },
      { key: 'headline', label: 'Accroche' },
      { key: 'template', label: 'Modele' },
      { key: 'visibility', label: 'Visibilite' },
      { key: 'searching', label: 'En recherche' },
      { key: 'search_kind', label: 'Type recherche' },
      { key: 'skills', label: 'Competences' },
      { key: 'pdf_exports', label: 'Exports PDF' },
      { key: 'views', label: 'Vues' },
      { key: 'updated_at', label: 'Mis a jour le' },
    ]);
  }),
);

router.get(
  '/export/applications.csv',
  asyncHandler(async (_req, res) => {
    const rows = all(
      `SELECT u.last_name, u.first_name, c.label AS cohort, a.company, a.position, a.city, a.kind,
              a.channel, a.sent_at, a.status, a.start_date, a.end_date, a.company_tutor,
              (SELECT count(*) FROM visit v WHERE v.application_id = a.id) AS visits
         FROM application a
         JOIN user u        ON u.id = a.user_id
         LEFT JOIN cohort c ON c.id = u.cohort_id
        ORDER BY a.sent_at DESC`,
    );
    sendCsv(res, 'capstage-candidatures.csv', rows, [
      { key: 'last_name', label: 'Nom' },
      { key: 'first_name', label: 'Prenom' },
      { key: 'cohort', label: 'Promotion' },
      { key: 'company', label: 'Organisation' },
      { key: 'position', label: 'Poste' },
      { key: 'city', label: 'Ville' },
      { key: 'kind', label: 'Type' },
      { key: 'channel', label: 'Canal' },
      { key: 'sent_at', label: 'Envoyee le' },
      { key: 'status', label: 'Statut' },
      { key: 'start_date', label: 'Debut' },
      { key: 'end_date', label: 'Fin' },
      { key: 'company_tutor', label: 'Tuteur entreprise' },
      { key: 'visits', label: 'Visites' },
    ]);
  }),
);

/* ------------------------------------------------------------- referentiel */

function crud(path, table, schema, extraSelect = '') {
  router.get(
    `/${path}`,
    asyncHandler(async (_req, res) => {
      res.json({ items: all(`SELECT t.*${extraSelect} FROM ${table} t ORDER BY t.id DESC`) });
    }),
  );

  router.post(
    `/${path}`,
    asyncHandler(async (req, res) => {
      const data = schema.parse(req.body);
      const keys = Object.keys(data);
      const { lastInsertRowid } = run(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
        keys.map((k) => data[k]),
      );
      logEvent(req.user.id, `admin_${table}_created`, { id: lastInsertRowid });
      res.status(201).json({ id: lastInsertRowid });
    }),
  );

  router.put(
    `/${path}/:id`,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      if (!get(`SELECT id FROM ${table} WHERE id = ?`, [id])) throw notFound('Element introuvable');
      const data = schema.parse(req.body);
      const keys = Object.keys(data);
      run(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [
        ...keys.map((k) => data[k]),
        id,
      ]);
      res.json({ ok: true });
    }),
  );

  router.delete(
    `/${path}/:id`,
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      run(`DELETE FROM ${table} WHERE id = ?`, [id]);
      logEvent(req.user.id, `admin_${table}_deleted`, { id });
      res.json({ ok: true });
    }),
  );
}

crud('establishments', 'establishment', establishmentSchema);
crud('programs', 'program', programSchema);
crud('cohorts', 'cohort', cohortSchema);

function toBool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export default router;
