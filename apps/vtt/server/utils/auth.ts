import crypto from 'crypto';

export function hashPassword(
  password: string,
  salt?: string,
  iterations = 120000,
): { hash: string; salt: string; iterations: number } {
  const resolvedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto
    .pbkdf2Sync(password, resolvedSalt, iterations, 64, 'sha512')
    .toString('hex');
  return { hash: derived, salt: resolvedSalt, iterations };
}

export function verifyPassword(
  password: string,
  storedHash: string,
  salt: string,
  iterations: number,
): boolean {
  const { hash } = hashPassword(password, salt, iterations);
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}
