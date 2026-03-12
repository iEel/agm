import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

/**
 * POST /api/ballots/auto-generate
 * Auto-generate ballots for a single shareholder across ALL eligible agendas.
 * For ELECTION agendas, generates separate ballots per sub-agenda (candidate).
 * Returns full data needed for printing ballot cards.
 *
 * Body: { shareholderId: string }
 */
async function handlePost(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
    include: { company: { select: { name: true, nameTh: true, logoUrl: true } } },
  });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  const { shareholderId } = await req.json();
  if (!shareholderId) {
    return NextResponse.json({ error: 'กรุณาระบุ shareholderId' }, { status: 400 });
  }

  // Fetch shareholder + verify checked in
  const shareholder = await prisma.shareholder.findUnique({ where: { id: shareholderId } });
  if (!shareholder) {
    return NextResponse.json({ error: 'ไม่พบผู้ถือหุ้น' }, { status: 404 });
  }

  const registration = await prisma.registration.findFirst({
    where: { meetingId: activeEvent.id, shareholderId, checkoutAt: null },
  });
  if (!registration) {
    return NextResponse.json({ error: 'ผู้ถือหุ้นยังไม่ได้ลงทะเบียน' }, { status: 400 });
  }

  // Get all eligible agendas (PENDING or OPEN, not INFO) with sub-agendas
  const agendas = await prisma.agenda.findMany({
    where: {
      meetingId: activeEvent.id,
      resolutionType: { not: 'INFO' },
      status: { in: ['PENDING', 'OPEN'] },
    },
    orderBy: { orderNo: 'asc' },
    include: {
      subAgendas: { orderBy: { orderNo: 'asc' } },
    },
  });

  interface BallotCard {
    agendaOrderNo: number;
    subOrderNo: number | null;
    displayOrder: string; // "3" or "5.1"
    titleTh: string;
    title: string;
    parentTitleTh: string | null;
    parentTitle: string | null;
    resolutionType: string;
    qrData: string;
    refCode: string;
  }

  const ballots: BallotCard[] = [];

  for (const agenda of agendas) {
    if (agenda.resolutionType === 'ELECTION' && agenda.subAgendas.length > 0) {
      // ELECTION: create one ballot per sub-agenda (candidate)
      for (const sub of agenda.subAgendas) {
        const existing = await prisma.ballot.findFirst({
          where: {
            meetingId: activeEvent.id,
            agendaId: agenda.id,
            shareholderId,
            qrData: { contains: sub.id.slice(0, 8) },
          },
          select: { qrData: true },
        });

        let qrData: string;
        const refCode = `E${activeEvent.id.slice(0, 2)}-A${String(agenda.orderNo).padStart(2, '0')}${sub.orderNo}-S${shareholder.registrationNo}`;

        if (existing) {
          qrData = existing.qrData;
        } else {
          const qrToken = randomUUID();
          qrData = `EAGM|${activeEvent.id.slice(0, 8)}|${agenda.id.slice(0, 8)}|${sub.id.slice(0, 8)}|${shareholderId.slice(0, 8)}|${qrToken.slice(0, 12)}`;
          await prisma.ballot.create({
            data: {
              companyId: activeEvent.companyId,
              meetingId: activeEvent.id,
              agendaId: agenda.id,
              shareholderId,
              qrData,
            },
          });
        }

        ballots.push({
          agendaOrderNo: agenda.orderNo,
          subOrderNo: sub.orderNo,
          displayOrder: `${agenda.orderNo}.${sub.orderNo}`,
          titleTh: sub.titleTh,
          title: sub.title,
          parentTitleTh: agenda.titleTh,
          parentTitle: agenda.title,
          resolutionType: agenda.resolutionType,
          qrData,
          refCode,
        });
      }
    } else {
      // Non-ELECTION: one ballot per agenda
      const existing = await prisma.ballot.findFirst({
        where: { meetingId: activeEvent.id, agendaId: agenda.id, shareholderId },
        select: { qrData: true },
      });

      let qrData: string;
      const refCode = `E${activeEvent.id.slice(0, 2)}-A${String(agenda.orderNo).padStart(2, '0')}-S${shareholder.registrationNo}`;

      if (existing) {
        qrData = existing.qrData;
      } else {
        const qrToken = randomUUID();
        qrData = `EAGM|${activeEvent.id.slice(0, 8)}|${agenda.id.slice(0, 8)}|${shareholderId.slice(0, 8)}|${qrToken.slice(0, 12)}`;
        await prisma.ballot.create({
          data: {
            companyId: activeEvent.companyId,
            meetingId: activeEvent.id,
            agendaId: agenda.id,
            shareholderId,
            qrData,
          },
        });
      }

      ballots.push({
        agendaOrderNo: agenda.orderNo,
        subOrderNo: null,
        displayOrder: `${agenda.orderNo}`,
        titleTh: agenda.titleTh,
        title: agenda.title,
        parentTitleTh: null,
        parentTitle: null,
        resolutionType: agenda.resolutionType,
        qrData,
        refCode,
      });
    }
  }

  return NextResponse.json({
    success: true,
    company: {
      name: activeEvent.company.name,
      nameTh: activeEvent.company.nameTh,
      logoUrl: activeEvent.company.logoUrl,
    },
    event: {
      name: activeEvent.name,
      type: activeEvent.type,
    },
    shareholder: {
      id: shareholder.id,
      registrationNo: shareholder.registrationNo,
      titleTh: shareholder.titleTh,
      firstNameTh: shareholder.firstNameTh,
      lastNameTh: shareholder.lastNameTh,
      titleEn: shareholder.titleEn,
      firstNameEn: shareholder.firstNameEn,
      lastNameEn: shareholder.lastNameEn,
      shares: shareholder.shares.toString(),
    },
    checkinAt: registration.checkinAt.toISOString(),
    attendeeType: registration.attendeeType,
    proxyName: registration.proxyName,
    ballots,
    total: ballots.length,
  });
}

export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'REGISTRATION_STAFF']);
