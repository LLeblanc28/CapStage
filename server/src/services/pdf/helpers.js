export const MONTHS = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

export function formatMonth(iso) {
  if (!iso) return '';
  const [y, m] = iso.split('-');
  const idx = Number(m) - 1;
  if (Number.isNaN(idx) || !MONTHS[idx]) return y || '';
  return `${MONTHS[idx]} ${y}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!d) return formatMonth(iso);
  return `${d}/${m}/${y}`;
}

export function period(start, end, current) {
  const from = formatMonth(start);
  const to = current ? "aujourd'hui" : formatMonth(end);
  if (from && to) return `${from} - ${to}`;
  return from || to || '';
}

export const LANGUAGE_LABELS = {
  A1: 'A1 - débutant',
  A2: 'A2 - élémentaire',
  B1: 'B1 - intermédiaire',
  B2: 'B2 - avancé',
  C1: 'C1 - autonome',
  C2: 'C2 - maîtrise',
  langue_maternelle: 'Langue maternelle',
};

/** Version courte utilisée dans les mises en page denses. */
export const LANGUAGE_SHORT = {
  langue_maternelle: 'natif',
};

export const SEARCH_KIND_LABELS = {
  stage: 'Stage',
  alternance: 'Alternance',
  emploi: 'Emploi',
  job_etudiant: 'Job étudiant',
};

export const EXPERIENCE_KIND_LABELS = {
  experience: 'Expérience',
  stage: 'Stage',
  alternance: 'Alternance',
  projet: 'Projet',
  benevolat: 'Bénévolat',
};

/** Convertit une couleur #rrggbb en variante claire (fond de badge). */
export function lighten(hex, ratio = 0.85) {
  const value = hex.replace('#', '');
  const num = parseInt(value, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const mix = (c) => Math.round(c + (255 - c) * ratio);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Luminance relative : choisit un texte noir ou blanc lisible sur la couleur donnee. */
export function readableText(hex) {
  const value = hex.replace('#', '');
  const num = parseInt(value, 16);
  const [r, g, b] = [(num >> 16) & 255, (num >> 8) & 255, num & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.45 ? '#1a1a1a' : '#ffffff';
}

export function fullName(cv) {
  return `${cv.first_name ?? ''} ${cv.last_name ?? ''}`.trim();
}

export function contactLines(cv) {
  const lines = [];
  if (cv.contact_email || cv.user_email) lines.push(cv.contact_email || cv.user_email);
  if (cv.contact_phone) lines.push(cv.contact_phone);
  if (cv.contact_city) lines.push(cv.contact_city);
  if (cv.driving_license) lines.push(cv.driving_license);
  if (cv.mobility) lines.push(cv.mobility);
  return lines;
}

/** Nom de fichier sur : ASCII, sans espace. */
export function safeFileName(input, fallback = 'cv') {
  const base = String(input || fallback)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return (base || fallback).slice(0, 60);
}
