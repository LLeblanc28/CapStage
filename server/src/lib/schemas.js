import { z } from 'zod';

export const LEVELS = [
  'college',
  'cap',
  'bac_pro',
  'bac_techno',
  'bac_general',
  'bts',
  'but',
  'licence',
  'licence_pro',
  'master',
  'ingenieur',
  'doctorat',
  'titre_pro',
  'autre',
];

export const ESTABLISHMENT_KINDS = [
  'lycee',
  'cfa',
  'universite',
  'ecole',
  'organisme',
  'entreprise',
  'autre',
];

export const ROLES = ['student', 'tutor', 'admin'];
export const TEMPLATES = ['classique', 'moderne', 'compact'];
export const VISIBILITIES = ['private', 'establishment', 'public'];
export const SEARCH_KINDS = ['stage', 'alternance', 'emploi', 'job_etudiant'];
export const APPLICATION_STATUS = [
  'envoyee',
  'relancee',
  'entretien',
  'acceptee',
  'refusee',
  'sans_reponse',
];
export const CHANNELS = [
  'mail',
  'courrier',
  'telephone',
  'sur_place',
  'jobboard',
  'reseau',
  'forum',
  'autre',
];
export const EXPERIENCE_KINDS = ['experience', 'stage', 'alternance', 'projet', 'benevolat'];
export const SKILL_CATEGORIES = ['technique', 'transversale', 'logiciel', 'autre'];
export const LANGUAGE_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'langue_maternelle'];
export const VISIT_MODES = ['presentiel', 'visio', 'telephone'];

const trimmed = (max) => z.string().trim().max(max);
const optionalText = (max) =>
  z
    .union([trimmed(max), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v));

