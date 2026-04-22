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
    shareholder: { findFirst: vi.fn() },
    registration: { findFirst: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  broadcast: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/sse-manager', () => ({ sseManager: { broadcast: mocks.broadcast } }));
vi.mock('@/lib/auth', () => ({
  withAuth: (handler: (req: Request, user: typeof mocks.user) => Promise<Response>) =>
    (req: Request) => handler(req, mocks.user),
}));

const { POST } = await import('./route');

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/registrations', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/registrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.event.findFirst.mockResolvedValue({
      id: 'event-1',
      companyId: 'company-1',
      status: 'REGISTRATION',
    });
    mocks.prisma.registration.findFirst.mockResolvedValue(null);
  });

  it('rejects shareholders that are not in the active meeting', async () => {
    mocks.prisma.shareholder.findFirst.mockResolvedValue(null);

    const res = await POST(jsonRequest({ shareholderId: 'shareholder-other-meeting' }) as never);

    expect(res.status).toBe(404);
    expect(mocks.prisma.shareholder.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'shareholder-other-meeting',
        meetingId: 'event-1',
        companyId: 'company-1',
      },
    });
    expect(mocks.prisma.registration.create).not.toHaveBeenCalled();
  });

  it('creates a registration for a shareholder in the active meeting', async () => {
    mocks.prisma.shareholder.findFirst.mockResolvedValue({
      id: 'shareholder-1',
      companyId: 'company-1',
      meetingId: 'event-1',
      registrationNo: '001',
      titleTh: 'นาย',
      firstNameTh: 'สมชาย',
      lastNameTh: 'ใจดี',
      shares: BigInt(100),
    });
    mocks.prisma.registration.create.mockResolvedValue({
      id: 'registration-1',
      companyId: 'company-1',
      meetingId: 'event-1',
      shareholderId: 'shareholder-1',
      attendeeType: 'SELF',
      shares: BigInt(100),
    });
    mocks.prisma.auditLog.create.mockResolvedValue({});

    const res = await POST(jsonRequest({ shareholderId: 'shareholder-1' }) as never);

    expect(res.status).toBe(201);
    expect(mocks.prisma.registration.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        meetingId: 'event-1',
        shareholderId: 'shareholder-1',
        shares: BigInt(100),
      }),
    });
    await expect(res.json()).resolves.toMatchObject({ id: 'registration-1', shares: '100' });
  });

  it('rejects when the active meeting belongs to another company', async () => {
    mocks.prisma.event.findFirst.mockResolvedValue({
      id: 'event-1',
      companyId: 'company-2',
      status: 'REGISTRATION',
    });

    const res = await POST(jsonRequest({ shareholderId: 'shareholder-1' }) as never);

    expect(res.status).toBe(403);
    expect(mocks.prisma.shareholder.findFirst).not.toHaveBeenCalled();
  });
});
