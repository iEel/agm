import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/reports/vote-summary — Full vote summary for all agendas
async function handleGet(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
    include: { company: true },
  });

  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  // Get all agendas with snapshots
  const agendas = await prisma.agenda.findMany({
    where: { meetingId: activeEvent.id },
    include: {
      snapshot: true,
      subAgendas: { orderBy: { orderNo: 'asc' } },
    },
    orderBy: { orderNo: 'asc' },
  });

  // Current quorum
  const quorum = await prisma.registration.aggregate({
    where: { meetingId: activeEvent.id, checkoutAt: null },
    _count: true,
    _sum: { shares: true },
  });

  // Total shareholders
  const totalShareholders = await prisma.shareholder.count({
    where: { meetingId: activeEvent.id },
  });

  // Total registered
  const totalRegistered = await prisma.registration.count({
    where: { meetingId: activeEvent.id },
  });

  return NextResponse.json({
    event: {
      name: activeEvent.name,
      type: activeEvent.type,
      date: activeEvent.date,
      venue: activeEvent.venue,
      company: {
        name: activeEvent.company.name,
        nameTh: activeEvent.company.nameTh,
      },
    },
    summary: {
      totalShareholders,
      totalRegistered,
      currentAttendees: quorum._count || 0,
      currentShares: (quorum._sum.shares || BigInt(0)).toString(),
      totalShares: activeEvent.totalShares.toString(),
      quorumPercentage: activeEvent.totalShares > 0
        ? ((Number(quorum._sum.shares || 0) / Number(activeEvent.totalShares)) * 100).toFixed(2)
        : '0',
    },
    agendas: agendas.map((a) => ({
      orderNo: a.orderNo,
      title: a.title,
      titleTh: a.titleTh,
      resolutionType: a.resolutionType,
      status: a.status,
      snapshot: a.snapshot
        ? {
            totalAttendees: a.snapshot.totalAttendees,
            eligibleShares: a.snapshot.eligibleShares.toString(),
            approveShares: a.snapshot.approveShares.toString(),
            disapproveShares: a.snapshot.disapproveShares.toString(),
            abstainShares: a.snapshot.abstainShares.toString(),
            voidShares: a.snapshot.voidShares.toString(),
            result: a.snapshot.result,
            closedAt: a.snapshot.closedAt,
          }
        : null,
      subAgendas: a.subAgendas.map((s) => ({
        orderNo: s.orderNo,
        title: s.title,
        titleTh: s.titleTh,
      })),
    })),
  });
}

export const GET = withAuth(handleGet);
