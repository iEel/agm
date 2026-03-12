import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/companies/[id]
export const GET = withAuth(async (
  _req: NextRequest,
  _user: AuthUser,
) => {
  // Extract id from URL
  const url = new URL(_req.url);
  const id = url.pathname.split('/').pop()!;
  
  const company = await prisma.company.findUnique({
    where: { id },
    include: {
      events: {
        orderBy: { date: 'desc' },
      },
      _count: {
        select: { events: true },
      },
    },
  });

  if (!company) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลบริษัท' }, { status: 404 });
  }

  return NextResponse.json(company);
}, ['SUPER_ADMIN']);

// PUT /api/companies/[id]
export const PUT = withAuth(async (
  req: NextRequest,
  _user: AuthUser,
) => {
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop()!;
  const body = await req.json();
  const { name, nameTh, logoUrl, directors, address, taxId } = body;

  const company = await prisma.company.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(nameTh && { nameTh }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(directors !== undefined && { directors: JSON.stringify(directors) }),
      ...(address !== undefined && { address }),
      ...(taxId !== undefined && { taxId }),
    },
  });

  return NextResponse.json(company);
}, ['SUPER_ADMIN']);

// DELETE /api/companies/[id]
export const DELETE = withAuth(async (
  req: NextRequest,
  _user: AuthUser,
) => {
  const url = new URL(req.url);
  const id = url.pathname.split('/').pop()!;

  // Check if company has events
  const eventCount = await prisma.event.count({ where: { companyId: id } });
  if (eventCount > 0) {
    return NextResponse.json(
      { error: 'ไม่สามารถลบบริษัทที่มีงานประชุมได้ กรุณาลบงานประชุมก่อน' },
      { status: 400 }
    );
  }

  await prisma.company.delete({ where: { id } });

  return NextResponse.json({ success: true });
}, ['SUPER_ADMIN']);
