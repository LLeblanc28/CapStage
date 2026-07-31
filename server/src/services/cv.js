import { all, get, run, transaction } from '../db/index.js';

const CHILD_TABLES = {
  experiences: {
    table: 'cv_experience',
    columns: ['kind', 'position', 'organisation', 'city', 'start_date', 'end_date', 'current', 'description'],
    order: "current DESC, COALESCE(start_date, '0000') DESC, sort_index ASC",
  },
  educations: {
    table: 'cv_education',
    columns: ['degree', 'school', 'city', 'start_date', 'end_date', 'current', 'description'],
    order: "current DESC, COALESCE(start_date, '0000') DESC, sort_index ASC",
  },
  skills: { table: 'cv_skill', columns: ['name', 'category', 'level'], order: 'sort_index ASC' },
  languages: { table: 'cv_language', columns: ['name', 'level'], order: 'sort_index ASC' },
  certifications: {
    table: 'cv_certification',
    columns: ['name', 'issuer', 'obtained_at', 'url'],
    order: 'sort_index ASC',
  },
  interests: { table: 'cv_interest', columns: ['label'], order: 'sort_index ASC' },
  links: { table: 'cv_link', columns: ['label', 'url'], order: 'sort_index ASC' },
};

const CV_COLUMNS = [
  'title',
  'template',
  'accent',
  'headline',
  'summary',
  'contact_email',
  'contact_phone',
  'contact_city',
  'birthdate',
  'driving_license',
  'mobility',
  'visibility',
  'searching',
  'search_kind',
  'available_from',
];

export function getCvRow(id) {
  return get(
    `SELECT cv.*, u.first_name, u.last_name, u.email AS user_email, u.role AS user_role,
            u.establishment_id, e.name AS establishment_name,
            c.label AS cohort_label, p.name AS program_name, p.level AS program_level
       FROM cv
       JOIN user u              ON u.id = cv.user_id
       LEFT JOIN establishment e ON e.id = u.establishment_id
       LEFT JOIN cohort c        ON c.id = u.cohort_id
       LEFT JOIN program p       ON p.id = c.program_id
      WHERE cv.id = ?`,
    [id],
  );
}

export function getCvFull(id) {
  const cv = getCvRow(id);
  if (!cv) return null;
  const result = { ...cv, searching: !!cv.searching, is_default: !!cv.is_default };
  for (const [key, def] of Object.entries(CHILD_TABLES)) {
    result[key] = all(`SELECT * FROM ${def.table} WHERE cv_id = ? ORDER BY ${def.order}`, [id]);
  }
  return result;
}

export function listCvsForUser(userId) {
  return all(
    `SELECT cv.id, cv.title, cv.template, cv.accent, cv.headline, cv.visibility, cv.searching,
            cv.search_kind, cv.is_default, cv.views, cv.pdf_exports, cv.created_at, cv.updated_at,
            (SELECT count(*) FROM cv_experience x WHERE x.cv_id = cv.id) AS experience_count,
            (SELECT count(*) FROM cv_skill s WHERE s.cv_id = cv.id)      AS skill_count
       FROM cv WHERE user_id = ? ORDER BY is_default DESC, updated_at DESC`,
    [userId],
  );
}

/** Valeurs de repli pour les colonnes NOT NULL (donnees importees ou jeu de demo). */
const CHILD_DEFAULTS = {
  experiences: { kind: 'experience', current: 0 },
  educations: { current: 0 },
  skills: { category: 'technique', level: 3 },
  languages: { level: 'B1' },
};

const CV_DEFAULTS = {
  title: 'Mon CV',
  template: 'classique',
  accent: '#1f6feb',
  visibility: 'establishment',
  searching: 1,
  search_kind: 'stage',
};

function replaceChildren(cvId, data) {
  for (const [key, def] of Object.entries(CHILD_TABLES)) {
    run(`DELETE FROM ${def.table} WHERE cv_id = ?`, [cvId]);
    const rows = data[key] || [];
    if (!rows.length) continue;
    const cols = ['cv_id', ...def.columns, 'sort_index'];
    const sql = `INSERT INTO ${def.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
    const fallbacks = CHILD_DEFAULTS[key] || {};
    const stmtParams = rows.map((row, index) => [
      cvId,
      ...def.columns.map((c) => row[c] ?? fallbacks[c] ?? null),
      index,
    ]);
    for (const params of stmtParams) run(sql, params);
  }
}

export function createCv(userId, data) {
  return transaction(() => {
    const cols = ['user_id', ...CV_COLUMNS];
    const { lastInsertRowid } = run(
      `INSERT INTO cv (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      [userId, ...CV_COLUMNS.map((c) => data[c] ?? CV_DEFAULTS[c] ?? null)],
    );
    replaceChildren(lastInsertRowid, data);
    if (data.is_default) setDefaultCv(userId, lastInsertRowid);
    else ensureOneDefault(userId);
    return lastInsertRowid;
  });
}

export function updateCv(cvId, userId, data) {
  return transaction(() => {
    run(
      `UPDATE cv SET ${CV_COLUMNS.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now')
        WHERE id = ?`,
      [...CV_COLUMNS.map((c) => data[c] ?? CV_DEFAULTS[c] ?? null), cvId],
    );
    replaceChildren(cvId, data);
    if (data.is_default) setDefaultCv(userId, cvId);
    else ensureOneDefault(userId);
    return cvId;
  });
}

export function duplicateCv(cvId, userId) {
  const source = getCvFull(cvId);
  if (!source) return null;
  const copy = { ...source, title: `${source.title} (copie)`, is_default: 0 };
  return createCv(userId, copy);
}

export function deleteCv(cvId, userId) {
  const res = run('DELETE FROM cv WHERE id = ?', [cvId]);
  ensureOneDefault(userId);
  return res.changes > 0;
}

export function setDefaultCv(userId, cvId) {
  run('UPDATE cv SET is_default = 0 WHERE user_id = ?', [userId]);
  run('UPDATE cv SET is_default = 1 WHERE id = ? AND user_id = ?', [cvId, userId]);
}

/** Garantit qu'un utilisateur a toujours exactement un CV par defaut. */
export function ensureOneDefault(userId) {
  const current = get('SELECT id FROM cv WHERE user_id = ? AND is_default = 1 LIMIT 1', [userId]);
  if (current) return;
  const first = get('SELECT id FROM cv WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', [userId]);
  if (first) run('UPDATE cv SET is_default = 1 WHERE id = ?', [first.id]);
}

/**
 * Regles de lecture d'un CV :
 *  - proprietaire, admin : toujours
 *  - referent : les CV des etudiants de sa structure / de ses promotions
 *  - autres utilisateurs : selon la visibilite choisie par l'etudiant
 */
export function canReadCv(viewer, cv) {
  if (!viewer || !cv) return false;
  if (viewer.role === 'admin') return true;
  if (cv.user_id === viewer.id) return true;
  if (viewer.role === 'tutor') {
    if (!cv.establishment_id || !viewer.establishment_id) return cv.visibility !== 'private';
    if (cv.establishment_id === viewer.establishment_id) return true;
  }
  if (cv.visibility === 'public') return true;
  if (cv.visibility === 'establishment') {
    return !!viewer.establishment_id && viewer.establishment_id === cv.establishment_id;
  }
  return false;
}

export function canWriteCv(viewer, cv) {
  if (!viewer || !cv) return false;
  return viewer.role === 'admin' || cv.user_id === viewer.id;
}
