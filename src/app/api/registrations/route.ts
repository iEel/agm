import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import { sseManager } from '@/lib/sse-manager';

// GET /api/registrations — List registrations + quorum summary
async function handleGet(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get('search') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  const where: Record<string, unknown> = {
    meetingId: activeEvent.id,
  };

  const registrations = await prisma.registration.findMany({
    where,
    include: {
      shareholder: {
        select: {
          registrationNo: true,
          firstNameTh: true,
          lastNameTh: true,
          firstNameEn: true,
          lastNameEn: true,
          shares: true,
        },
      },
    },
    orderBy: { checkinAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  const total = await prisma.registration.count({ where });

  // Quorum calculation
  const quorumData = await prisma.registration.aggregate({
    where: { meetingId: activeEvent.id, checkoutAt: null },
    _count: true,
    _sum: { shares: true },
  });

  return NextResponse.json({
    registrations: registrations.map(r => ({
      ...r,
      shares: r.shares.toString(),
      shareholder: { ...r.shareholder, shares: r.shareholder.shares.toString() },
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    quorum: {
      attendees: quorumData._count || 0,
      shares: quorumData._sum.shares?.toString() || '0',
      totalShares: activeEvent.totalShares.toString(),
      percentage: activeEvent.totalShares > 0
        ? ((Number(quorumData._sum.shares || 0) / Number(activeEvent.totalShares)) * 100).toFixed(2)
        : '0',
    },
  });
}

// POST /api/registrations — Check-in a shareholder
async function handlePost(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  // Guard: only allow registration when event is in REGISTRATION or VOTING status
  if (!['REGISTRATION', 'VOTING'].includes(activeEvent.status)) {
    return NextResponse.json({ error: `ไม่สามารถลงทะเบียนได้ — สถานะงานประชุมยังเป็น "${activeEvent.status}" กรุณาเปิดลงทะเบียนก่อน` }, { status: 400 });
  }

  const { shareholderId, attendeeType, proxyType, proxyName } = await req.json();

  if (!shareholderId) {
    return NextResponse.json({ error: 'กรุณาระบุ shareholderId' }, { status: 400 });
  }

  // Check shareholder exists
  const shareholder = await prisma.shareholder.findUnique({ where: { id: shareholderId } });
  if (!shareholder) {
    return NextResponse.json({ error: 'ไม่พบผู้ถือหุ้น' }, { status: 404 });
  }

  // Check duplicate registration
  const existing = await prisma.registration.findFirst({
    where: { meetingId: activeEvent.id, shareholderId },
  });
  if (existing) {
    return NextResponse.json({ error: 'ผู้ถือหุ้นนี้ลงทะเบียนแล้ว' }, { status: 409 });
  }

  const registration = await prisma.registration.create({
    data: {
      companyId: activeEvent.companyId,
      meetingId: activeEvent.id,
      shareholderId,
      attendeeType: attendeeType || 'SELF',
      proxyType: proxyType || null,
      proxyName: proxyName || null,
      shares: shareholder.shares,
      registeredBy: user.username,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: 'CHECKIN',
      entity: 'Registration',
      entityId: registration.id,
      details: JSON.stringify({
        shareholderName: `${shareholder.titleTh || ''}${shareholder.firstNameTh} ${shareholder.lastNameTh}`,
        registrationNo: shareholder.registrationNo,
        shares: shareholder.shares.toString(),
        attendeeType: attendeeType || 'SELF',
        proxyName: proxyName || null,
        registeredBy: user.username,
      }),
    },
  });

  sseManager.broadcast('registration');

  return NextResponse.json({ ...registration, shares: registration.shares.toString() }, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'REGISTRATION_STAFF']);
