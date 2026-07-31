import { Router } from 'express';
import { all, get } from '../db/index.js';
import { asyncHandler } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

/** Clause SQL restreignant les CV visibles par l'utilisateur courant. */
function visibilityClause(user) {
  if (user.role === 'admin') return { sql: '1 = 1', params: [] };
  if (user.role === 'tutor') {
    return {
      sql: "(cv.visibility <> 'private' OR u.establishment_id IS ? OR cv.user_id = ?)",
      params: [user.establishment_id, user.id],
    };
  }
  return {
    sql: "(cv.visibility = 'public' OR (cv.visibility = 'establishment' AND u.establishment_id IS ?) OR cv.user_id = ?)",
    params: [user.establishment_id, user.id],
  };
}

const SORTS = {
  recent: 'cv.updated_at DESC',
  name: 'u.last_name ASC, u.first_name ASC',
  views: 'cv.views DESC',
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const {
      q,
      establishment_id,
      program_id,
      cohort_id,
      level,
      search_kind,
      city,
      skill,
      searching,
      sort = 'recent',
    } = req.query;

    const page = Math.max(1, Number(req.query.page) || 1);
    const perPage = Math.min(48, Math.max(6, Number(req.query.per_page) || 12));

    const vis = visibilityClause(req.user);
    const where = [vis.sql];
    const params = [...vis.params];

    if (q) {
      where.push(`(
        u.first_name LIKE ? OR u.last_name LIKE ? OR cv.headline LIKE ? OR cv.summary LIKE ?
        OR EXISTS (SELECT 1 FROM cv_skill s WHERE s.cv_id = cv.id AND s.name LIKE ?)
        OR EXISTS (SELECT 1 FROM cv_experience x WHERE x.cv_id = cv.id AND (x.position LIKE ? OR x.organisation LIKE ?))
      )`);
      const like = `%${q}%`;
      params.push(like, like, like, like, like, like, like);
    }
    if (establishment_id) {
      where.push('u.establishment_id = ?');
      params.push(Number(establishment_id));
    }
    if (program_id) {
      where.push('p.id = ?');
      params.push(Number(program_id));
    }
    if (cohort_id) {
      where.push('u.cohort_id = ?');
      params.push(Number(cohort_id));
    }
    if (level) {
      where.push('p.level = ?');
      params.push(String(level));
    }
    if (search_kind) {
      where.push('cv.search_kind = ?');
      params.push(String(search_kind));
    }
    if (city) {
      where.push('(cv.contact_city LIKE ? OR u.city LIKE ?)');
      params.push(`%${city}%`, `%${city}%`);
    }
    if (skill) {
      where.push('EXISTS (SELECT 1 FROM cv_skill s WHERE s.cv_id = cv.id AND s.name LIKE ?)');
      params.push(`%${skill}%`);
    }
    if (searching === '1') where.push('cv.searching = 1');

    const from = `FROM cv
       JOIN user u               ON u.id = cv.user_id
       LEFT JOIN establishment e ON e.id = u.establishment_id
       LEFT JOIN cohort c        ON c.id = u.cohort_id
       LEFT JOIN program p       ON p.id = c.program_id
      WHERE ${where.join(' AND ')}`;

    const total = get(`SELECT count(*) AS n ${from}`, params).n;
    const orderBy = SORTS[sort] || SORTS.recent;

    const items = all(
      `SELECT cv.id, cv.title, cv.headline, cv.summary, cv.accent, cv.template, cv.visibility,
              cv.searching, cv.search_kind, cv.available_from, cv.contact_city, cv.views,
              cv.updated_at, cv.photo_path,
              u.id AS user_id, u.first_name, u.last_name, u.city AS user_city,
              e.id AS establishment_id, e.name AS establishment_name,
              c.id AS cohort_id, c.label AS cohort_label,
              p.id AS program_id, p.name AS program_name, p.level AS program_level,
              (SELECT group_concat(s.name, ', ')
                 FROM (SELECT name FROM cv_skill WHERE cv_id = cv.id ORDER BY sort_index LIMIT 6) s) AS skills
         ${from}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?`,
      [...params, perPage, (page - 1) * perPage],
    );

    res.json({
      items: items.map((i) => ({ ...i, skills: i.skills ? i.skills.split(', ') : [] })),
      total,
      page,
      per_page: perPage,
      pages: Math.max(1, Math.ceil(total / perPage)),
    });
  }),
);

export default router;
