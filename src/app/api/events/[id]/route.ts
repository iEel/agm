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

  const updated = await prisma.event.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      type: body.type ?? existing.type,
      date: body.date ? new Date(body.date) : existing.date,
      venue: body.venue !== undefined ? (body.venue || null) : existing.venue,
      totalShares: body.totalShares ? BigInt(body.totalShares) : existing.totalShares,
      status: body.status ?? existing.status,
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
