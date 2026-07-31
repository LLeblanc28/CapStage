import { applySchema, get, run } from './index.js';
import { config } from '../config.js';

applySchema();

run('INSERT OR IGNORE INTO setting (key, value) VALUES (?, ?)', ['platform_name', config.platformName]);
run('INSERT OR IGNORE INTO setting (key, value) VALUES (?, ?)', ['schema_version', '1']);

const tables = get("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'");
console.log(`[capstage] schema applique sur ${config.dbFile} (${tables.n} tables).`);
