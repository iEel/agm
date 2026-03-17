import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/public/quorum — Public quorum data for display screens (no auth required)
export async function GET() {
  try {
    const activeEvent = await prisma.event.findFirst({
      where: { isActive: true },
      include: {
        company: { select: { nameTh: true, name: true, logoUrl: true } },
      },
    });

    if (!activeEvent) {
      return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
    }

    const companyInfo = {
      nameTh: activeEvent.company.nameTh,
      nameEn: activeEvent.company.name,
      logoUrl: activeEvent.company.logoUrl,
    };
    const eventInfo = {
      name: activeEvent.name,
      type: activeEvent.type,
      date: activeEvent.date.toISOString(),
      venue: activeEvent.venue,
      status: activeEvent.status,
      closedAt: activeEvent.closedAt?.toISOString() || null,
    };

    // If event is CLOSED and snapshot exists, return frozen data
    if (activeEvent.status === 'CLOSED' && activeEvent.quorumSnapshot) {
      const snapshot = JSON.parse(activeEvent.quorumSnapshot);
      return NextResponse.json({
        company: companyInfo,
        event: eventInfo,
        ...snapshot,
        timestamp: activeEvent.closedAt?.toISOString() || new Date().toISOString(),
      });
    }

    // Live data (event not closed)
    const totalShareholders = await prisma.shareholder.count({
      where: { meetingId: activeEvent.id },
    });

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

    const minPersons = Math.min(25, Math.ceil(totalShareholders / 2));
    const personsOk = totalCount >= minPersons;
    const sharesOk = totalShares * BigInt(3) >= totalPaidUpShares;
    const quorumMet = personsOk && sharesOk;

    return NextResponse.json({
      company: companyInfo,
      event: eventInfo,
      self: { count: selfCount, shares: selfShares.toString() },
      proxy: { count: proxyCount, shares: proxyShares.toString() },
      total: { count: totalCount, shares: totalShares.toString() },
      totalPaidUpShares: totalPaidUpShares.toString(),
      totalShareholders,
      percentage,
      quorumMet,
      quorumDetail: { personsOk, sharesOk, minPersons, minSharesFraction: '1/3' },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Public quorum error:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
