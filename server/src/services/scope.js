import { all, get } from '../db/index.js';

/** Promotions explicitement rattachees a un referent. */
export function tutorCohortIds(tutorId) {
  return all('SELECT cohort_id FROM tutor_cohort WHERE tutor_id = ?', [tutorId]).map((r) => r.cohort_id);
}

/**
 * Condition SQL limitant les etudiants visibles par le demandeur (alias de table `u`).
 * - admin      : tout le monde
 * - referent   : ses promotions, sinon tout son etablissement
 * - etudiant   : lui-meme
 */
export function studentScope(viewer, alias = 'u') {
  if (viewer.role === 'admin') return { sql: '1 = 1', params: [] };
  if (viewer.role === 'tutor') {
    const cohorts = tutorCohortIds(viewer.id);
    if (cohorts.length) {
      return {
        sql: `${alias}.cohort_id IN (${cohorts.map(() => '?').join(', ')})`,
        params: cohorts,
      };
    }
    return { sql: `${alias}.establishment_id IS ?`, params: [viewer.establishment_id] };
  }
  return { sql: `${alias}.id = ?`, params: [viewer.id] };
}

export function canViewStudent(viewer, studentId) {
  if (viewer.role === 'admin' || viewer.id === studentId) return true;
  const scope = studentScope(viewer);
  const row = get(`SELECT u.id FROM user u WHERE u.id = ? AND ${scope.sql}`, [studentId, ...scope.params]);
  return !!row;
}
