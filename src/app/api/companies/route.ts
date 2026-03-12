import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/companies — List all companies
export const GET = withAuth(async (_req: NextRequest, _user: AuthUser) => {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { events: true },
      },
    },
  });

  return NextResponse.json(companies);
}, ['SUPER_ADMIN']);

// POST /api/companies — Create company
export const POST = withAuth(async (req: NextRequest, _user: AuthUser) => {
  const body = await req.json();
  const { name, nameTh, logoUrl, directors, address, taxId } = body;

  if (!name || !nameTh) {
    return NextResponse.json(
      { error: 'กรุณากรอกชื่อบริษัท (ไทย/อังกฤษ)' },
      { status: 400 }
    );
  }

  const company = await prisma.company.create({
    data: {
      name,
      nameTh,
      logoUrl: logoUrl || null,
      directors: directors ? JSON.stringify(directors) : null,
      address: address || null,
      taxId: taxId || null,
    },
  });

  return NextResponse.json(company, { status: 201 });
}, ['SUPER_ADMIN']);
