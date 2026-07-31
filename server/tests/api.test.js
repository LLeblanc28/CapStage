/**
 * Tests d'integration de l'API (node --test).
 * Une base SQLite dediee est creee dans data/test, puis supprimee a la fin.
 *
 *   npm test
 */
import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = 'data/test';
process.env.DB_FILE = `test-${Date.now()}.sqlite`;
process.env.JWT_SECRET = 'test-secret-capstage';

const { config } = await import('../src/config.js');
const { createApp } = await import('../src/app.js');
const { run, get, closeDb } = await import('../src/db/index.js');
const { hashPassword } = await import('../src/lib/security.js');

const app = createApp({ rateLimits: false });
let server;
let baseUrl;

/** Mini client HTTP conservant les cookies (session + CSRF). */
function createClient() {
  const jar = new Map();
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

  async function request(method, url, body, options = {}) {
    const headers = { cookie: cookieHeader() };
    if (jar.has('capstage_csrf')) headers['x-csrf-token'] = jar.get('capstage_csrf');
    if (body !== undefined) headers['content-type'] = 'application/json';

    const res = await fetch(`${baseUrl}${url}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });

    for (const raw of res.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const idx = pair.indexOf('=');
      jar.set(pair.slice(0, idx), pair.slice(idx + 1));
    }

    if (options.raw) return res;
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, body: json };
  }

  return {
    jar,
    get: (url, options) => request('GET', url, undefined, options),
    post: (url, body, options) => request('POST', url, body ?? {}, options),
    put: (url, body) => request('PUT', url, body ?? {}),
    patch: (url, body) => request('PATCH', url, body ?? {}),
    del: (url) => request('DELETE', url),
  };
}

const emptyCv = {
  title: 'CV de test',
  template: 'moderne',
  accent: '#1f6feb',
  visibility: 'establishment',
  searching: true,
  search_kind: 'stage',
};

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(`${config.dbFile}${suffix}`, { force: true });
    } catch {
      /* fichier encore verrouille par le systeme : sans consequence */
    }
  }
});

describe('sante et referentiel', () => {
  test('GET /api/health repond ok', async () => {
    const client = createClient();
    const res = await client.get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  test('le referentiel est lisible sans compte', async () => {
    const client = createClient();
    const res = await client.get('/api/referentiel/meta');
    assert.equal(res.status, 200);
    assert.ok(res.body.levels.length > 5, 'plusieurs niveaux de formation sont proposes');
    assert.ok(res.body.levels.some((l) => l.value === 'bts'));
    assert.ok(res.body.levels.some((l) => l.value === 'master'));
  });
});

describe('authentification', () => {
  test('refuse un mot de passe trop faible', async () => {
    const client = createClient();
    await client.get('/api/auth/me');
    const res = await client.post('/api/auth/register', {
      email: 'faible@test.fr',
      password: 'motdepasse',
      first_name: 'Test',
      last_name: 'Faible',
    });
    assert.equal(res.status, 400);
  });

  test('inscription puis session active', async () => {
    const client = createClient();
    await client.get('/api/auth/me');
    const res = await client.post('/api/auth/register', {
      email: 'etudiant@test.fr',
      password: 'MotDePasse123',
      first_name: 'Eva',
      last_name: 'Testeur',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'student');

    const me = await client.get('/api/auth/me');
    assert.equal(me.body.user.email, 'etudiant@test.fr');

    // un CV vierge est cree automatiquement
    const cvs = await client.get('/api/cvs');
    assert.equal(cvs.body.items.length, 1);
  });

  test('rejette une requete sans jeton CSRF', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'etudiant@test.fr', password: 'MotDePasse123' }),
    });
    assert.equal(res.status, 403);
  });

  test('refuse un mauvais mot de passe', async () => {
    const client = createClient();
    await client.get('/api/auth/me');
    const res = await client.post('/api/auth/login', {
      email: 'etudiant@test.fr',
      password: 'MauvaisMotDePasse1',
    });
    assert.equal(res.status, 401);
  });
});

describe('CV et export PDF', () => {
  let client;
  let cvId;

  before(async () => {
    client = createClient();
    await client.get('/api/auth/me');
    await client.post('/api/auth/register', {
      email: 'cv@test.fr',
      password: 'MotDePasse123',
      first_name: 'Lina',
      last_name: 'Dupont',
    });
    const cvs = await client.get('/api/cvs');
    cvId = cvs.body.items[0].id;
  });

  test('enregistre un CV complet avec ses sections', async () => {
    const res = await client.put(`/api/cvs/${cvId}`, {
      ...emptyCv,
      headline: 'Recherche stage developpement',
      summary: 'Profil de test',
      experiences: [
        {
          kind: 'stage',
          position: 'Stagiaire developpeur',
          organisation: 'Entreprise Test',
          start_date: '2025-06-02',
          end_date: '2025-06-27',
          description: '- Une mission\n- Une autre mission',
        },
      ],
      skills: [{ name: 'SQL', category: 'technique', level: 4 }],
      languages: [{ name: 'Anglais', level: 'B2' }],
      links: [{ label: 'GitHub', url: 'https://github.com/test' }],
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.cv.experiences.length, 1);
    assert.equal(res.body.cv.skills[0].name, 'SQL');
  });

  test('refuse un lien non http(s)', async () => {
    const res = await client.put(`/api/cvs/${cvId}`, {
      ...emptyCv,
      links: [{ label: 'Mauvais', url: 'javascript:alert(1)' }],
    });
    assert.equal(res.status, 400);
  });

  test('genere un PDF pour chaque modele', async () => {
    for (const template of ['classique', 'moderne', 'compact']) {
      const res = await client.get(`/api/cvs/${cvId}/pdf?template=${template}`, { raw: true });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'application/pdf');
      const buffer = Buffer.from(await res.arrayBuffer());
      assert.equal(buffer.subarray(0, 4).toString(), '%PDF', `modele ${template}`);
      assert.ok(buffer.length > 1000, `le PDF ${template} n'est pas vide`);
    }
  });

  test('un autre etudiant ne peut pas modifier ce CV', async () => {
    const other = createClient();
    await other.get('/api/auth/me');
    await other.post('/api/auth/register', {
      email: 'intrus@test.fr',
      password: 'MotDePasse123',
      first_name: 'Intrus',
      last_name: 'Test',
    });
    const res = await other.put(`/api/cvs/${cvId}`, emptyCv);
    assert.equal(res.status, 403);
  });

  test('duplique un CV', async () => {
    const res = await client.post(`/api/cvs/${cvId}/duplicate`);
    assert.equal(res.status, 201);
    assert.match(res.body.cv.title, /copie/);
    const list = await client.get('/api/cvs');
    assert.equal(list.body.items.length, 2);
  });
});

