import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/events/[id]
async function handleGet(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('events') + 1];

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      company: { select: { name: true, nameTh: true, logoUrl: true } },
      _count: { select: { shareholders: true, agendas: true, registrations: true } },
    },
  });

  if (!event) {
    return NextResponse.json({ error: 'ไม่พบงานประชุม' }, { status: 404 });
  }

  return NextResponse.json({ ...event, totalShares: event.totalShares.toString() });
}

// PUT /api/events/[id]
async function handlePut(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('events') + 1];
  const body = await req.json();

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบงานประชุม' }, { status: 404 });
  }

  // If status is changing to CLOSED, create quorum snapshot
  let closedAt = existing.closedAt;
  let quorumSnapshot = existing.quorumSnapshot;

  if (body.status === 'CLOSED' && existing.status !== 'CLOSED') {
    closedAt = new Date();

    // Build quorum snapshot with frozen data
    const totalShareholders = await prisma.shareholder.count({
      where: { meetingId: id },
    });
    const selfData = await prisma.registration.aggregate({
      where: { meetingId: id, attendeeType: 'SELF', checkoutAt: null },
      _count: true,
      _sum: { shares: true },
    });
    const proxyData = await prisma.registration.aggregate({
      where: { meetingId: id, attendeeType: 'PROXY', checkoutAt: null },
      _count: true,
      _sum: { shares: true },
    });

    const selfCount = selfData._count || 0;
    const selfShares = selfData._sum.shares || BigInt(0);
    const proxyCount = proxyData._count || 0;
    const proxyShares = proxyData._sum.shares || BigInt(0);
    const totalCount = selfCount + proxyCount;
    const totalShares = selfShares + proxyShares;
    const totalPaidUpShares = existing.totalShares;

    const percentage = totalPaidUpShares > BigInt(0)
      ? (Number(totalShares) / Number(totalPaidUpShares) * 100).toFixed(4)
      : '0';

    const minPersons = Math.min(25, Math.ceil(totalShareholders / 2));
    const personsOk = totalCount >= minPersons;
    const sharesOk = totalShares * BigInt(3) >= totalPaidUpShares;
    const quorumMet = personsOk && sharesOk;

    quorumSnapshot = JSON.stringify({
      self: { count: selfCount, shares: selfShares.toString() },
      proxy: { count: proxyCount, shares: proxyShares.toString() },
      total: { count: totalCount, shares: totalShares.toString() },
      totalPaidUpShares: totalPaidUpShares.toString(),
      totalShareholders,
      percentage,
      quorumMet,
      quorumDetail: { personsOk, sharesOk, minPersons, minSharesFraction: '1/3' },
    });
  }

  const updated = await prisma.event.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      type: body.type ?? existing.type,
      date: body.date ? new Date(body.date) : existing.date,
      venue: body.venue !== undefined ? (body.venue || null) : existing.venue,
      totalShares: body.totalShares ? BigInt(body.totalShares) : existing.totalShares,
      status: body.status ?? existing.status,
      closedAt,
      quorumSnapshot,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: 'UPDATE_EVENT',
      entity: 'Event',
      entityId: id,
      details: JSON.stringify({ name: updated.name, status: updated.status }),
    },
  });

  return NextResponse.json({ ...updated, totalShares: updated.totalShares.toString() });
}

// DELETE /api/events/[id]
async function handleDelete(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('events') + 1];

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบงานประชุม' }, { status: 404 });
  }

  if (existing.isActive) {
    return NextResponse.json({ error: 'ไม่สามารถลบงานประชุมที่ Active ได้' }, { status: 400 });
  }

  // Check if event has data
  const counts = await prisma.registration.count({ where: { meetingId: id } });
  if (counts > 0) {
    return NextResponse.json({ error: 'ไม่สามารถลบงานที่มีข้อมูลลงทะเบียนแล้ว' }, { status: 400 });
  }

  await prisma.event.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: 'DELETE_EVENT',
      entity: 'Event',
      entityId: id,
      details: JSON.stringify({ name: existing.name }),
    },
  });

  return NextResponse.json({ success: true });
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut, ['SUPER_ADMIN']);
export const DELETE = withAuth(handleDelete, ['SUPER_ADMIN']);
