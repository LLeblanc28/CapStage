/** Client HTTP : cookies de session + jeton CSRF a chaque ecriture. */

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function csrfToken() {
  const match = document.cookie.match(/(?:^|;\s*)capstage_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function api(path, { method = 'GET', body, formData } = {}) {
  const headers = {};
  if (method !== 'GET') headers['X-CSRF-Token'] = csrfToken();
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Erreur ${res.status}`, res.status, data?.details);
  }
  return data;
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: 'POST', body: body ?? {} });
export const put = (path, body) => api(path, { method: 'PUT', body: body ?? {} });
export const patch = (path, body) => api(path, { method: 'PATCH', body: body ?? {} });
export const del = (path) => api(path, { method: 'DELETE' });

export function uploadPhoto(cvId, file) {
  const formData = new FormData();
  formData.append('photo', file);
  return api(`/cvs/${cvId}/photo`, { method: 'POST', formData });
}

/** Construit une chaine de requete en ignorant les filtres vides. */
export function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== null && value !== undefined && value !== false) {
      search.set(key, value === true ? '1' : String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}
