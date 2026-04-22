import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import { sseManager } from '@/lib/sse-manager';

// GET /api/votes — List votes with summary for an agenda
async function handleGet(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }
  if (user.companyId && user.companyId !== activeEvent.companyId) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงงานประชุมนี้' }, { status: 403 });
  }

  const url = new URL(req.url);
  const agendaId = url.searchParams.get('agendaId');

  if (!agendaId) {
    return NextResponse.json({ error: 'กรุณาระบุ agendaId' }, { status: 400 });
  }

  const votes = await prisma.vote.findMany({
    where: { meetingId: activeEvent.id, agendaId },
    include: {
      shareholder: {
        select: {
          registrationNo: true,
          firstNameTh: true,
          lastNameTh: true,
        },
      },
    },
    orderBy: { scannedAt: 'desc' },
  });

  // Summary — subtraction method: approve = total registered − (disapprove + abstain + void)
  const summary = {
    approve: { count: 0, shares: BigInt(0) },
    disapprove: { count: 0, shares: BigInt(0) },
    abstain: { count: 0, shares: BigInt(0) },
    void: { count: 0, shares: BigInt(0) },
  };

  for (const v of votes) {
    const key = v.voteChoice.toLowerCase() as keyof typeof summary;
    if (summary[key]) {
      summary[key].count++;
      summary[key].shares += v.shares;
    }
  }

  // Get total registered shares for this meeting (for subtraction method)
  const registrations = await prisma.registration.findMany({
    where: { meetingId: activeEvent.id },
    include: { shareholder: { select: { shares: true } } },
  });
  const totalRegisteredShares = registrations.reduce((sum, r) => sum + r.shareholder.shares, BigInt(0));
  const totalRegisteredCount = registrations.length;

  // Approve = total registered − non-approve
  const nonApproveShares = summary.disapprove.shares + summary.abstain.shares + summary.void.shares;
  const nonApproveCount = summary.disapprove.count + summary.abstain.count + summary.void.count;
  summary.approve.shares = totalRegisteredShares - nonApproveShares;
  summary.approve.count = totalRegisteredCount - nonApproveCount;

  return NextResponse.json({
    votes: votes.map(v => ({ ...v, shares: v.shares.toString() })),
    summary: {
      approve: { count: summary.approve.count, shares: summary.approve.shares.toString() },
      disapprove: { count: summary.disapprove.count, shares: summary.disapprove.shares.toString() },
      abstain: { count: summary.abstain.count, shares: summary.abstain.shares.toString() },
      void: { count: summary.void.count, shares: summary.void.shares.toString() },
      totalVoted: totalRegisteredCount,
    },
  });
}

