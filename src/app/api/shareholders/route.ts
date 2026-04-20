import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/shareholders — List shareholders for active event
async function handleGet(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
  });

  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    companyId: activeEvent.companyId,
    meetingId: activeEvent.id,
  };

  if (search) {
    where.OR = [
      { firstNameTh: { contains: search } },
      { lastNameTh: { contains: search } },
      { firstNameEn: { contains: search } },
      { lastNameEn: { contains: search } },
      { registrationNo: { contains: search } },
      { idCard: { contains: search } },
    ];
  }

  const [shareholders, total, sharesAgg] = await Promise.all([
    prisma.shareholder.findMany({
      where,
      orderBy: { registrationNo: 'asc' },
      skip,
      take: limit,
    }),
    prisma.shareholder.count({ where }),
    prisma.shareholder.aggregate({
      where: { companyId: activeEvent.companyId, meetingId: activeEvent.id },
      _sum: { shares: true },
      _count: true,
    }),
  ]);

  const sumShares = sharesAgg._sum.shares || BigInt(0);

  return NextResponse.json({
    shareholders: shareholders.map(s => ({ ...s, shares: s.shares.toString() })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalShareholders: sharesAgg._count,
      sumShares: sumShares.toString(),
      eventTotalShares: activeEvent.totalShares.toString(),
      exceeded: sumShares > activeEvent.totalShares,
    },
  });
}

// POST /api/shareholders — Create single shareholder
async function handlePost(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
  });

  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  const body = await req.json();
  const { registrationNo, firstNameTh, lastNameTh, firstNameEn, lastNameEn, titleTh, titleEn, idCard, shares } = body;

  if (!registrationNo || !firstNameTh || !lastNameTh || !idCard || !shares) {
    return NextResponse.json(
      { error: 'กรุณากรอกข้อมูลที่จำเป็น (registrationNo, firstNameTh, lastNameTh, idCard, shares)' },
      { status: 400 }
    );
  }

  const shareholder = await prisma.shareholder.create({
    data: {
      companyId: activeEvent.companyId,
      meetingId: activeEvent.id,
      registrationNo,
      titleTh: titleTh || null,
      firstNameTh,
      lastNameTh,
      titleEn: titleEn || null,
      firstNameEn: firstNameEn || null,
      lastNameEn: lastNameEn || null,
      idCard,
      shares: BigInt(shares),
    },
  });

  return NextResponse.json({ ...shareholder, shares: shareholder.shares.toString() }, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
