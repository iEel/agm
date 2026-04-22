import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: {
    userId: 'user-1',
    username: 'chair',
    displayName: 'Chair',
    role: 'CHAIRMAN',
    companyId: 'company-1',
  },
  tx: {
    agenda: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    proxySplitVote: { findMany: vi.fn() },
    vote: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
    registration: { aggregate: vi.fn() },
    shareholder: { findMany: vi.fn() },
    voteSnapshot: { upsert: vi.fn() },
  },
  prisma: {
    event: { findFirst: vi.fn() },
    agenda: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  broadcast: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/sse-manager', () => ({ sseManager: { broadcast: mocks.broadcast } }));
vi.mock('@/lib/auth', () => ({
  withAuth: (handler: (req: { nextUrl: URL; json: () => Promise<unknown> }, user: typeof mocks.user) => Promise<Response>) =>
    (req: { nextUrl: URL; json: () => Promise<unknown> }) => handler(req, mocks.user),
}));

const { PUT } = await import('./route');

function statusRequest(status: string) {
  return {
    nextUrl: new URL('http://localhost/api/agendas/agenda-1/status'),
    json: async () => ({ status }),
  };
}

describe('PUT /api/agendas/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.event.findFirst.mockResolvedValue({
      id: 'event-1',
      companyId: 'company-1',
      totalShares: BigInt(1000),
    });
    mocks.prisma.agenda.findUnique.mockResolvedValue({
      id: 'agenda-1',
      companyId: 'company-1',
      meetingId: 'event-1',
      orderNo: 1,
      titleTh: 'วาระที่ 1',
      status: 'OPEN',
      resolutionType: 'MAJORITY',
      vetoShareholderIds: null,
    });
    mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
    mocks.tx.agenda.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.proxySplitVote.findMany.mockResolvedValue([]);
    mocks.tx.registration.aggregate.mockResolvedValue({ _count: 1, _sum: { shares: BigInt(1000) } });
    mocks.tx.vote.findMany.mockResolvedValue([
      { voteChoice: 'DISAPPROVE', shares: BigInt(100) },
      { voteChoice: 'ABSTAIN', shares: BigInt(50) },
    ]);
    mocks.tx.voteSnapshot.upsert.mockResolvedValue({});
    mocks.tx.agenda.findUniqueOrThrow.mockResolvedValue({
      id: 'agenda-1',
      status: 'CLOSED',
    });
    mocks.prisma.auditLog.create.mockResolvedValue({});
  });

  it('closes the agenda and snapshots vote totals inside a transaction', async () => {
    const res = await PUT(statusRequest('CLOSED') as never);

    expect(res.status).toBe(200);
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.tx.agenda.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'agenda-1',
        meetingId: 'event-1',
        status: 'OPEN',
      },
      data: { status: 'CLOSED' },
    });
    expect(mocks.tx.voteSnapshot.upsert).toHaveBeenCalledWith({
      where: { agendaId: 'agenda-1' },
      create: expect.objectContaining({
        agendaId: 'agenda-1',
        meetingId: 'event-1',
        eligibleShares: BigInt(1000),
        approveShares: BigInt(850),
        disapproveShares: BigInt(100),
        abstainShares: BigInt(50),
        result: 'APPROVED',
      }),
      update: expect.objectContaining({
        eligibleShares: BigInt(1000),
        approveShares: BigInt(850),
      }),
    });
  });

  it('rejects a status change for an agenda outside the active meeting', async () => {
    mocks.prisma.agenda.findUnique.mockResolvedValue({
      id: 'agenda-1',
      companyId: 'company-1',
      meetingId: 'event-2',
      status: 'OPEN',
    });

    const res = await PUT(statusRequest('CLOSED') as never);

    expect(res.status).toBe(403);
    expect(mocks.prisma.$transaction).not.toHaveBeenCalled();
  });
});
