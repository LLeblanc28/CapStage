import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { get, logEvent, run } from '../db/index.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../lib/errors.js';
import { cvSchema } from '../lib/schemas.js';
import { randomToken } from '../lib/security.js';
import {
  canReadCv,
  canWriteCv,
  createCv,
  deleteCv,
  duplicateCv,
  getCvFull,
  getCvRow,
  listCvsForUser,
  setDefaultCv,
  updateCv,
} from '../services/cv.js';
import { renderCvPdf } from '../services/pdf/index.js';
import { safeFileName } from '../services/pdf/helpers.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxPhotoBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(new Error('Formats acceptes : JPEG ou PNG'));
      return;
    }
    cb(null, true);
  },
});

function loadOwned(req) {
  const cv = getCvRow(Number(req.params.id));
  if (!cv) throw notFound('CV introuvable');
  if (!canWriteCv(req.user, cv)) throw forbidden("Ce CV ne vous appartient pas");
  return cv;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ items: listCvsForUser(req.user.id) });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = cvSchema.parse(req.body);
    const count = get('SELECT count(*) AS n FROM cv WHERE user_id = ?', [req.user.id]).n;
    if (count >= 10) throw badRequest('Limite de 10 CV par compte atteinte');
    const id = createCv(req.user.id, data);
    logEvent(req.user.id, 'cv_created', { cv_id: id });
    res.status(201).json({ cv: getCvFull(id) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const cv = getCvFull(Number(req.params.id));
    if (!cv) throw notFound('CV introuvable');
    if (!canReadCv(req.user, cv)) throw forbidden('Ce CV ne vous est pas accessible');
    if (cv.user_id !== req.user.id) {
      run('UPDATE cv SET views = views + 1 WHERE id = ?', [cv.id]);
    }
    res.json({ cv, editable: canWriteCv(req.user, cv) });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = loadOwned(req);
    const data = cvSchema.parse(req.body);
    updateCv(existing.id, existing.user_id, data);
    logEvent(req.user.id, 'cv_updated', { cv_id: existing.id });
    res.json({ cv: getCvFull(existing.id) });
  }),
);

router.post(
  '/:id/duplicate',
  asyncHandler(async (req, res) => {
    const existing = loadOwned(req);
    const id = duplicateCv(existing.id, existing.user_id);
    logEvent(req.user.id, 'cv_duplicated', { source: existing.id, cv_id: id });
    res.status(201).json({ cv: getCvFull(id) });
  }),
);

router.post(
  '/:id/default',
  asyncHandler(async (req, res) => {
    const existing = loadOwned(req);
    setDefaultCv(existing.user_id, existing.id);
    res.json({ items: listCvsForUser(existing.user_id) });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = loadOwned(req);
    if (existing.photo_path) {
      fs.rmSync(path.join(config.uploadDir, path.basename(existing.photo_path)), { force: true });
    }
    deleteCv(existing.id, existing.user_id);
    logEvent(req.user.id, 'cv_deleted', { cv_id: existing.id });
    res.json({ ok: true });
  }),
);

router.post(
  '/:id/photo',
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    const existing = loadOwned(req);
    if (!req.file) throw badRequest('Aucun fichier recu');
    const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg';
    const name = `cv${existing.id}-${randomToken(8)}${ext}`;
    fs.writeFileSync(path.join(config.uploadDir, name), req.file.buffer);
    if (existing.photo_path) {
      fs.rmSync(path.join(config.uploadDir, path.basename(existing.photo_path)), { force: true });
    }
    run("UPDATE cv SET photo_path = ?, updated_at = datetime('now') WHERE id = ?", [name, existing.id]);
    res.json({ photo_path: name });
  }),
);

router.delete(
  '/:id/photo',
  asyncHandler(async (req, res) => {
    const existing = loadOwned(req);
    if (existing.photo_path) {
      fs.rmSync(path.join(config.uploadDir, path.basename(existing.photo_path)), { force: true });
    }
    run("UPDATE cv SET photo_path = NULL, updated_at = datetime('now') WHERE id = ?", [existing.id]);
    res.json({ ok: true });
  }),
);

/** Export PDF : accessible a toute personne autorisee a lire le CV. */
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const cv = getCvFull(Number(req.params.id));
    if (!cv) throw notFound('CV introuvable');
    if (!canReadCv(req.user, cv)) throw forbidden('Ce CV ne vous est pas accessible');

    const template = ['classique', 'moderne', 'compact'].includes(req.query.template)
      ? req.query.template
      : cv.template;

    run('UPDATE cv SET pdf_exports = pdf_exports + 1 WHERE id = ?', [cv.id]);
    logEvent(req.user.id, 'cv_exported', { cv_id: cv.id, template });

    const fileName = `CV-${safeFileName(`${cv.first_name}-${cv.last_name}`)}.pdf`;
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
    renderCvPdf({ ...cv, template }).pipe(res);
  }),
);

export default router;
