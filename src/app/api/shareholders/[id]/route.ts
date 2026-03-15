import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import { serializeBigInt } from '@/lib/serialize';

// GET /api/shareholders/[id]
async function handleGet(req: NextRequest, user: AuthUser) {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const shareholder = await prisma.shareholder.findUnique({ where: { id } });
  if (!shareholder) {
    return NextResponse.json({ error: 'ไม่พบผู้ถือหุ้น' }, { status: 404 });
  }

  return NextResponse.json(serializeBigInt(shareholder));
}

// PUT /api/shareholders/[id]
async function handlePut(req: NextRequest, user: AuthUser) {
  const id = req.nextUrl.pathname.split('/').pop()!;
  const body = await req.json();

  const existing = await prisma.shareholder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบผู้ถือหุ้น' }, { status: 404 });
  }

  // FR2.2: ห้ามแก้ไขจำนวนหุ้นผ่าน UI ปกติ
  if (body.shares !== undefined) {
    return NextResponse.json(
      { error: 'ไม่สามารถแก้ไขจำนวนหุ้นผ่าน API — กรุณา Import ใหม่' },
      { status: 403 }
    );
  }

  const updated = await prisma.shareholder.update({
    where: { id },
    data: {
      registrationNo: body.registrationNo ?? existing.registrationNo,
      titleTh: body.titleTh !== undefined ? body.titleTh : existing.titleTh,
      firstNameTh: body.firstNameTh ?? existing.firstNameTh,
      lastNameTh: body.lastNameTh ?? existing.lastNameTh,
      titleEn: body.titleEn !== undefined ? body.titleEn : existing.titleEn,
      firstNameEn: body.firstNameEn !== undefined ? body.firstNameEn : existing.firstNameEn,
      lastNameEn: body.lastNameEn !== undefined ? body.lastNameEn : existing.lastNameEn,
      idCard: body.idCard ?? existing.idCard,
    },
  });

  return NextResponse.json(serializeBigInt(updated));
}

// DELETE /api/shareholders/[id]
async function handleDelete(req: NextRequest, user: AuthUser) {
  const id = req.nextUrl.pathname.split('/').pop()!;

  const existing = await prisma.shareholder.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบผู้ถือหุ้น' }, { status: 404 });
  }

  await prisma.shareholder.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

export const GET = withAuth(handleGet);
export const PUT = withAuth(handlePut, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
export const DELETE = withAuth(handleDelete, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
