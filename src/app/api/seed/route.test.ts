import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    company: { findFirst: vi.fn(), create: vi.fn() },
    event: { create: vi.fn() },
  },
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn() },
}));

const { POST } = await import('./route');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/seed', () => {
  it('is disabled by default', async () => {
    vi.stubEnv('ENABLE_SEED_ENDPOINT', '');
    vi.stubEnv('NODE_ENV', 'development');

    const res = await POST();

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Seed endpoint is disabled' });
  });

  it('is disabled in production even when explicitly enabled', async () => {
    vi.stubEnv('ENABLE_SEED_ENDPOINT', 'true');
    vi.stubEnv('NODE_ENV', 'production');

    const res = await POST();

    expect(res.status).toBe(404);
  });
});
