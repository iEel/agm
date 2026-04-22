import { afterEach, describe, expect, it } from 'vitest';
import { getJwtSecret } from './auth';

const originalSecret = process.env.AUTH_SECRET;

afterEach(() => {
  process.env.AUTH_SECRET = originalSecret;
});

describe('getJwtSecret', () => {
  it('fails fast when AUTH_SECRET is missing', () => {
    delete process.env.AUTH_SECRET;

    expect(() => getJwtSecret()).toThrow('AUTH_SECRET must be configured');
  });

  it('rejects the old fallback secret', () => {
    process.env.AUTH_SECRET = 'fallback-secret-change-me';

    expect(() => getJwtSecret()).toThrow('AUTH_SECRET must be configured');
  });

  it('returns encoded bytes for a configured secret', () => {
    process.env.AUTH_SECRET = 'a-real-secret-for-tests';

    expect(getJwtSecret()).toEqual(new TextEncoder().encode('a-real-secret-for-tests'));
  });
});
