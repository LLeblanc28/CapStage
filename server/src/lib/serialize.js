/** Projection d'un utilisateur destinee au client (jamais de hash ni de compteur d'echec). */
export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    first_name: u.first_name,
    last_name: u.last_name,
    role: u.role,
    establishment_id: u.establishment_id,
    establishment_name: u.establishment_name ?? null,
    cohort_id: u.cohort_id,
    cohort_label: u.cohort_label ?? null,
    program_id: u.program_id ?? null,
    program_name: u.program_name ?? null,
    program_level: u.program_level ?? null,
    phone: u.phone,
    city: u.city,
    birthdate: u.birthdate,
    active: !!u.active,
    must_change_password: !!u.must_change_password,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
  };
}

export const LEVEL_LABELS = {
  college: 'College',
  cap: 'CAP',
  bac_pro: 'Bac professionnel',
  bac_techno: 'Bac technologique',
  bac_general: 'Bac general',
  bts: 'BTS',
  but: 'BUT / DUT',
  licence: 'Licence',
  licence_pro: 'Licence professionnelle',
  master: 'Master',
  ingenieur: "Diplome d'ingenieur",
  doctorat: 'Doctorat',
  titre_pro: 'Titre professionnel',
  autre: 'Autre',
};
