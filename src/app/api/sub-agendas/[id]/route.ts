import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// PUT /api/sub-agendas/[id] — Update sub-agenda
async function handlePut(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('sub-agendas') + 1];

  const subAgenda = await prisma.subAgenda.findUnique({ where: { id } });
  if (!subAgenda) {
    return NextResponse.json({ error: 'ไม่พบวาระย่อย' }, { status: 404 });
  }

  const body = await req.json();
  const { title, titleTh } = body;

  if (!titleTh) {
    return NextResponse.json({ error: 'กรุณากรอก titleTh' }, { status: 400 });
  }

  const updated = await prisma.subAgenda.update({
    where: { id },
    data: {
      title: title || '',
      titleTh,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/sub-agendas/[id] — Delete sub-agenda
async function handleDelete(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('sub-agendas') + 1];

  const subAgenda = await prisma.subAgenda.findUnique({ where: { id } });
  if (!subAgenda) {
    return NextResponse.json({ error: 'ไม่พบวาระย่อย' }, { status: 404 });
  }

  await prisma.subAgenda.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

export const PUT = withAuth(handlePut, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
export const DELETE = withAuth(handleDelete, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
