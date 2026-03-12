import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET /api/users — List all users
async function handleGet(req: NextRequest, user: AuthUser) {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      companyId: true,
      company: { select: { nameTh: true } },
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(users);
}

// POST /api/users — Create new user
async function handlePost(req: NextRequest, user: AuthUser) {
  const { username, password, displayName, role, companyId, isActive } = await req.json();

  if (!username || !password || !displayName || !role) {
    return NextResponse.json(
      { error: 'กรุณากรอก username, password, displayName, role' },
      { status: 400 }
    );
  }

  const validRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'REGISTRATION_STAFF', 'TALLYING_STAFF', 'CHAIRMAN', 'AUDITOR'];
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Role ไม่ถูกต้อง' }, { status: 400 });
  }

  // Check duplicate
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: 'Username นี้ถูกใช้แล้ว' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await prisma.user.create({
    data: {
      username,
      passwordHash,
      displayName,
      role,
      companyId: companyId || null,
      isActive: isActive !== false,
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      companyId: true,
      createdAt: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: 'CREATE_USER',
      entity: 'User',
      entityId: newUser.id,
      details: JSON.stringify({ username, displayName, role }),
    },
  });

  return NextResponse.json(newUser, { status: 201 });
}

export const GET = withAuth(handleGet, ['SUPER_ADMIN']);
export const POST = withAuth(handlePost, ['SUPER_ADMIN']);
