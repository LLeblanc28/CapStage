/**
 * Jeu de donnees de demonstration.
 * Volontairement multi-etablissements et multi-niveaux : la plateforme n'est
 * liee ni a un etablissement particulier ni au BTS.
 *
 *   npm run db:seed
 */
import { applySchema, get, run, transaction } from './index.js';
import { hashPassword } from '../lib/security.js';
import { createCv } from '../services/cv.js';

applySchema();

const DEMO_PASSWORD = 'CapStage2026!';

const establishments = [
  { name: 'Lycee Fulbert', kind: 'lycee', city: 'Chartres' },
  { name: 'Lycee Camille Claudel', kind: 'lycee', city: 'Blois' },
  { name: 'CFA des Metiers du Numerique', kind: 'cfa', city: 'Orleans' },
  { name: 'Universite de Tours', kind: 'universite', city: 'Tours' },
  { name: 'Ecole Superieure de Commerce Centre', kind: 'ecole', city: 'Orleans' },
];

const programs = [
  { est: 'Lycee Fulbert', name: 'BTS SIO option SLAM', level: 'bts', field: 'Informatique', years: 2 },
  { est: 'Lycee Fulbert', name: 'BTS Gestion de la PME', level: 'bts', field: 'Gestion', years: 2 },
  { est: 'Lycee Fulbert', name: 'Bac Pro Systemes Numeriques', level: 'bac_pro', field: 'Electronique', years: 3 },
  { est: 'Lycee Camille Claudel', name: 'Bac Techno STI2D', level: 'bac_techno', field: 'Industrie', years: 2 },
  { est: 'Lycee Camille Claudel', name: 'CAP Electricien', level: 'cap', field: 'Batiment', years: 2 },
  { est: 'CFA des Metiers du Numerique', name: 'Titre Pro Developpeur Web', level: 'titre_pro', field: 'Informatique', years: 1 },
  { est: 'Universite de Tours', name: 'BUT Informatique', level: 'but', field: 'Informatique', years: 3 },
  { est: 'Universite de Tours', name: 'Licence Pro Cybersecurite', level: 'licence_pro', field: 'Informatique', years: 1 },
  { est: 'Universite de Tours', name: 'Master MIAGE', level: 'master', field: 'Informatique', years: 2 },
  { est: 'Ecole Superieure de Commerce Centre', name: 'Bachelor Marketing Digital', level: 'licence', field: 'Commerce', years: 3 },
];

const cohorts = [
  { program: 'BTS SIO option SLAM', label: '1re annee 2025-2026', year: 1 },
  { program: 'BTS SIO option SLAM', label: '2e annee 2025-2026', year: 2 },
  { program: 'BTS Gestion de la PME', label: '1re annee 2025-2026', year: 1 },
  { program: 'Bac Pro Systemes Numeriques', label: 'Terminale 2025-2026', year: 3 },
  { program: 'Bac Techno STI2D', label: 'Premiere 2025-2026', year: 1 },
  { program: 'CAP Electricien', label: '2e annee 2025-2026', year: 2 },
  { program: 'Titre Pro Developpeur Web', label: 'Promo 2026', year: 1 },
  { program: 'BUT Informatique', label: 'BUT2 2025-2026', year: 2 },
  { program: 'Licence Pro Cybersecurite', label: 'Promo 2026', year: 1 },
  { program: 'Master MIAGE', label: 'M1 2025-2026', year: 1 },
  { program: 'Bachelor Marketing Digital', label: 'B3 2025-2026', year: 3 },
];

const people = [
  {
    email: 'admin@capstage.fr',
    first: 'Amina',
    last: 'Berger',
    role: 'admin',
    est: 'Lycee Fulbert',
  },
  {
    email: 'referent.fulbert@capstage.fr',
    first: 'Olivier',
    last: 'Marchand',
    role: 'tutor',
    est: 'Lycee Fulbert',
    cohorts: ['1re annee 2025-2026', '2e annee 2025-2026'],
  },
  {
    email: 'referent.tours@capstage.fr',
    first: 'Nadia',
    last: 'Lefevre',
    role: 'tutor',
    est: 'Universite de Tours',
  },
];

