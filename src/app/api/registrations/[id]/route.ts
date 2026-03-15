import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import { serializeBigInt } from '@/lib/serialize';
import { sseManager } from '@/lib/sse-manager';

// PUT /api/registrations/[id] — Check-out (leave meeting)
async function handlePut(req: NextRequest, user: AuthUser) {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const { action } = await req.json();

  const existing = await prisma.registration.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลการลงทะเบียน' }, { status: 404 });
  }

  if (action === 'checkout') {
    const updated = await prisma.registration.update({
      where: { id },
      data: { checkoutAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: 'CHECKOUT',
        entity: 'Registration',
        entityId: id,
        details: JSON.stringify({ shareholderId: existing.shareholderId, changedBy: user.username }),
      },
    });
    sseManager.broadcast('registration');
    return NextResponse.json(serializeBigInt(updated));
  }

  if (action === 'checkin') {
    // Re-check-in (cancel checkout)
    const updated = await prisma.registration.update({
      where: { id },
      data: { checkoutAt: null },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: 'RECHECKIN',
        entity: 'Registration',
        entityId: id,
        details: JSON.stringify({ shareholderId: existing.shareholderId, changedBy: user.username }),
      },
    });
    sseManager.broadcast('registration');
    return NextResponse.json(serializeBigInt(updated));
  }

  return NextResponse.json({ error: 'Action ไม่ถูกต้อง' }, { status: 400 });
}

// DELETE /api/registrations/[id] — Cancel registration
async function handleDelete(req: NextRequest, user: AuthUser) {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const existing = await prisma.registration.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });
  }

  await prisma.registration.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: 'CANCEL_REGISTRATION',
      entity: 'Registration',
      entityId: id,
      details: JSON.stringify({ shareholderId: existing.shareholderId, changedBy: user.username }),
    },
  });
  sseManager.broadcast('registration');
  return NextResponse.json({ success: true });
}

export const PUT = withAuth(handlePut, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'REGISTRATION_STAFF']);
export const DELETE = withAuth(handleDelete, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
