import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

const ROUNDS = 12;

export function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signSession(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, est: user.establishment_id ?? null },
    config.jwtSecret,
    { expiresIn: `${config.sessionHours}h` },
  );
}

export function verifySession(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Mot de passe temporaire lisible (import CSV, reinitialisation par un admin).
 * Contient toujours majuscule, minuscule, chiffre et caractere special.
 */
export function generateTempPassword() {
  const letters = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const special = '!@#$%*';
  const pick = (set, n) =>
    Array.from({ length: n }, () => set[crypto.randomInt(set.length)]).join('');
  const raw = pick(upper, 2) + pick(letters, 5) + pick(digits, 3) + pick(special, 1);
  return raw
    .split('')
    .sort(() => crypto.randomInt(3) - 1)
    .join('');
}

/** Comparaison a temps constant (jetons CSRF). */
export function safeEqual(a = '', b = '') {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    maxAge: config.sessionHours * 3600 * 1000,
    path: '/',
  };
}
