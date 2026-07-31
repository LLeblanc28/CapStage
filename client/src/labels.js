export const LEVEL_LABELS = {
  college: 'Collège',
  cap: 'CAP',
  bac_pro: 'Bac professionnel',
  bac_techno: 'Bac technologique',
  bac_general: 'Bac général',
  bts: 'BTS',
  but: 'BUT / DUT',
  licence: 'Licence',
  licence_pro: 'Licence professionnelle',
  master: 'Master',
  ingenieur: "Diplôme d'ingénieur",
  doctorat: 'Doctorat',
  titre_pro: 'Titre professionnel',
  autre: 'Autre',
};

export const ESTABLISHMENT_KIND_LABELS = {
  lycee: 'Lycée',
  cfa: 'CFA',
  universite: 'Université',
  ecole: 'École',
  organisme: 'Organisme de formation',
  entreprise: 'Entreprise',
  autre: 'Autre',
};

export const ROLE_LABELS = {
  student: 'Étudiant',
  tutor: 'Référent',
  admin: 'Administrateur',
};

export const TEMPLATE_LABELS = {
  classique: 'Classique',
  moderne: 'Moderne',
  compact: 'Compact',
};

export const TEMPLATE_HINTS = {
  classique: 'Une colonne, titres soulignés. Passe partout, y compris en lecture automatisée.',
  moderne: 'Bandeau latéral coloré avec contact et compétences. Met en avant le profil.',
  compact: 'Dense, compétences en étiquettes. Utile quand le CV déborde sur deux pages.',
};

export const VISIBILITY_LABELS = {
  private: 'Privé — vous seul et votre référent',
  establishment: 'Établissement — les membres de votre établissement',
  public: 'Ouvert — tous les comptes de la plateforme',
};

export const VISIBILITY_SHORT = {
  private: 'Privé',
  establishment: 'Établissement',
  public: 'Ouvert',
};

export const SEARCH_KIND_LABELS = {
  stage: 'Stage',
  alternance: 'Alternance',
  emploi: 'Emploi',
  job_etudiant: 'Job étudiant',
};

export const STATUS_LABELS = {
  envoyee: 'Envoyée',
  relancee: 'Relancée',
  entretien: 'Entretien',
  acceptee: 'Acceptée',
  refusee: 'Refusée',
  sans_reponse: 'Sans réponse',
};

/** Le parcours d'une candidature est une sequence : l'ordre porte du sens. */
export const STATUS_ORDER = ['envoyee', 'relancee', 'entretien', 'acceptee'];

export const STATUS_TONE = {
  envoyee: 'badge',
  relancee: 'badge badge--warn',
  entretien: 'badge badge--marker',
  acceptee: 'badge badge--ok',
  refusee: 'badge badge--alert',
  sans_reponse: 'badge',
};

export const CHANNEL_LABELS = {
  mail: 'E-mail',
  courrier: 'Courrier',
  telephone: 'Téléphone',
  sur_place: 'Sur place',
  jobboard: 'Site d’offres',
  reseau: 'Réseau / contact',
  forum: 'Forum, salon',
  autre: 'Autre',
};

export const EXPERIENCE_KIND_LABELS = {
  experience: 'Expérience',
  stage: 'Stage',
  alternance: 'Alternance',
  projet: 'Projet',
  benevolat: 'Bénévolat',
};

export const SKILL_CATEGORY_LABELS = {
  technique: 'Technique',
  transversale: 'Transversale',
  logiciel: 'Logiciel',
  autre: 'Autre',
};

export const LANGUAGE_LEVEL_LABELS = {
  A1: 'A1 — débutant',
  A2: 'A2 — élémentaire',
  B1: 'B1 — intermédiaire',
  B2: 'B2 — avancé',
  C1: 'C1 — autonome',
  C2: 'C2 — maîtrise',
  langue_maternelle: 'Langue maternelle',
};

export const VISIT_MODE_LABELS = {
  presentiel: 'En présentiel',
  visio: 'En visio',
  telephone: 'Par téléphone',
};

export const EVENT_LABELS = {
  login: 'Connexions',
  login_failed: 'Échecs de connexion',
  logout: 'Déconnexions',
  register: 'Inscriptions',
  cv_created: 'CV créés',
  cv_updated: 'CV modifiés',
  cv_deleted: 'CV supprimés',
  cv_duplicated: 'CV dupliqués',
  cv_exported: 'Exports PDF',
  application_created: 'Candidatures saisies',
  visit_created: 'Comptes rendus de visite',
  password_changed: 'Mots de passe modifiés',
  admin_user_created: 'Comptes créés par un admin',
  admin_user_updated: 'Comptes modifiés',
  admin_user_deleted: 'Comptes supprimés',
  admin_password_reset: 'Mots de passe réinitialisés',
  admin_import: 'Imports CSV',
};

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export function formatDate(iso) {
  if (!iso) return '';
  const [date] = String(iso).split(' ');
  const [y, m, d] = date.split('-');
  if (!d) return date;
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function formatMonth(iso) {
  if (!iso) return '';
  const [y, m] = String(iso).split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

export function period(start, end, current) {
  const from = formatMonth(start);
  const to = current ? "aujourd'hui" : formatMonth(end);
  if (from && to) return `${from} → ${to}`;
  return from || to || '';
}

export const labelOf = (map, value, fallback = '—') => map[value] || value || fallback;
