import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/modules/auth/password.js';

describe('admin password hashing', () => {
  it('verifies the correct password without storing it', async () => {
    const encoded = await hashPassword('a-long-local-password');
    expect(encoded).not.toContain('a-long-local-password');
    await expect(verifyPassword('a-long-local-password', encoded)).resolves.toBe(true);
    await expect(verifyPassword('incorrect-password', encoded)).resolves.toBe(false);
  });
});
