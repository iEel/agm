import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

// GET /api/ballots — List ballots for active event
async function handleGet(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  const url = new URL(req.url);
  const agendaId = url.searchParams.get('agendaId');
  const shareholderId = url.searchParams.get('shareholderId');

  const where: Record<string, unknown> = { meetingId: activeEvent.id };
  if (agendaId) where.agendaId = agendaId;
  if (shareholderId) where.shareholderId = shareholderId;

  const ballots = await prisma.ballot.findMany({
    where,
    include: {
      shareholder: {
        select: {
          registrationNo: true,
          firstNameTh: true,
          lastNameTh: true,
          shares: true,
        },
      },
      agenda: {
        select: { orderNo: true, titleTh: true, resolutionType: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ ballots });
}

// POST /api/ballots — Generate ballots for registered shareholders
async function handlePost(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  const { agendaId, shareholderIds } = await req.json();

  if (!agendaId) {
    return NextResponse.json({ error: 'กรุณาระบุ agendaId' }, { status: 400 });
  }

  const agenda = await prisma.agenda.findUnique({ where: { id: agendaId } });
  if (!agenda) {
    return NextResponse.json({ error: 'ไม่พบวาระ' }, { status: 404 });
  }

  // FR5.1: Skip INFO agendas — no ballot needed for informational items
  if (agenda.resolutionType === 'INFO') {
    return NextResponse.json(
      { error: 'วาระแจ้งเพื่อทราบไม่ต้องพิมพ์บัตรลงคะแนน' },
      { status: 400 }
    );
  }

  // FR5.2: Reject ballot printing for closed/announced agendas
  // Late arrivals after voting closes should NOT receive ballots
  if (agenda.status === 'CLOSED' || agenda.status === 'ANNOUNCED') {
    return NextResponse.json(
      { error: 'วาระนี้ปิดรับลงคะแนนแล้ว ไม่สามารถพิมพ์บัตรได้' },
      { status: 400 }
    );
  }

  // Get registered shareholders (only those checked in, not checked out)
  let registrations;
  if (shareholderIds && Array.isArray(shareholderIds)) {
    registrations = await prisma.registration.findMany({
      where: {
        meetingId: activeEvent.id,
        shareholderId: { in: shareholderIds },
        checkoutAt: null,
      },
    });
  } else {
    // Generate for ALL registered shareholders
    registrations = await prisma.registration.findMany({
      where: { meetingId: activeEvent.id, checkoutAt: null },
    });
  }

  let created = 0;
  let skipped = 0;

  for (const reg of registrations) {
    // Check if ballot already exists
    const existing = await prisma.ballot.findFirst({
      where: {
        meetingId: activeEvent.id,
        agendaId,
        shareholderId: reg.shareholderId,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    // Generate QR data: UUID-based unique token
    const qrToken = randomUUID();
    const qrData = `EAGM|${activeEvent.id.slice(0, 8)}|${agendaId.slice(0, 8)}|${reg.shareholderId.slice(0, 8)}|${qrToken.slice(0, 12)}`;

    await prisma.ballot.create({
      data: {
        companyId: activeEvent.companyId,
        meetingId: activeEvent.id,
        agendaId,
        shareholderId: reg.shareholderId,
        qrData,
      },
    });
    created++;
  }

  return NextResponse.json({
    success: true,
    created,
    skipped,
    total: registrations.length,
  });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'REGISTRATION_STAFF']);
