import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env') });

const dataDir = process.env.DATA_DIR
  ? path.resolve(ROOT_DIR, process.env.DATA_DIR)
  : path.join(ROOT_DIR, 'data');

const uploadDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  dataDir,
  uploadDir,
  dbFile: path.join(dataDir, process.env.DB_FILE || 'capstage.sqlite'),
  clientDist: path.join(ROOT_DIR, 'client', 'dist'),
  /**
   * En production le secret DOIT etre fourni par l'environnement.
   * En developpement on retombe sur une valeur locale pour ne pas bloquer le demarrage.
   */
  jwtSecret: process.env.JWT_SECRET || 'capstage-dev-secret-change-me',
  sessionHours: Number(process.env.SESSION_HOURS || 12),
  cookieName: 'capstage_session',
  csrfCookieName: 'capstage_csrf',
  maxPhotoBytes: Number(process.env.MAX_PHOTO_BYTES || 1_500_000),
  platformName: process.env.PLATFORM_NAME || 'CapStage',
  /**
   * Insere le jeu de demonstration au demarrage s'il est absent.
   * Utile sur un hebergement au disque ephemere (vitrine, demonstration).
   * A laisser a false sur une installation reelle : les comptes de demo
   * ont un mot de passe public.
   */
  seedOnStart: process.env.SEED_ON_START === 'true',
};

if (config.env === 'production' && config.jwtSecret === 'capstage-dev-secret-change-me') {
  console.error('[capstage] JWT_SECRET doit etre defini en production (voir .env.example).');
  process.exit(1);
}
