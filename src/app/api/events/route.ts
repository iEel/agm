import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/events — List events (optionally filter by company)
export const GET = withAuth(async (req: NextRequest, _user: AuthUser) => {
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  const events = await prisma.event.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { date: 'desc' },
    include: {
      company: {
        select: { name: true, nameTh: true, logoUrl: true },
      },
      _count: {
        select: {
          shareholders: true,
          agendas: true,
          registrations: true,
        },
      },
    },
  });

  // Convert BigInt to string for JSON serialization
  const serialized = events.map((e) => ({
    ...e,
    totalShares: e.totalShares.toString(),
  }));

  return NextResponse.json(serialized);
}, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);

// POST /api/events — Create event
export const POST = withAuth(async (req: NextRequest, _user: AuthUser) => {
  const body = await req.json();
  const { companyId, name, type, date, venue, totalShares } = body;

  if (!companyId || !name || !type || !date) {
    return NextResponse.json(
      { error: 'กรุณากรอกข้อมูลให้ครบ (บริษัท, ชื่อ, ประเภท, วันที่)' },
      { status: 400 }
    );
  }

  const event = await prisma.event.create({
    data: {
      companyId,
      name,
      type,
      date: new Date(date),
      venue: venue || null,
      totalShares: BigInt(totalShares || 0),
      status: 'DRAFT',
    },
  });

  return NextResponse.json(
    { ...event, totalShares: event.totalShares.toString() },
    { status: 201 }
  );
}, ['SUPER_ADMIN']);
