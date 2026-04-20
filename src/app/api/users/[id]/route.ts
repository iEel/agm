import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// PUT /api/users/[id] — Update user
async function handlePut(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('users') + 1];
  const body = await req.json();

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (body.displayName !== undefined) data.displayName = body.displayName;
  if (body.role !== undefined) data.role = body.role;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.companyId !== undefined) data.companyId = body.companyId || null;

  // Password change (optional)
  if (body.password) {
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      companyId: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: 'UPDATE_USER',
      entity: 'User',
      entityId: id,
      details: JSON.stringify({
        ชื่อผู้ใช้: `${updated.displayName} (${updated.username})`,
        สิทธิ์: updated.role,
        สถานะ: updated.isActive ? 'ใช้งาน' : 'ปิดการใช้งาน',
        changedBy: user.username,
      }),
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/users/[id]
async function handleDelete(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('users') + 1];

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });
  }

  // Prevent self-delete
  if (id === user.userId) {
    return NextResponse.json({ error: 'ไม่สามารถลบบัญชีตัวเองได้' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: 'DELETE_USER',
      entity: 'User',
      entityId: id,
      details: JSON.stringify({
        ชื่อผู้ใช้: `${existing.displayName} (${existing.username})`,
        changedBy: user.username,
      }),
    },
  });

  return NextResponse.json({ success: true });
}

export const PUT = withAuth(handlePut, ['SUPER_ADMIN']);
export const DELETE = withAuth(handleDelete, ['SUPER_ADMIN']);
