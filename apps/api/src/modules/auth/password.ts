import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const keyLength = 64;
const scryptAsync = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scrypt(password, salt, keyLength, (error, key) => (error ? reject(error) : resolve(key)))
  );

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt:${salt.toString('base64url')}:${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltValue, keyValue] = encoded.split(':');
  if (algorithm !== 'scrypt' || !saltValue || !keyValue) return false;
  const expected = Buffer.from(keyValue, 'base64url');
  const actual = await scryptAsync(password, Buffer.from(saltValue, 'base64url'));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
