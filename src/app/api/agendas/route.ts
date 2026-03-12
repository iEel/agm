import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/agendas — List agendas for active event
async function handleGet(req: NextRequest, user: AuthUser) {
  // Get active event
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
  });

  if (!activeEvent) {
    return NextResponse.json(
      { error: 'ไม่มีงานประชุมที่ Active' },
      { status: 400 }
    );
  }

  const agendas = await prisma.agenda.findMany({
    where: { meetingId: activeEvent.id },
    include: {
      subAgendas: {
        orderBy: { orderNo: 'asc' },
      },
    },
    orderBy: { orderNo: 'asc' },
  });

  return NextResponse.json({ agendas, eventId: activeEvent.id });
}

// POST /api/agendas — Create agenda
async function handlePost(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
  });

  if (!activeEvent) {
    return NextResponse.json(
      { error: 'ไม่มีงานประชุมที่ Active' },
      { status: 400 }
    );
  }

  const body = await req.json();
  const { orderNo, title, titleTh, description, resolutionType } = body;

  if (!title || !titleTh || !resolutionType) {
    return NextResponse.json(
      { error: 'กรุณากรอกข้อมูลที่จำเป็น (title, titleTh, resolutionType)' },
      { status: 400 }
    );
  }

  // Validate resolution type
  const validTypes = ['INFO', 'MAJORITY', 'TWO_THIRDS', 'SPECIAL', 'ELECTION'];
  if (!validTypes.includes(resolutionType)) {
    return NextResponse.json(
      { error: `ประเภทมติไม่ถูกต้อง: ${resolutionType}` },
      { status: 400 }
    );
  }

  // Auto-assign orderNo if not provided
  let finalOrderNo = orderNo;
  if (!finalOrderNo) {
    const maxOrder = await prisma.agenda.findFirst({
      where: { meetingId: activeEvent.id },
      orderBy: { orderNo: 'desc' },
      select: { orderNo: true },
    });
    finalOrderNo = (maxOrder?.orderNo || 0) + 1;
  }

  const agenda = await prisma.agenda.create({
    data: {
      companyId: activeEvent.companyId,
      meetingId: activeEvent.id,
      orderNo: finalOrderNo,
      title,
      titleTh,
      description: description || null,
      resolutionType,
      status: 'PENDING',
    },
  });

  return NextResponse.json(agenda, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
