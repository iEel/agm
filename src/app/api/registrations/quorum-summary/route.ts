import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/registrations/quorum-summary — Detailed quorum breakdown (SELF vs PROXY)
async function handleGet(_req: Request, _user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
    include: {
      company: { select: { nameTh: true, name: true, logoUrl: true } },
    },
  });

  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  // Total shareholders for this meeting
  const totalShareholders = await prisma.shareholder.count({
    where: { meetingId: activeEvent.id },
  });

  // Breakdown by attendee type — only those currently present (not checked out)
  const selfData = await prisma.registration.aggregate({
    where: { meetingId: activeEvent.id, attendeeType: 'SELF', checkoutAt: null },
    _count: true,
    _sum: { shares: true },
  });

  const proxyData = await prisma.registration.aggregate({
    where: { meetingId: activeEvent.id, attendeeType: 'PROXY', checkoutAt: null },
    _count: true,
    _sum: { shares: true },
  });

  const selfCount = selfData._count || 0;
  const selfShares = selfData._sum.shares || BigInt(0);
  const proxyCount = proxyData._count || 0;
  const proxyShares = proxyData._sum.shares || BigInt(0);
  const totalCount = selfCount + proxyCount;
  const totalShares = selfShares + proxyShares;
  const totalPaidUpShares = activeEvent.totalShares;

  const percentage = totalPaidUpShares > BigInt(0)
    ? (Number(totalShares) / Number(totalPaidUpShares) * 100).toFixed(4)
    : '0';

  // Quorum rules (Thai Public Company Act):
  // ≥ 25 persons OR ≥ half of total shareholders, AND shares ≥ 1/3 of total
  const minPersons = Math.min(25, Math.ceil(totalShareholders / 2));
  const personsOk = totalCount >= minPersons;
  const sharesOk = totalShares * BigInt(3) >= totalPaidUpShares; // shares >= 1/3
  const quorumMet = personsOk && sharesOk;

  return NextResponse.json({
    company: {
      nameTh: activeEvent.company.nameTh,
      nameEn: activeEvent.company.name,
      logoUrl: activeEvent.company.logoUrl,
    },
    event: {
      name: activeEvent.name,
      type: activeEvent.type,
      date: activeEvent.date.toISOString(),
      venue: activeEvent.venue,
    },
    self: { count: selfCount, shares: selfShares.toString() },
    proxy: { count: proxyCount, shares: proxyShares.toString() },
    total: { count: totalCount, shares: totalShares.toString() },
    totalPaidUpShares: totalPaidUpShares.toString(),
    totalShareholders,
    percentage,
    quorumMet,
    quorumDetail: {
      personsOk,
      sharesOk,
      minPersons,
      minSharesFraction: '1/3',
    },
    timestamp: new Date().toISOString(),
  });
}

export const GET = withAuth(handleGet);
