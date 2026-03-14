import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/agendas/[id]/sub-agendas — List sub-agendas
async function handleGet(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const agendaId = segments[segments.indexOf('agendas') + 1];

  const subAgendas = await prisma.subAgenda.findMany({
    where: { agendaId },
    orderBy: { orderNo: 'asc' },
  });

  return NextResponse.json(subAgendas);
}

// POST /api/agendas/[id]/sub-agendas — Create sub-agenda
async function handlePost(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const agendaId = segments[segments.indexOf('agendas') + 1];

  const agenda = await prisma.agenda.findUnique({ where: { id: agendaId } });
  if (!agenda) {
    return NextResponse.json({ error: 'ไม่พบวาระหลัก' }, { status: 404 });
  }

  const body = await req.json();
  const { title, titleTh } = body;

  if (!titleTh) {
    return NextResponse.json(
      { error: 'กรุณากรอก titleTh' },
      { status: 400 }
    );
  }

  // Auto-assign orderNo
  const maxOrder = await prisma.subAgenda.findFirst({
    where: { agendaId },
    orderBy: { orderNo: 'desc' },
    select: { orderNo: true },
  });

  const subAgenda = await prisma.subAgenda.create({
    data: {
      agendaId,
      orderNo: (maxOrder?.orderNo || 0) + 1,
      title,
      titleTh,
    },
  });

  return NextResponse.json(subAgenda, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