// POST /api/votes — Record a vote (from QR scan)
async function handlePost(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }
  if (user.companyId && user.companyId !== activeEvent.companyId) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงงานประชุมนี้' }, { status: 403 });
  }

  const { qrData, voteChoice, agendaId, shareholderId, subAgendaId } = await req.json();

  let resolvedAgendaId = agendaId;
  let resolvedShareholderId = shareholderId;
  let ballotId: string | null = null;

  // If QR data is provided, decode it
  if (qrData) {
    // First try: direct qrData match
    let ballot = await prisma.ballot.findFirst({
      where: { qrData, meetingId: activeEvent.id },
    });

    // Second try: parse as refCode (e.g. "Ee5-A01-S004" = E{eventPrefix}-A{agendaOrderNo}-S{registrationNo})
    if (!ballot) {
      const refMatch = qrData.match(/^E.+?-A(\d+)-S(.+)$/i);
      if (refMatch) {
        const agendaOrderNo = parseInt(refMatch[1], 10);
        const registrationNo = refMatch[2];

        // Find agenda by orderNo
        const agenda = await prisma.agenda.findFirst({
          where: { meetingId: activeEvent.id, orderNo: agendaOrderNo },
        });
        // Find shareholder by registrationNo
        const shareholder = await prisma.shareholder.findFirst({
          where: { meetingId: activeEvent.id, registrationNo },
        });

        if (agenda && shareholder) {
          ballot = await prisma.ballot.findFirst({
            where: { meetingId: activeEvent.id, agendaId: agenda.id, shareholderId: shareholder.id },
          });
        }
      }
    }

    if (!ballot) {
      return NextResponse.json({ error: 'QR Code ไม่ถูกต้องหรือไม่พบบัตรลงคะแนน' }, { status: 404 });
    }

    resolvedAgendaId = ballot.agendaId;
    resolvedShareholderId = ballot.shareholderId;
    ballotId = ballot.id;
  }

  if (!resolvedAgendaId || !resolvedShareholderId || !voteChoice) {
    return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
  }

  // Validate vote choice
  if (!['APPROVE', 'DISAPPROVE', 'ABSTAIN', 'VOID'].includes(voteChoice)) {
    return NextResponse.json({ error: 'ตัวเลือกไม่ถูกต้อง' }, { status: 400 });
  }

  // Check agenda is OPEN and belongs to the active event.
  const agenda = await prisma.agenda.findFirst({
    where: {
      id: resolvedAgendaId,
      meetingId: activeEvent.id,
      companyId: activeEvent.companyId,
      status: 'OPEN',
    },
  });
  if (!agenda) {
    return NextResponse.json({ error: 'วาระไม่ได้เปิดรับลงคะแนน' }, { status: 400 });
  }

  // Check duplicate vote
  const existingVote = await prisma.vote.findFirst({
    where: {
      agendaId: resolvedAgendaId,
      shareholderId: resolvedShareholderId,
      subAgendaId: subAgendaId || null,
    },
  });

  if (existingVote) {
    return NextResponse.json({ error: 'ผู้ถือหุ้นนี้ลงคะแนนในวาระนี้แล้ว' }, { status: 409 });
  }

  // Only checked-in shareholders in the active meeting are eligible to vote.
  const registration = await prisma.registration.findFirst({
    where: {
      meetingId: activeEvent.id,
      companyId: activeEvent.companyId,
      shareholderId: resolvedShareholderId,
      checkoutAt: null,
    },
    include: {
      shareholder: true,
    },
  });
  if (!registration) {
    return NextResponse.json({ error: 'ผู้ถือหุ้นยังไม่ได้ลงทะเบียนหรือออกจากห้องประชุมแล้ว' }, { status: 403 });
  }

  const shareholder = registration.shareholder;

  const vote = await prisma.vote.create({
    data: {
      companyId: activeEvent.companyId,
      meetingId: activeEvent.id,
      agendaId: resolvedAgendaId,
      subAgendaId: subAgendaId || null,
      shareholderId: resolvedShareholderId,
      ballotId,
      voteChoice,
      shares: registration.shares,
      scannedBy: user.username,
    },
  });

  // Audit log — human-readable details
  const voteLabels: Record<string, string> = {
    APPROVE: 'เห็นด้วย',
    DISAPPROVE: 'ไม่เห็นด้วย',
    ABSTAIN: 'งดออกเสียง',
    VOID: 'บัตรเสีย',
  };

  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: 'VOTE',
      entity: 'Vote',
      entityId: vote.id,
      details: JSON.stringify({
        วาระ: `${agenda.orderNo}: ${agenda.titleTh}`,
        ผู้ถือหุ้น: `${shareholder.firstNameTh} ${shareholder.lastNameTh} (${shareholder.registrationNo})`,
        ผลโหวต: voteLabels[voteChoice] || voteChoice,
        จำนวนหุ้น: BigInt(shareholder.shares).toLocaleString('th-TH'),
        scannedBy: user.username,
      }),
    },
  });

  sseManager.broadcast('vote');

  return NextResponse.json({ ...vote, shares: vote.shares.toString() }, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TALLYING_STAFF']);
