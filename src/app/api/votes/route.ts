import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/votes — List votes with summary for an agenda
async function handleGet(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
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

  const { qrData, voteChoice, agendaId, shareholderId, subAgendaId } = await req.json();

  let resolvedAgendaId = agendaId;
  let resolvedShareholderId = shareholderId;
  let ballotId: string | null = null;

  // If QR data is provided, decode it
  if (qrData) {
    const ballot = await prisma.ballot.findFirst({
      where: { qrData, meetingId: activeEvent.id },
    });

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

  // Check agenda is OPEN
  const agenda = await prisma.agenda.findUnique({ where: { id: resolvedAgendaId } });
  if (!agenda || agenda.status !== 'OPEN') {
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

  // Get shareholder's shares
  const shareholder = await prisma.shareholder.findUnique({ where: { id: resolvedShareholderId } });
  if (!shareholder) {
    return NextResponse.json({ error: 'ไม่พบผู้ถือหุ้น' }, { status: 404 });
  }

  const vote = await prisma.vote.create({
    data: {
      companyId: activeEvent.companyId,
      meetingId: activeEvent.id,
      agendaId: resolvedAgendaId,
      subAgendaId: subAgendaId || null,
      shareholderId: resolvedShareholderId,
      ballotId,
      voteChoice,
      shares: shareholder.shares,
      scannedBy: user.username,
    },
  });

  return NextResponse.json({ ...vote, shares: vote.shares.toString() }, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TALLYING_STAFF']);
