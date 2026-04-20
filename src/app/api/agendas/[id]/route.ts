import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/agendas/[id] — Get agenda detail with sub-agendas
async function handleGet(
  req: NextRequest,
  user: AuthUser
) {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const agenda = await prisma.agenda.findUnique({
    where: { id },
    include: {
      subAgendas: {
        orderBy: { orderNo: 'asc' },
      },
      event: {
        select: { name: true },
      },
    },
  });

  if (!agenda) {
    return NextResponse.json({ error: 'ไม่พบวาระ' }, { status: 404 });
  }

  return NextResponse.json(agenda);
}

// PUT /api/agendas/[id] — Update agenda
async function handlePut(
  req: NextRequest,
  user: AuthUser
) {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const existing = await prisma.agenda.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบวาระ' }, { status: 404 });
  }

  const updated = await prisma.agenda.update({
    where: { id },
    data: {
      orderNo: body.orderNo ?? existing.orderNo,
      title: body.title ?? existing.title,
      titleTh: body.titleTh ?? existing.titleTh,
      description: body.description !== undefined ? body.description : existing.description,
      resolutionType: body.resolutionType ?? existing.resolutionType,
      status: body.status ?? existing.status,
      mcScript: body.mcScript !== undefined ? body.mcScript : existing.mcScript,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: 'UPDATE_AGENDA',
      entity: 'Agenda',
      entityId: id,
      details: JSON.stringify({
        วาระ: `${updated.orderNo}: ${updated.titleTh}`,
        changedBy: user.username,
      }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/agendas/[id] — Delete agenda (only PENDING)
async function handleDelete(
  req: NextRequest,
  user: AuthUser
) {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const existing = await prisma.agenda.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบวาระ' }, { status: 404 });
  }

  if (existing.status !== 'PENDING') {
    return NextResponse.json(
      { error: 'ไม่สามารถลบวาระที่ไม่ใช่สถานะ PENDING' },
      { status: 400 }
    );
  }

  // Delete sub-agendas first
  await prisma.subAgenda.deleteMany({ where: { agendaId: id } });
  await prisma.agenda.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: 'DELETE_AGENDA',
      entity: 'Agenda',
      entityId: id,
      details: JSON.stringify({
        วาระ: `${existing.orderNo}: ${existing.titleTh}`,
        changedBy: user.username,
      }),
    },
  });

  return NextResponse.json({ success: true });
}

// PATCH /api/agendas/[id] — Update MC script only
async function handlePatch(
  req: NextRequest,
  user: AuthUser
) {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const { mcScript } = await req.json();

  const existing = await prisma.agenda.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบวาระ' }, { status: 404 });
  }

  const updated = await prisma.agenda.update({
    where: { id },
    data: { mcScript: mcScript || null },
  });

  return NextResponse.json(updated);
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
export const DELETE = withAuth(handleDelete, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
export const PATCH = withAuth(handlePatch, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'CHAIRMAN']);
