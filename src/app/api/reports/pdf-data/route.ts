import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/reports/pdf-data — Returns structured data for PDF report generation
// The actual PDF is rendered client-side using @react-pdf/renderer
async function handleGet(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
    include: { company: true },
  });

  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  // All agendas with snapshots
  const agendas = await prisma.agenda.findMany({
    where: { meetingId: activeEvent.id },
    include: {
      snapshot: true,
      subAgendas: { orderBy: { orderNo: 'asc' } },
    },
    orderBy: { orderNo: 'asc' },
  });

  // Registration stats
  const totalRegistrations = await prisma.registration.count({
    where: { meetingId: activeEvent.id },
  });

  const currentAttendees = await prisma.registration.aggregate({
    where: { meetingId: activeEvent.id, checkoutAt: null },
    _count: true,
    _sum: { shares: true },
  });

  const totalShareholders = await prisma.shareholder.count({
    where: { meetingId: activeEvent.id },
  });

  // Proxy stats
  const proxyCount = await prisma.proxy.count({
    where: { meetingId: activeEvent.id },
  });

  // Self vs Proxy breakdown (FR9.2)
  const selfAttendees = await prisma.registration.aggregate({
    where: { meetingId: activeEvent.id, checkoutAt: null, attendeeType: 'SELF' },
    _count: true,
    _sum: { shares: true },
  });

  const proxyAttendees = await prisma.registration.aggregate({
    where: { meetingId: activeEvent.id, checkoutAt: null, attendeeType: 'PROXY' },
    _count: true,
    _sum: { shares: true },
  });

  return NextResponse.json({
    event: {
      name: activeEvent.name,
      type: activeEvent.type,
      date: activeEvent.date,
      venue: activeEvent.venue,
    },
    company: {
      name: activeEvent.company.name,
      nameTh: activeEvent.company.nameTh,
      address: activeEvent.company.address,
      taxId: activeEvent.company.taxId,
      logoUrl: activeEvent.company.logoUrl,
    },
    statistics: {
      totalShareholders,
      totalRegistrations,
      currentAttendees: currentAttendees._count || 0,
      currentShares: (currentAttendees._sum.shares || BigInt(0)).toString(),
      totalShares: activeEvent.totalShares.toString(),
      quorumPercentage: activeEvent.totalShares > 0
        ? ((Number(currentAttendees._sum.shares || 0) / Number(activeEvent.totalShares)) * 100).toFixed(activeEvent.decimalPrecision || 4)
        : '0',
      proxyCount,
      selfCount: selfAttendees._count || 0,
      selfShares: (selfAttendees._sum.shares || BigInt(0)).toString(),
      proxyAttendeeCount: proxyAttendees._count || 0,
      proxyAttendeeShares: (proxyAttendees._sum.shares || BigInt(0)).toString(),
    },
    agendas: agendas.map((a) => ({
      orderNo: a.orderNo,
      title: a.title,
      titleTh: a.titleTh,
      description: a.description,
      resolutionType: a.resolutionType,
      status: a.status,
      subAgendas: a.subAgendas.map((s) => ({
        orderNo: s.orderNo,
        title: s.title,
        titleTh: s.titleTh,
      })),
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
    })),
  });
}

export const GET = withAuth(handleGet);
