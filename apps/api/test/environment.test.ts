import { describe, expect, it } from 'vitest';
import { validateEnvironment } from '../src/config/environment.js';

describe('environment validation', () => {
  it('requires a database URL', () => {
    expect(() => validateEnvironment({ CORS_ORIGINS: 'http://localhost:3000' })).toThrow(
      'DATABASE_URL'
    );
  });
  it('converts delivery fees to numbers and rejects invalid amounts', () => {
    const base = { DATABASE_URL: 'postgresql://local/test', CORS_ORIGINS: 'http://localhost:3000' };
    expect(
      validateEnvironment({ ...base, DELIVERY_FEE_MILLIMES: '8000' }).DELIVERY_FEE_MILLIMES
    ).toBe(8000);
    expect(() => validateEnvironment({ ...base, DELIVERY_FEE_MILLIMES: '-1' })).toThrow(
      'DELIVERY_FEE_MILLIMES'
    );
  });
  it('normalizes a valid API port', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://local/test',
        CORS_ORIGINS: 'http://localhost:3000',
        API_PORT: '4100'
      }).API_PORT
    ).toBe(4100);
  });
});
