-- ---------------------------------------------------------------------------
-- CapStage - schema de la base centralisee (SQLite)
-- Le modele est volontairement generique : tout etablissement (lycee, CFA,
-- universite, ecole, organisme de formation) et tout niveau de formation
-- (CAP, bac pro, BTS, BUT, licence, master, titre pro...) sont supportes.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS establishment (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  kind          TEXT NOT NULL DEFAULT 'autre',      -- lycee | cfa | universite | ecole | organisme | entreprise | autre
  city          TEXT,
  country       TEXT NOT NULL DEFAULT 'France',
  website       TEXT,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS program (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  establishment_id INTEGER REFERENCES establishment(id) ON DELETE CASCADE, -- NULL = formation generique
  name             TEXT NOT NULL,                    -- ex: "BTS SIO", "Licence Informatique", "Bac Pro MELEC"
  level            TEXT NOT NULL DEFAULT 'autre',    -- college|cap|bac_pro|bac_techno|bac_general|bts|but|licence|licence_pro|master|ingenieur|doctorat|titre_pro|autre
  field            TEXT,                             -- domaine : informatique, commerce, sante...
  duration_years   REAL NOT NULL DEFAULT 2,
  internship_required INTEGER NOT NULL DEFAULT 1,
  active           INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (establishment_id, name)
);

CREATE TABLE IF NOT EXISTS cohort (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id  INTEGER NOT NULL REFERENCES program(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,                          -- ex: "1re annee 2025-2026"
  year_level  INTEGER NOT NULL DEFAULT 1,             -- 1 = 1re annee, 2 = 2e annee...
  start_year  INTEGER,
  end_year    INTEGER,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (program_id, label)
);

CREATE TABLE IF NOT EXISTS user (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  email            TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash    TEXT NOT NULL,
  first_name       TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'student',   -- student | tutor | admin
  establishment_id INTEGER REFERENCES establishment(id) ON DELETE SET NULL,
  cohort_id        INTEGER REFERENCES cohort(id) ON DELETE SET NULL,
  phone            TEXT,
  city             TEXT,
  birthdate        TEXT,
  active           INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until     TEXT,
  last_login_at    TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Rattachement d'un referent (role tutor) a une ou plusieurs promotions.
-- Sans rattachement, le referent voit toute sa structure.
CREATE TABLE IF NOT EXISTS tutor_cohort (
  tutor_id  INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  cohort_id INTEGER NOT NULL REFERENCES cohort(id) ON DELETE CASCADE,
  PRIMARY KEY (tutor_id, cohort_id)
);

CREATE TABLE IF NOT EXISTS cv (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  title         TEXT NOT NULL DEFAULT 'Mon CV',
  template      TEXT NOT NULL DEFAULT 'classique',   -- classique | moderne | compact
  accent        TEXT NOT NULL DEFAULT '#1f6feb',
  headline      TEXT,                                 -- accroche / intitule vise
  summary       TEXT,                                 -- profil / a propos
  photo_path    TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_city  TEXT,
  birthdate     TEXT,
  driving_license TEXT,
  mobility      TEXT,
  visibility    TEXT NOT NULL DEFAULT 'establishment', -- private | establishment | public
  searching     INTEGER NOT NULL DEFAULT 1,
  search_kind   TEXT NOT NULL DEFAULT 'stage',        -- stage | alternance | emploi | job_etudiant
  available_from TEXT,
  is_default    INTEGER NOT NULL DEFAULT 0,
  views         INTEGER NOT NULL DEFAULT 0,
  pdf_exports   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cv_experience (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  cv_id        INTEGER NOT NULL REFERENCES cv(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL DEFAULT 'experience',   -- experience | stage | alternance | projet | benevolat
  position     TEXT NOT NULL,
  organisation TEXT,
  city         TEXT,
  start_date   TEXT,
  end_date     TEXT,
  current      INTEGER NOT NULL DEFAULT 0,
  description  TEXT,
  sort_index   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cv_education (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cv_id       INTEGER NOT NULL REFERENCES cv(id) ON DELETE CASCADE,
  degree      TEXT NOT NULL,
  school      TEXT,
  city        TEXT,
  start_date  TEXT,
  end_date    TEXT,
  current     INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  sort_index  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cv_skill (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cv_id      INTEGER NOT NULL REFERENCES cv(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'technique',      -- technique | transversale | logiciel | autre
  level      INTEGER NOT NULL DEFAULT 3,             -- 1 a 5
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cv_language (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cv_id      INTEGER NOT NULL REFERENCES cv(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  level      TEXT NOT NULL DEFAULT 'B1',             -- A1..C2 | langue_maternelle
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cv_certification (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cv_id       INTEGER NOT NULL REFERENCES cv(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  issuer      TEXT,
  obtained_at TEXT,
  url         TEXT,
  sort_index  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cv_interest (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cv_id      INTEGER NOT NULL REFERENCES cv(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cv_link (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  cv_id      INTEGER NOT NULL REFERENCES cv(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  url        TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0
);

-- Suivi de la recherche de stage / alternance / emploi
CREATE TABLE IF NOT EXISTS application (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  cv_id         INTEGER REFERENCES cv(id) ON DELETE SET NULL,
  company       TEXT NOT NULL,
  position      TEXT,
  city          TEXT,
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  kind          TEXT NOT NULL DEFAULT 'stage',       -- stage | alternance | emploi | job_etudiant
  channel       TEXT NOT NULL DEFAULT 'mail',        -- mail | courrier | telephone | sur_place | jobboard | reseau | forum | autre
  sent_at       TEXT NOT NULL DEFAULT (date('now')),
  status        TEXT NOT NULL DEFAULT 'envoyee',     -- envoyee | relancee | entretien | acceptee | refusee | sans_reponse
  start_date    TEXT,
  end_date      TEXT,
  company_tutor TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Commentaires de visite de stage (saisis par le referent / l'administrateur)
CREATE TABLE IF NOT EXISTS visit (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES application(id) ON DELETE CASCADE,
  author_id      INTEGER REFERENCES user(id) ON DELETE SET NULL,
  visit_date     TEXT NOT NULL DEFAULT (date('now')),
  mode           TEXT NOT NULL DEFAULT 'presentiel', -- presentiel | visio | telephone
  comment        TEXT NOT NULL,
  rating         INTEGER,                            -- 1 a 5, facultatif
  shared_with_student INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Journal d'activite : alimente le tableau de bord et la tracabilite
CREATE TABLE IF NOT EXISTS event_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES user(id) ON DELETE SET NULL,
  type       TEXT NOT NULL,
  meta       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS setting (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_establishment ON user(establishment_id);
CREATE INDEX IF NOT EXISTS idx_user_cohort        ON user(cohort_id);
CREATE INDEX IF NOT EXISTS idx_program_estab      ON program(establishment_id);
CREATE INDEX IF NOT EXISTS idx_cohort_program     ON cohort(program_id);
CREATE INDEX IF NOT EXISTS idx_cv_user            ON cv(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_visibility      ON cv(visibility);
CREATE INDEX IF NOT EXISTS idx_exp_cv             ON cv_experience(cv_id);
CREATE INDEX IF NOT EXISTS idx_edu_cv             ON cv_education(cv_id);
CREATE INDEX IF NOT EXISTS idx_skill_cv           ON cv_skill(cv_id);
CREATE INDEX IF NOT EXISTS idx_lang_cv            ON cv_language(cv_id);
CREATE INDEX IF NOT EXISTS idx_cert_cv            ON cv_certification(cv_id);
CREATE INDEX IF NOT EXISTS idx_interest_cv        ON cv_interest(cv_id);
CREATE INDEX IF NOT EXISTS idx_link_cv            ON cv_link(cv_id);
CREATE INDEX IF NOT EXISTS idx_app_user           ON application(user_id);
CREATE INDEX IF NOT EXISTS idx_app_status         ON application(status);
CREATE INDEX IF NOT EXISTS idx_visit_app          ON visit(application_id);
CREATE INDEX IF NOT EXISTS idx_event_type         ON event_log(type);
CREATE INDEX IF NOT EXISTS idx_event_created      ON event_log(created_at);
