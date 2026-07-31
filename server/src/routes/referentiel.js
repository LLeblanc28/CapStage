import { Router } from 'express';
import { all } from '../db/index.js';
import { asyncHandler } from '../lib/errors.js';
import {
  APPLICATION_STATUS,
  CHANNELS,
  ESTABLISHMENT_KINDS,
  EXPERIENCE_KINDS,
  LANGUAGE_LEVELS,
  LEVELS,
  SEARCH_KINDS,
  SKILL_CATEGORIES,
  TEMPLATES,
  VISIBILITIES,
  VISIT_MODES,
} from '../lib/schemas.js';
import { LEVEL_LABELS } from '../lib/serialize.js';

const router = Router();

/** Referentiel en lecture : accessible sans compte (necessaire a l'inscription). */

router.get(
  '/establishments',
  asyncHandler(async (_req, res) => {
    res.json({
      items: all(
        `SELECT e.id, e.name, e.kind, e.city, e.country, e.website,
                (SELECT count(*) FROM program p WHERE p.establishment_id = e.id) AS program_count
           FROM establishment e WHERE e.active = 1 ORDER BY e.name`,
      ),
    });
  }),
);

router.get(
  '/programs',
  asyncHandler(async (req, res) => {
    const params = [];
    let where = 'p.active = 1';
    if (req.query.establishment_id) {
      where += ' AND (p.establishment_id = ? OR p.establishment_id IS NULL)';
      params.push(Number(req.query.establishment_id));
    }
    if (req.query.level) {
      where += ' AND p.level = ?';
      params.push(String(req.query.level));
    }
    res.json({
      items: all(
        `SELECT p.*, e.name AS establishment_name
           FROM program p LEFT JOIN establishment e ON e.id = p.establishment_id
          WHERE ${where} ORDER BY e.name, p.name`,
        params,
      ),
    });
  }),
);

router.get(
  '/cohorts',
  asyncHandler(async (req, res) => {
    const params = [];
    let where = 'c.active = 1';
    if (req.query.program_id) {
      where += ' AND c.program_id = ?';
      params.push(Number(req.query.program_id));
    }
    if (req.query.establishment_id) {
      where += ' AND p.establishment_id = ?';
      params.push(Number(req.query.establishment_id));
    }
    res.json({
      items: all(
        `SELECT c.*, p.name AS program_name, p.level AS program_level,
                p.establishment_id, e.name AS establishment_name
           FROM cohort c
           JOIN program p            ON p.id = c.program_id
           LEFT JOIN establishment e ON e.id = p.establishment_id
          WHERE ${where}
          ORDER BY e.name, p.name, c.year_level, c.label`,
        params,
      ),
    });
  }),
);

router.get('/meta', (_req, res) => {
  res.json({
    levels: LEVELS.map((value) => ({ value, label: LEVEL_LABELS[value] || value })),
    establishment_kinds: ESTABLISHMENT_KINDS,
    templates: TEMPLATES,
    visibilities: VISIBILITIES,
    search_kinds: SEARCH_KINDS,
    application_status: APPLICATION_STATUS,
    channels: CHANNELS,
    experience_kinds: EXPERIENCE_KINDS,
    skill_categories: SKILL_CATEGORIES,
    language_levels: LANGUAGE_LEVELS,
    visit_modes: VISIT_MODES,
  });
});

export default router;