const students = [
  {
    email: 'lea.morel@capstage.fr',
    first: 'Lea',
    last: 'Morel',
    est: 'Lycee Fulbert',
    cohort: '1re annee 2025-2026',
    cv: {
      title: 'CV stage developpement',
      template: 'moderne',
      accent: '#1f6feb',
      headline: 'Etudiante en BTS SIO - recherche stage developpement web',
      summary:
        "Passionnee par le developpement web, je recherche un stage de 6 semaines pour mettre en pratique mes competences en PHP et JavaScript et decouvrir le travail en equipe projet.",
      search_kind: 'stage',
      visibility: 'establishment',
      experiences: [
        {
          kind: 'stage',
          position: 'Stagiaire support informatique',
          organisation: 'Mairie de Chartres',
          city: 'Chartres',
          start_date: '2025-06-02',
          end_date: '2025-06-27',
          description:
            "- Assistance aux utilisateurs (150 postes)\n- Preparation et deploiement de postes Windows\n- Redaction de fiches procedures",
        },
        {
          kind: 'projet',
          position: 'Application de gestion de club sportif',
          organisation: 'Projet scolaire',
          city: 'Chartres',
          start_date: '2025-10-01',
          end_date: '2026-01-15',
          description:
            '- Analyse des besoins et modelisation Merise\n- Developpement PHP / MySQL en binome\n- Recette et documentation utilisateur',
        },
      ],
      educations: [
        {
          degree: 'BTS SIO option SLAM',
          school: 'Lycee Fulbert',
          city: 'Chartres',
          start_date: '2025-09-01',
          current: 1,
        },
        {
          degree: 'Baccalaureat general - specialites NSI et mathematiques',
          school: 'Lycee Marceau',
          city: 'Chartres',
          start_date: '2022-09-01',
          end_date: '2025-07-04',
        },
      ],
      skills: [
        { name: 'PHP', category: 'technique', level: 3 },
        { name: 'JavaScript', category: 'technique', level: 3 },
        { name: 'SQL / MySQL', category: 'technique', level: 4 },
        { name: 'HTML / CSS', category: 'technique', level: 4 },
        { name: 'Git', category: 'logiciel', level: 3 },
        { name: 'Travail en equipe', category: 'transversale', level: 4 },
      ],
      languages: [
        { name: 'Francais', level: 'langue_maternelle' },
        { name: 'Anglais', level: 'B2' },
        { name: 'Espagnol', level: 'A2' },
      ],
      certifications: [{ name: 'PIX - niveau 5', issuer: 'PIX', obtained_at: '2025-05-12' }],
      interests: [{ label: 'Volley-ball en club' }, { label: 'Robotique' }],
      links: [{ label: 'GitHub', url: 'https://github.com/lea-morel' }],
    },
    applications: [
      { company: 'Novatek Solutions', position: 'Stagiaire developpeur web', city: 'Chartres', status: 'entretien', channel: 'mail', sent_at: '2026-02-03' },
      { company: 'Agence Web Pixelo', position: 'Stagiaire integrateur', city: 'Le Mans', status: 'refusee', channel: 'jobboard', sent_at: '2026-02-10' },
      {
        company: 'Groupe Latitude',
        position: 'Stagiaire developpement',
        city: 'Chartres',
        status: 'acceptee',
        channel: 'reseau',
        sent_at: '2026-02-18',
        start_date: '2026-05-18',
        end_date: '2026-06-26',
        company_tutor: 'M. Dupuis',
        visit: {
          comment:
            "Visite realisee en entreprise. Lea est bien integree a l'equipe, elle travaille sur le module de facturation. Le tuteur souligne son autonomie. Point de vigilance : approfondir la redaction de tests.",
          rating: 4,
          visit_date: '2026-06-04',
        },
      },
    ],
  },
  {
    email: 'karim.benali@capstage.fr',
    first: 'Karim',
    last: 'Benali',
    est: 'Universite de Tours',
    cohort: 'BUT2 2025-2026',
    cv: {
      title: 'CV alternance data',
      template: 'classique',
      accent: '#0f766e',
      headline: 'Etudiant BUT Informatique - alternance data / BI',
      summary:
        'Interesse par la donnee et la business intelligence, je recherche une alternance de 12 mois a partir de septembre.',
      search_kind: 'alternance',
      visibility: 'public',
      experiences: [
        {
          kind: 'stage',
          position: 'Stagiaire analyste donnees',
          organisation: 'Cliniques du Val de Loire',
          city: 'Tours',
          start_date: '2025-04-07',
          end_date: '2025-06-13',
          description:
            '- Nettoyage et consolidation de jeux de donnees patients anonymises\n- Creation de tableaux de bord Metabase\n- Presentation des indicateurs a la direction',
        },
      ],
      educations: [
        { degree: 'BUT Informatique', school: 'IUT de Tours', city: 'Tours', start_date: '2024-09-01', current: 1 },
      ],
      skills: [
        { name: 'Python', category: 'technique', level: 4 },
        { name: 'SQL', category: 'technique', level: 4 },
        { name: 'Power BI', category: 'logiciel', level: 3 },
        { name: 'Analyse de donnees', category: 'transversale', level: 4 },
      ],
      languages: [
        { name: 'Francais', level: 'langue_maternelle' },
        { name: 'Anglais', level: 'C1' },
      ],
      interests: [{ label: 'Echecs' }, { label: 'Course a pied' }],
      links: [{ label: 'LinkedIn', url: 'https://www.linkedin.com/in/karim-benali-demo' }],
    },
    applications: [
      { company: 'Assurances Val de Loire', position: 'Alternant data analyst', city: 'Tours', kind: 'alternance', status: 'envoyee', sent_at: '2026-03-02' },
      { company: 'Cliniques du Val de Loire', position: 'Alternant BI', city: 'Tours', kind: 'alternance', status: 'relancee', sent_at: '2026-03-09' },
    ],
  },
  {
    email: 'chloe.dubois@capstage.fr',
    first: 'Chloe',
    last: 'Dubois',
    est: 'CFA des Metiers du Numerique',
    cohort: 'Promo 2026',
    cv: {
      title: 'CV developpeuse web',
      template: 'compact',
      accent: '#b45309',
      headline: 'Titre Pro Developpeur Web - en reconversion',
      summary:
        "Apres 5 ans dans la vente, je me reoriente vers le developpement web. Je recherche une premiere experience professionnelle en equipe.",
      search_kind: 'emploi',
      visibility: 'public',
      experiences: [
        {
          kind: 'experience',
          position: 'Responsable de rayon',
          organisation: 'Enseigne Grand Ouest',
          city: 'Orleans',
          start_date: '2020-01-06',
          end_date: '2025-08-29',
          description: '- Management de 4 personnes\n- Gestion des stocks et des commandes',
        },
      ],
      educations: [
        { degree: 'Titre Professionnel Developpeur Web et Web Mobile', school: 'CFA des Metiers du Numerique', city: 'Orleans', start_date: '2025-09-15', current: 1 },
      ],
      skills: [
        { name: 'JavaScript', category: 'technique', level: 3 },
        { name: 'React', category: 'technique', level: 3 },
        { name: 'Node.js', category: 'technique', level: 2 },
        { name: 'Relation client', category: 'transversale', level: 5 },
      ],
      languages: [{ name: 'Francais', level: 'langue_maternelle' }, { name: 'Anglais', level: 'B1' }],
      interests: [{ label: 'Randonnee' }],
      links: [],
    },
    applications: [
      { company: 'Studio Kodex', position: 'Developpeuse front-end junior', city: 'Orleans', kind: 'emploi', status: 'entretien', sent_at: '2026-04-06' },
    ],
  },
  {
    email: 'tom.girard@capstage.fr',
    first: 'Tom',
    last: 'Girard',
    est: 'Lycee Camille Claudel',
    cohort: '2e annee 2025-2026',
    cv: {
      title: 'CV CAP Electricien',
      template: 'classique',
      accent: '#7c3aed',
      headline: 'CAP Electricien - recherche stage en installation electrique',
      summary: "Serieux et ponctuel, je recherche un stage en entreprise d'installation electrique.",
      search_kind: 'stage',
      visibility: 'establishment',
      experiences: [
        {
          kind: 'stage',
          position: 'Stagiaire electricien',
          organisation: 'Elec Services 41',
          city: 'Blois',
          start_date: '2025-11-17',
          end_date: '2025-12-12',
          description: '- Pose de chemins de cables\n- Raccordement de tableaux divisionnaires',
        },
      ],
      educations: [{ degree: 'CAP Electricien', school: 'Lycee Camille Claudel', city: 'Blois', start_date: '2024-09-01', current: 1 }],
      skills: [
        { name: 'Lecture de plan', category: 'technique', level: 3 },
        { name: 'Habilitation B1V', category: 'technique', level: 3 },
        { name: 'Securite chantier', category: 'transversale', level: 4 },
      ],
      languages: [{ name: 'Francais', level: 'langue_maternelle' }],
      interests: [{ label: 'Mecanique auto' }],
      links: [],
    },
    applications: [
      { company: 'Elec Services 41', position: 'Stagiaire electricien', city: 'Blois', status: 'acceptee', sent_at: '2025-10-06', start_date: '2025-11-17', end_date: '2025-12-12', company_tutor: 'Mme Renard' },
    ],
  },
  {
    email: 'sarah.klein@capstage.fr',
    first: 'Sarah',
    last: 'Klein',
    est: 'Ecole Superieure de Commerce Centre',
    cohort: 'B3 2025-2026',
    cv: {
      title: 'CV marketing digital',
      template: 'moderne',
      accent: '#be185d',
      headline: 'Bachelor Marketing Digital - stage acquisition',
      summary: "Je recherche un stage de fin d'etudes en acquisition digitale (SEA/SEO, reseaux sociaux).",
      search_kind: 'stage',
      visibility: 'public',
      experiences: [
        {
          kind: 'stage',
          position: 'Assistante communication',
          organisation: 'Office de tourisme',
          city: 'Orleans',
          start_date: '2025-06-16',
          end_date: '2025-07-25',
          description: "- Animation des reseaux sociaux (+18% d'abonnes)\n- Redaction de newsletters",
        },
      ],
      educations: [
        { degree: 'Bachelor Marketing Digital', school: 'Ecole Superieure de Commerce Centre', city: 'Orleans', start_date: '2023-09-01', current: 1 },
      ],
      skills: [
        { name: 'SEO', category: 'technique', level: 3 },
        { name: 'Google Ads', category: 'logiciel', level: 3 },
        { name: 'Canva', category: 'logiciel', level: 4 },
        { name: 'Redaction web', category: 'transversale', level: 4 },
      ],
      languages: [
        { name: 'Francais', level: 'langue_maternelle' },
        { name: 'Anglais', level: 'B2' },
        { name: 'Allemand', level: 'B1' },
      ],
      interests: [{ label: 'Photographie' }, { label: 'Podcasts marketing' }],
      links: [{ label: 'Portfolio', url: 'https://sarah-klein-demo.fr' }],
    },
    applications: [
      { company: 'Agence Trafic+', position: 'Stagiaire acquisition', city: 'Tours', status: 'sans_reponse', sent_at: '2026-01-20' },
      { company: 'Maison Berry', position: 'Stagiaire communication', city: 'Bourges', status: 'entretien', sent_at: '2026-02-11' },
    ],
  },
];

