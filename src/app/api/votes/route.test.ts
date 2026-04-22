import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: {
    userId: 'user-1',
    username: 'tally',
    displayName: 'Tally Staff',
    role: 'TALLYING_STAFF',
    companyId: 'company-1',
  },
  prisma: {
    event: { findFirst: vi.fn() },
    ballot: { findFirst: vi.fn() },
    agenda: { findFirst: vi.fn() },
    shareholder: { findFirst: vi.fn() },
    registration: { findMany: vi.fn(), findFirst: vi.fn() },
    vote: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
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
  return new Request('http://localhost/api/votes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/votes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.event.findFirst.mockResolvedValue({
      id: 'event-1',
      companyId: 'company-1',
    });
    mocks.prisma.agenda.findFirst.mockResolvedValue({
      id: 'agenda-1',
      meetingId: 'event-1',
      companyId: 'company-1',
      orderNo: 1,
      titleTh: 'วาระที่ 1',
      status: 'OPEN',
    });
    mocks.prisma.vote.findFirst.mockResolvedValue(null);
  });

  it('rejects a direct vote when the shareholder is not checked in to the active meeting', async () => {
    mocks.prisma.registration.findFirst.mockResolvedValue(null);

    const res = await POST(jsonRequest({
      agendaId: 'agenda-1',
      shareholderId: 'shareholder-other-meeting',
      voteChoice: 'DISAPPROVE',
    }) as never);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: 'ผู้ถือหุ้นยังไม่ได้ลงทะเบียนหรือออกจากห้องประชุมแล้ว',
    });
    expect(mocks.prisma.vote.create).not.toHaveBeenCalled();
  });

  it('records a vote for a checked-in shareholder using registration shares', async () => {
    mocks.prisma.registration.findFirst.mockResolvedValue({
      id: 'registration-1',
      meetingId: 'event-1',
      companyId: 'company-1',
      shares: BigInt(250),
      shareholder: {
        id: 'shareholder-1',
        registrationNo: '001',
        firstNameTh: 'สมชาย',
        lastNameTh: 'ใจดี',
        shares: BigInt(999),
      },
    });
    mocks.prisma.vote.create.mockResolvedValue({
      id: 'vote-1',
      companyId: 'company-1',
      meetingId: 'event-1',
      agendaId: 'agenda-1',
      shareholderId: 'shareholder-1',
      voteChoice: 'ABSTAIN',
      shares: BigInt(250),
    });
    mocks.prisma.auditLog.create.mockResolvedValue({});

    const res = await POST(jsonRequest({
      agendaId: 'agenda-1',
      shareholderId: 'shareholder-1',
      voteChoice: 'ABSTAIN',
    }) as never);

    expect(res.status).toBe(201);
    expect(mocks.prisma.vote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        meetingId: 'event-1',
        agendaId: 'agenda-1',
        shareholderId: 'shareholder-1',
        voteChoice: 'ABSTAIN',
        shares: BigInt(250),
      }),
    });
    await expect(res.json()).resolves.toMatchObject({ id: 'vote-1', shares: '250' });
  });

  it('rejects when the user belongs to another company', async () => {
    mocks.prisma.event.findFirst.mockResolvedValue({
      id: 'event-1',
      companyId: 'company-2',
    });

    const res = await POST(jsonRequest({
      agendaId: 'agenda-1',
      shareholderId: 'shareholder-1',
      voteChoice: 'DISAPPROVE',
    }) as never);

    expect(res.status).toBe(403);
    expect(mocks.prisma.agenda.findFirst).not.toHaveBeenCalled();
  });
});
