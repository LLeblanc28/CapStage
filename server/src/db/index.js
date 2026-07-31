import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });

export const db = new DatabaseSync(config.dbFile);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

/** Cree les tables si necessaire (idempotent). */
export function applySchema() {
  const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  db.exec(sql);
}

/** node:sqlite n'accepte ni booleen ni undefined : on normalise les parametres. */
function bind(params) {
  return params.map((value) => {
    if (value === true) return 1;
    if (value === false) return 0;
    if (value === undefined) return null;
    return value;
  });
}

export function all(sql, params = []) {
  return db.prepare(sql).all(...bind(params));
}

export function get(sql, params = []) {
  return db.prepare(sql).get(...bind(params));
}

export function run(sql, params = []) {
  const res = db.prepare(sql).run(...bind(params));
  return { changes: Number(res.changes), lastInsertRowid: Number(res.lastInsertRowid) };
}

let depth = 0;

/**
 * Execute une fonction dans une transaction (rollback en cas d'erreur).
 * Les appels imbriques utilisent des SAVEPOINT : une transaction interne qui
 * echoue n'annule que sa propre portion de travail.
 */
export function transaction(fn) {
  const nested = depth > 0;
  const name = `sp_${depth}`;
  db.exec(nested ? `SAVEPOINT ${name}` : 'BEGIN');
  depth += 1;
  try {
    const result = fn();
    db.exec(nested ? `RELEASE ${name}` : 'COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec(nested ? `ROLLBACK TO ${name}` : 'ROLLBACK');
      if (nested) db.exec(`RELEASE ${name}`);
    } catch {
      /* transaction deja terminee */
    }
    throw err;
  } finally {
    depth -= 1;
  }
}

/** Ferme la base (arret propre, tests). */
export function closeDb() {
  try {
    db.close();
  } catch {
    /* deja fermee */
  }
}

export function logEvent(userId, type, meta = null) {
  run('INSERT INTO event_log (user_id, type, meta) VALUES (?, ?, ?)', [
    userId ?? null,
    type,
    meta ? JSON.stringify(meta) : null,
  ]);
}
