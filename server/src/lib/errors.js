export class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg = 'Requete invalide', details) => new ApiError(400, msg, details);
export const unauthorized = (msg = 'Authentification requise') => new ApiError(401, msg);
export const forbidden = (msg = 'Acces refuse') => new ApiError(403, msg);
export const notFound = (msg = 'Ressource introuvable') => new ApiError(404, msg);
export const conflict = (msg = 'Conflit') => new ApiError(409, msg);

/** Enveloppe un handler async pour propager les erreurs vers le middleware d'erreur. */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