const isoDate = z
  .union([z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ'), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v === '' || v === undefined ? null : v));

const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true';

const boolInt = z
  .union([z.boolean(), z.number(), z.string()])
  .optional()
  .transform((v) => (truthy(v) ? 1 : 0));

/** Variante pour les champs actifs par defaut (absent => 1). */
const boolIntOn = z
  .union([z.boolean(), z.number(), z.string()])
  .optional()
  .transform((v) => (v === undefined ? 1 : truthy(v) ? 1 : 0));

const idRef = z
  .union([z.number().int().positive(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  });

export const passwordSchema = z
  .string()
  .min(10, 'Le mot de passe doit contenir au moins 10 caracteres')
  .max(128)
  .refine((v) => /[a-z]/.test(v), 'Il faut au moins une minuscule')
  .refine((v) => /[A-Z]/.test(v), 'Il faut au moins une majuscule')
  .refine((v) => /[0-9]/.test(v), 'Il faut au moins un chiffre');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide').max(180),
  password: passwordSchema,
  first_name: trimmed(80).min(1, 'Prenom requis'),
  last_name: trimmed(80).min(1, 'Nom requis'),
  establishment_id: idRef,
  cohort_id: idRef,
  phone: optionalText(30),
  city: optionalText(120),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export const profileSchema = z.object({
  first_name: trimmed(80).min(1),
  last_name: trimmed(80).min(1),
  phone: optionalText(30),
  city: optionalText(120),
  birthdate: isoDate,
  establishment_id: idRef,
  cohort_id: idRef,
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Mot de passe actuel requis'),
  new_password: passwordSchema,
});

const experienceSchema = z.object({
  kind: z.enum(EXPERIENCE_KINDS).default('experience'),
  position: trimmed(160).min(1, 'Intitule requis'),
  organisation: optionalText(160),
  city: optionalText(120),
  start_date: isoDate,
  end_date: isoDate,
  current: boolInt,
  description: optionalText(4000),
});

const educationSchema = z.object({
  degree: trimmed(180).min(1, 'Diplome / formation requis'),
  school: optionalText(180),
  city: optionalText(120),
  start_date: isoDate,
  end_date: isoDate,
  current: boolInt,
  description: optionalText(4000),
});

const skillSchema = z.object({
  name: trimmed(90).min(1),
  category: z.enum(SKILL_CATEGORIES).default('technique'),
  level: z.coerce.number().int().min(1).max(5).default(3),
});

const languageSchema = z.object({
  name: trimmed(60).min(1),
  level: z.enum(LANGUAGE_LEVELS).default('B1'),
});

const certificationSchema = z.object({
  name: trimmed(160).min(1),
  issuer: optionalText(160),
  obtained_at: isoDate,
  url: optionalText(300),
});

const interestSchema = z.object({ label: trimmed(120).min(1) });

const linkSchema = z.object({
  label: trimmed(60).min(1),
  url: trimmed(300).min(1).refine((v) => /^https?:\/\//i.test(v), 'URL invalide (http/https attendu)'),
});

export const cvSchema = z.object({
  title: trimmed(120).min(1, 'Titre requis').default('Mon CV'),
  template: z.enum(TEMPLATES).default('classique'),
  accent: trimmed(9).regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadecimale attendue').default('#1f6feb'),
  headline: optionalText(160),
  summary: optionalText(2000),
  contact_email: optionalText(180),
  contact_phone: optionalText(30),
  contact_city: optionalText(120),
  birthdate: isoDate,
  driving_license: optionalText(60),
  mobility: optionalText(160),
  visibility: z.enum(VISIBILITIES).default('establishment'),
  searching: boolInt,
  search_kind: z.enum(SEARCH_KINDS).default('stage'),
  available_from: isoDate,
  is_default: boolInt,
  experiences: z.array(experienceSchema).max(40).default([]),
  educations: z.array(educationSchema).max(40).default([]),
  skills: z.array(skillSchema).max(60).default([]),
  languages: z.array(languageSchema).max(15).default([]),
  certifications: z.array(certificationSchema).max(30).default([]),
  interests: z.array(interestSchema).max(30).default([]),
  links: z.array(linkSchema).max(15).default([]),
});

export const applicationSchema = z.object({
  cv_id: idRef,
  company: trimmed(160).min(1, "Nom de l'organisation requis"),
  position: optionalText(160),
  city: optionalText(120),
  contact_name: optionalText(120),
  contact_email: optionalText(180),
  contact_phone: optionalText(30),
  kind: z.enum(SEARCH_KINDS).default('stage'),
  channel: z.enum(CHANNELS).default('mail'),
  sent_at: isoDate,
  status: z.enum(APPLICATION_STATUS).default('envoyee'),
  start_date: isoDate,
  end_date: isoDate,
  company_tutor: optionalText(160),
  notes: optionalText(4000),
});

export const visitSchema = z.object({
  visit_date: isoDate,
  mode: z.enum(VISIT_MODES).default('presentiel'),
  comment: trimmed(4000).min(3, 'Le commentaire de visite est requis'),
  rating: z
    .union([z.coerce.number().int().min(1).max(5), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
  shared_with_student: boolIntOn,
});

export const establishmentSchema = z.object({
  name: trimmed(180).min(1, 'Nom requis'),
  kind: z.enum(ESTABLISHMENT_KINDS).default('autre'),
  city: optionalText(120),
  country: trimmed(80).default('France'),
  website: optionalText(200),
  active: boolIntOn,
});

export const programSchema = z.object({
  establishment_id: idRef,
  name: trimmed(180).min(1, 'Nom de la formation requis'),
  level: z.enum(LEVELS).default('autre'),
  field: optionalText(120),
  duration_years: z.coerce.number().min(0.5).max(10).default(2),
  internship_required: boolIntOn,
  active: boolIntOn,
});

export const cohortSchema = z.object({
  program_id: z.coerce.number().int().positive('Formation requise'),
  label: trimmed(120).min(1, 'Libelle requis'),
  year_level: z.coerce.number().int().min(1).max(10).default(1),
  start_year: z.coerce.number().int().min(1990).max(2100).optional().nullable(),
  end_year: z.coerce.number().int().min(1990).max(2100).optional().nullable(),
  active: boolIntOn,
});

export const adminUserPatchSchema = z.object({
  first_name: trimmed(80).min(1).optional(),
  last_name: trimmed(80).min(1).optional(),
  email: z.string().trim().toLowerCase().email().max(180).optional(),
  role: z.enum(ROLES).optional(),
  establishment_id: idRef,
  cohort_id: idRef,
  active: z.union([z.boolean(), z.number(), z.string()]).optional(),
  cohort_ids: z.array(z.coerce.number().int().positive()).max(50).optional(),
});

export const adminUserCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresse e-mail invalide').max(180),
  first_name: trimmed(80).min(1),
  last_name: trimmed(80).min(1),
  role: z.enum(ROLES).default('student'),
  establishment_id: idRef,
  cohort_id: idRef,
});


