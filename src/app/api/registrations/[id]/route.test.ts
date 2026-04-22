import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: {
    userId: 'user-1',
    username: 'registrar',
    displayName: 'Registrar',
    role: 'REGISTRATION_STAFF',
    companyId: 'company-1',
  },
  prisma: {
    event: { findFirst: vi.fn() },
    registration: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    shareholder: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  broadcast: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/sse-manager', () => ({ sseManager: { broadcast: mocks.broadcast } }));
vi.mock('@/lib/auth', () => ({
  withAuth: (handler: (req: { nextUrl: URL; json: () => Promise<unknown> }, user: typeof mocks.user) => Promise<Response>) =>
    (req: { nextUrl: URL; json: () => Promise<unknown> }) => handler(req, mocks.user),
}));

const { PUT, DELETE } = await import('./route');

function routeRequest(path: string, body?: unknown) {
  return {
    nextUrl: new URL(`http://localhost${path}`),
    json: async () => body,
  };
}

describe('/api/registrations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.event.findFirst.mockResolvedValue({
      id: 'event-1',
      companyId: 'company-1',
      status: 'REGISTRATION',
    });
    mocks.prisma.shareholder.findUnique.mockResolvedValue({
      firstNameTh: 'สมชาย',
      lastNameTh: 'ใจดี',
      registrationNo: '001',
      shares: BigInt(100),
    });
  });

  it('rejects checkout for a registration from another meeting', async () => {
    mocks.prisma.registration.findUnique.mockResolvedValue({
      id: 'registration-2',
      companyId: 'company-1',
      meetingId: 'event-2',
      shareholderId: 'shareholder-1',
    });

    const res = await PUT(routeRequest('/api/registrations/registration-2', { action: 'checkout' }) as never);

    expect(res.status).toBe(403);
    expect(mocks.prisma.registration.update).not.toHaveBeenCalled();
  });

  it('checks out a registration from the active meeting', async () => {
    mocks.prisma.registration.findUnique.mockResolvedValue({
      id: 'registration-1',
      companyId: 'company-1',
      meetingId: 'event-1',
      shareholderId: 'shareholder-1',
    });
    mocks.prisma.registration.update.mockResolvedValue({
      id: 'registration-1',
      shares: BigInt(100),
      checkoutAt: new Date('2026-04-22T00:00:00.000Z'),
    });
    mocks.prisma.auditLog.create.mockResolvedValue({});

    const res = await PUT(routeRequest('/api/registrations/registration-1', { action: 'checkout' }) as never);

    expect(res.status).toBe(200);
    expect(mocks.prisma.registration.update).toHaveBeenCalledWith({
      where: { id: 'registration-1' },
      data: { checkoutAt: expect.any(Date) },
    });
  });

  it('rejects cancellation for a registration outside the active meeting', async () => {
    mocks.prisma.registration.findUnique.mockResolvedValue({
      id: 'registration-2',
      companyId: 'company-1',
      meetingId: 'event-2',
      shareholderId: 'shareholder-1',
    });

    const res = await DELETE(routeRequest('/api/registrations/registration-2') as never);

    expect(res.status).toBe(403);
    expect(mocks.prisma.registration.delete).not.toHaveBeenCalled();
  });
});
