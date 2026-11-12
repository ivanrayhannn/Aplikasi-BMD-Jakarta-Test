// Primitif keamanan untuk server: hash kata sandi scrypt + token sesi acak.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const candidate = scryptSync(password, salt, expected.length);
  return timingSafeEqual(candidate, expected);
}

export const newToken = () => randomBytes(32).toString('hex');
