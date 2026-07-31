/** Supprime le fichier de base puis recree le schema (developpement uniquement). */
import fs from 'node:fs';
import { config } from '../config.js';

if (config.env === 'production') {
  console.error('[capstage] db:reset est interdit en production.');
  process.exit(1);
}

for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(`${config.dbFile}${suffix}`, { force: true });
}

const { applySchema } = await import('./index.js');
applySchema();
console.log(`[capstage] base reinitialisee : ${config.dbFile}`);