describe('suivi des candidatures et visites', () => {
  let student;
  let tutor;
  let applicationId;

  before(async () => {
    const estId = run('INSERT INTO establishment (name, kind, city) VALUES (?, ?, ?)', [
      'Etablissement Test',
      'ecole',
      'Ville',
    ]).lastInsertRowid;
    const programId = run('INSERT INTO program (establishment_id, name, level) VALUES (?, ?, ?)', [
      estId,
      'Master Test',
      'master',
    ]).lastInsertRowid;
    const cohortId = run('INSERT INTO cohort (program_id, label, year_level) VALUES (?, ?, 1)', [
      programId,
      'M1 Test',
    ]).lastInsertRowid;

    run(
      `INSERT INTO user (email, password_hash, first_name, last_name, role, establishment_id)
       VALUES (?, ?, 'Referent', 'Test', 'tutor', ?)`,
      ['tuteur@test.fr', await hashPassword('MotDePasse123'), estId],
    );

    student = createClient();
    await student.get('/api/auth/me');
    await student.post('/api/auth/register', {
      email: 'suivi@test.fr',
      password: 'MotDePasse123',
      first_name: 'Sam',
      last_name: 'Suivi',
      establishment_id: estId,
      cohort_id: cohortId,
    });

    tutor = createClient();
    await tutor.get('/api/auth/me');
    await tutor.post('/api/auth/login', { email: 'tuteur@test.fr', password: 'MotDePasse123' });
  });

  test("l'etudiant enregistre une candidature", async () => {
    const res = await student.post('/api/applications', {
      company: 'Entreprise Alpha',
      position: 'Stagiaire',
      city: 'Tours',
      kind: 'stage',
      channel: 'mail',
      sent_at: '2026-03-02',
      status: 'envoyee',
    });
    assert.equal(res.status, 201);
    applicationId = res.body.application.id;

    const stats = await student.get('/api/applications/stats');
    assert.equal(stats.body.total, 1);
  });

  test("l'etudiant ne peut pas saisir de compte rendu de visite", async () => {
    const res = await student.post(`/api/applications/${applicationId}/visits`, {
      comment: 'Tentative interdite',
    });
    assert.equal(res.status, 403);
  });

  test('le referent voit ses etudiants et saisit une visite', async () => {
    const students = await tutor.get('/api/tutor/students');
    assert.equal(students.status, 200);
    assert.ok(students.body.items.some((s) => s.email === 'suivi@test.fr'));

    const res = await tutor.post(`/api/applications/${applicationId}/visits`, {
      visit_date: '2026-05-12',
      mode: 'presentiel',
      comment: 'Visite realisee, integration satisfaisante.',
      rating: 4,
      shared_with_student: true,
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.visits.length, 1);

    const overview = await tutor.get('/api/tutor/overview');
    assert.ok(overview.body.students >= 1);
  });

  test("le referent ne voit pas les etudiants d'un autre etablissement", async () => {
    const res = await tutor.get('/api/tutor/students');
    assert.ok(!res.body.items.some((s) => s.email === 'cv@test.fr'));
  });

  test('un commentaire non partage reste invisible pour l etudiant', async () => {
    await tutor.post(`/api/applications/${applicationId}/visits`, {
      comment: 'Note interne reservee a l equipe pedagogique.',
      shared_with_student: false,
    });
    const seenByTutor = await tutor.get(`/api/applications/${applicationId}`);
    assert.equal(seenByTutor.body.visits.length, 2);

    const seenByStudent = await student.get(`/api/applications/${applicationId}`);
    assert.equal(seenByStudent.body.visits.length, 1);
  });
});

describe('annuaire des CV', () => {
  test('respecte la visibilite choisie par l etudiant', async () => {
    const client = createClient();
    await client.get('/api/auth/me');
    await client.post('/api/auth/register', {
      email: 'prive@test.fr',
      password: 'MotDePasse123',
      first_name: 'Prive',
      last_name: 'Test',
    });
    const cvs = await client.get('/api/cvs');
    await client.put(`/api/cvs/${cvs.body.items[0].id}`, {
      ...emptyCv,
      title: 'CV confidentiel',
      visibility: 'private',
    });

    const other = createClient();
    await other.get('/api/auth/me');
    await other.post('/api/auth/login', { email: 'cv@test.fr', password: 'MotDePasse123' });
    const res = await other.get('/api/directory?q=confidentiel');
    assert.equal(res.body.items.length, 0);
  });

  test('trouve un CV public par competence', async () => {
    const client = createClient();
    await client.get('/api/auth/me');
    await client.post('/api/auth/register', {
      email: 'public@test.fr',
      password: 'MotDePasse123',
      first_name: 'Publique',
      last_name: 'Test',
    });
    const cvs = await client.get('/api/cvs');
    await client.put(`/api/cvs/${cvs.body.items[0].id}`, {
      ...emptyCv,
      visibility: 'public',
      skills: [{ name: 'Kubernetes', category: 'technique', level: 4 }],
    });

    const other = createClient();
    await other.get('/api/auth/me');
    await other.post('/api/auth/login', { email: 'cv@test.fr', password: 'MotDePasse123' });
    const res = await other.get('/api/directory?skill=kubernetes');
    assert.equal(res.body.total, 1);
    assert.equal(res.body.items[0].first_name, 'Publique');
  });
});

describe('administration', () => {
  let admin;

  before(async () => {
    run(
      `INSERT INTO user (email, password_hash, first_name, last_name, role)
       VALUES (?, ?, 'Admin', 'Test', 'admin')`,
      ['admin@test.fr', await hashPassword('MotDePasse123')],
    );
    admin = createClient();
    await admin.get('/api/auth/me');
    await admin.post('/api/auth/login', { email: 'admin@test.fr', password: 'MotDePasse123' });
  });

  test('un etudiant n a pas acces aux statistiques', async () => {
    const client = createClient();
    await client.get('/api/auth/me');
    await client.post('/api/auth/login', { email: 'cv@test.fr', password: 'MotDePasse123' });
    const res = await client.get('/api/admin/stats');
    assert.equal(res.status, 403);
  });

  test('le tableau de bord agrege les indicateurs', async () => {
    const res = await admin.get('/api/admin/stats');
    assert.equal(res.status, 200);
    assert.ok(res.body.totals.users > 0);
    assert.ok(res.body.totals.cvs > 0);
    assert.ok(Array.isArray(res.body.top_skills));
  });

  test('la repartition par niveau reste juste quand deux promotions portent le meme libelle', async () => {
    // Regression : un GROUP BY sur l'alias "label" etait resolu vers cohort.label,
    // ce qui fusionnait deux niveaux differents portant le meme libelle de promotion.
    const makeStudent = async (email, level) => {
      const estId = run('INSERT INTO establishment (name) VALUES (?)', [`Etab ${email}`]).lastInsertRowid;
      const programId = run('INSERT INTO program (establishment_id, name, level) VALUES (?, ?, ?)', [
        estId,
        `Formation ${level}`,
        level,
      ]).lastInsertRowid;
      const cohortId = run('INSERT INTO cohort (program_id, label) VALUES (?, ?)', [
        programId,
        '2e annee 2025-2026',
      ]).lastInsertRowid;
      run(
        `INSERT INTO user (email, password_hash, first_name, last_name, role, establishment_id, cohort_id)
         VALUES (?, ?, 'Niveau', 'Test', 'student', ?, ?)`,
        [email, await hashPassword('MotDePasse123'), estId, cohortId],
      );
    };
    await makeStudent('niveau-cap@test.fr', 'cap');
    await makeStudent('niveau-bts@test.fr', 'bts');

    const res = await admin.get('/api/admin/stats');
    const levels = res.body.users_by_level;
    assert.equal(new Set(levels.map((l) => l.label)).size, levels.length, 'un niveau apparait une seule fois');
    assert.ok(levels.find((l) => l.label === 'cap')?.n >= 1);
    assert.ok(levels.find((l) => l.label === 'bts')?.n >= 1);
  });

  test('import CSV d utilisateurs', async () => {
    const csv = [
      'email;prenom;nom;role;etablissement',
      'import1@test.fr;Alex;Import;student;Etablissement Importe',
      'import2@test.fr;Bea;Import;tutor;Etablissement Importe',
      'mauvais-email;Sans;Mail;student;Etablissement Importe',
    ].join('\n');
    const res = await admin.post('/api/admin/users/import', { csv });
    assert.equal(res.status, 200);
    assert.equal(res.body.created.length, 2);
    assert.equal(res.body.errors.length, 1);
    assert.ok(res.body.created[0].temp_password.length >= 10);
    assert.ok(get('SELECT id FROM establishment WHERE name = ?', ['Etablissement Importe']));
  });

  test('export CSV des CV', async () => {
    const res = await admin.get('/api/admin/export/cvs.csv', { raw: true });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    const text = await res.text();
    assert.match(text, /Nom;Prenom;Email/);
  });

  test('creation d une formation de niveau licence', async () => {
    const est = await admin.post('/api/admin/establishments', {
      name: 'Universite Admin Test',
      kind: 'universite',
      city: 'Paris',
    });
    assert.equal(est.status, 201);
    const program = await admin.post('/api/admin/programs', {
      establishment_id: est.body.id,
      name: 'Licence Histoire',
      level: 'licence',
      duration_years: 3,
    });
    assert.equal(program.status, 201);
    const cohort = await admin.post('/api/admin/cohorts', {
      program_id: program.body.id,
      label: 'L3 2025-2026',
      year_level: 3,
    });
    assert.equal(cohort.status, 201);

    const list = await admin.get('/api/referentiel/programs');
    assert.ok(list.body.items.some((p) => p.name === 'Licence Histoire' && p.level === 'licence'));
  });

  test('un admin ne peut pas se retirer son propre role', async () => {
    const me = await admin.get('/api/auth/me');
    const res = await admin.patch(`/api/admin/users/${me.body.user.id}`, { role: 'student' });
    assert.equal(res.status, 400);
  });
});

test('les fichiers de donnees restent dans le repertoire dedie', () => {
  assert.ok(config.dbFile.includes(`${path.sep}test${path.sep}`));
});