async function seed() {
  const hash = await hashPassword(DEMO_PASSWORD);

  transaction(() => {
    const estIds = new Map();
    for (const e of establishments) {
      const existing = get('SELECT id FROM establishment WHERE name = ?', [e.name]);
      const id = existing
        ? existing.id
        : run('INSERT INTO establishment (name, kind, city) VALUES (?, ?, ?)', [e.name, e.kind, e.city])
            .lastInsertRowid;
      estIds.set(e.name, id);
    }

    const programIds = new Map();
    for (const p of programs) {
      const estId = estIds.get(p.est);
      const existing = get('SELECT id FROM program WHERE establishment_id = ? AND name = ?', [estId, p.name]);
      const id = existing
        ? existing.id
        : run(
            'INSERT INTO program (establishment_id, name, level, field, duration_years) VALUES (?, ?, ?, ?, ?)',
            [estId, p.name, p.level, p.field, p.years],
          ).lastInsertRowid;
      programIds.set(p.name, id);
    }

    const cohortIds = new Map();
    for (const c of cohorts) {
      const programId = programIds.get(c.program);
      const existing = get('SELECT id FROM cohort WHERE program_id = ? AND label = ?', [programId, c.label]);
      const id = existing
        ? existing.id
        : run(
            'INSERT INTO cohort (program_id, label, year_level, start_year, end_year) VALUES (?, ?, ?, ?, ?)',
            [programId, c.label, c.year, 2025, 2026],
          ).lastInsertRowid;
      cohortIds.set(`${c.program}|${c.label}`, id);
    }

    const cohortIdByEstLabel = (estName, label) => {
      const entry = cohorts.find(
        (c) => c.label === label && programs.find((p) => p.name === c.program && p.est === estName),
      );
      return entry ? cohortIds.get(`${entry.program}|${entry.label}`) : null;
    };

    for (const person of people) {
      if (get('SELECT id FROM user WHERE email = ?', [person.email])) continue;
      const { lastInsertRowid: userId } = run(
        `INSERT INTO user (email, password_hash, first_name, last_name, role, establishment_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [person.email, hash, person.first, person.last, person.role, estIds.get(person.est)],
      );
      for (const label of person.cohorts || []) {
        const cohortId = cohortIdByEstLabel(person.est, label);
        if (cohortId) run('INSERT OR IGNORE INTO tutor_cohort (tutor_id, cohort_id) VALUES (?, ?)', [userId, cohortId]);
      }
    }

    const tutorFulbert = get('SELECT id FROM user WHERE email = ?', ['referent.fulbert@capstage.fr']);
    const tutorTours = get('SELECT id FROM user WHERE email = ?', ['referent.tours@capstage.fr']);

    for (const student of students) {
      if (get('SELECT id FROM user WHERE email = ?', [student.email])) continue;
      const cohortId = cohortIdByEstLabel(student.est, student.cohort);
      const { lastInsertRowid: userId } = run(
        `INSERT INTO user (email, password_hash, first_name, last_name, role, establishment_id, cohort_id, city)
         VALUES (?, ?, ?, ?, 'student', ?, ?, ?)`,
        [student.email, hash, student.first, student.last, estIds.get(student.est), cohortId, student.cv?.contact_city ?? null],
      );

      const cvId = createCv(userId, {
        ...student.cv,
        contact_email: student.email,
        contact_phone: '06 12 34 56 78',
        contact_city: student.cv.contact_city ?? null,
        searching: 1,
        is_default: 1,
      });

      for (const app of student.applications || []) {
        const { lastInsertRowid: appId } = run(
          `INSERT INTO application (user_id, cv_id, company, position, city, kind, channel, sent_at, status,
                                    start_date, end_date, company_tutor)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            cvId,
            app.company,
            app.position ?? null,
            app.city ?? null,
            app.kind ?? 'stage',
            app.channel ?? 'mail',
            app.sent_at,
            app.status,
            app.start_date ?? null,
            app.end_date ?? null,
            app.company_tutor ?? null,
          ],
        );
        if (app.visit) {
          const authorId = student.est === 'Universite de Tours' ? tutorTours?.id : tutorFulbert?.id;
          run(
            `INSERT INTO visit (application_id, author_id, visit_date, mode, comment, rating, shared_with_student)
             VALUES (?, ?, ?, 'presentiel', ?, ?, 1)`,
            [appId, authorId ?? null, app.visit.visit_date, app.visit.comment, app.visit.rating ?? null],
          );
        }
      }

      run("INSERT INTO event_log (user_id, type) VALUES (?, 'cv_created')", [userId]);
    }
  });

  const counts = get(
    `SELECT (SELECT count(*) FROM user) AS users, (SELECT count(*) FROM cv) AS cvs,
            (SELECT count(*) FROM application) AS applications, (SELECT count(*) FROM establishment) AS ests`,
  );
  console.log('[capstage] donnees de demonstration inserees :', counts);
  console.log(`[capstage] mot de passe commun aux comptes de demo : ${DEMO_PASSWORD}`);
  console.log('[capstage] admin : admin@capstage.fr | referent : referent.fulbert@capstage.fr | etudiante : lea.morel@capstage.fr');
}

seed().catch((err) => {
  console.error('[capstage] echec du seed :', err);
  process.exit(1);
});
