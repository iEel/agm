import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import { serializeBigInt } from '@/lib/serialize';
import { sseManager } from '@/lib/sse-manager';

// PUT /api/registrations/[id] — Check-out (leave meeting)
async function handlePut(req: NextRequest, user: AuthUser) {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const { action } = await req.json();

  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }
  if (user.companyId && user.companyId !== activeEvent.companyId) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงงานประชุมนี้' }, { status: 403 });
  }

  const existing = await prisma.registration.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลการลงทะเบียน' }, { status: 404 });
  }
  if (existing.meetingId !== activeEvent.id || existing.companyId !== activeEvent.companyId) {
    return NextResponse.json({ error: 'ข้อมูลการลงทะเบียนไม่ตรงกับงานประชุมที่ Active' }, { status: 403 });
  }

  if (action === 'checkout') {
    // Block checkout if meeting is already closed
    const event = await prisma.event.findFirst({
      where: { id: existing.meetingId },
      select: { status: true },
    });
    if (event?.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'การประชุมปิดแล้ว ไม่สามารถ Check-out ได้' },
        { status: 403 }
      );
    }

    const shareholder = await prisma.shareholder.findUnique({
      where: { id: existing.shareholderId },
      select: { firstNameTh: true, lastNameTh: true, registrationNo: true, shares: true },
    });

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
        details: JSON.stringify({
          ผู้ถือหุ้น: shareholder ? `${shareholder.firstNameTh} ${shareholder.lastNameTh} (${shareholder.registrationNo})` : existing.shareholderId,
          จำนวนหุ้น: shareholder ? BigInt(shareholder.shares).toLocaleString('th-TH') : '-',
          changedBy: user.username,
        }),
      },
    });
    sseManager.broadcast('registration');
    return NextResponse.json(serializeBigInt(updated));
  }

  if (action === 'checkin') {
    // Re-check-in (cancel checkout)
    const shareholder = await prisma.shareholder.findUnique({
      where: { id: existing.shareholderId },
      select: { firstNameTh: true, lastNameTh: true, registrationNo: true, shares: true },
    });

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
        details: JSON.stringify({
          ผู้ถือหุ้น: shareholder ? `${shareholder.firstNameTh} ${shareholder.lastNameTh} (${shareholder.registrationNo})` : existing.shareholderId,
          จำนวนหุ้น: shareholder ? BigInt(shareholder.shares).toLocaleString('th-TH') : '-',
          changedBy: user.username,
        }),
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

  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }
  if (user.companyId && user.companyId !== activeEvent.companyId) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงงานประชุมนี้' }, { status: 403 });
  }

  const existing = await prisma.registration.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบข้อมูล' }, { status: 404 });
  }
  if (existing.meetingId !== activeEvent.id || existing.companyId !== activeEvent.companyId) {
    return NextResponse.json({ error: 'ข้อมูลการลงทะเบียนไม่ตรงกับงานประชุมที่ Active' }, { status: 403 });
  }

  const shareholder = await prisma.shareholder.findUnique({
    where: { id: existing.shareholderId },
    select: { firstNameTh: true, lastNameTh: true, registrationNo: true, shares: true },
  });

  await prisma.registration.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: 'CANCEL_REGISTRATION',
      entity: 'Registration',
      entityId: id,
      details: JSON.stringify({
        ผู้ถือหุ้น: shareholder ? `${shareholder.firstNameTh} ${shareholder.lastNameTh} (${shareholder.registrationNo})` : existing.shareholderId,
        จำนวนหุ้น: shareholder ? BigInt(shareholder.shares).toLocaleString('th-TH') : '-',
        changedBy: user.username,
      }),
    },
  });
  sseManager.broadcast('registration');
  return NextResponse.json({ success: true });
}

export const PUT = withAuth(handlePut, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'REGISTRATION_STAFF']);
export const DELETE = withAuth(handleDelete, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
