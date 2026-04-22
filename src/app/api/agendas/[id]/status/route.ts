import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import { sseManager } from '@/lib/sse-manager';

// PUT /api/agendas/[id]/status — Open/Close voting + snapshot
async function handlePut(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const agendaId = segments[segments.indexOf('agendas') + 1];
  const { status } = await req.json();

  const agenda = await prisma.agenda.findUnique({ where: { id: agendaId } });
  if (!agenda) {
    return NextResponse.json({ error: 'ไม่พบวาระ' }, { status: 404 });
  }

  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มี Active Event' }, { status: 400 });
  }
  if (user.companyId && user.companyId !== activeEvent.companyId) {
    return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึงงานประชุมนี้' }, { status: 403 });
  }
  if (agenda.meetingId !== activeEvent.id || agenda.companyId !== activeEvent.companyId) {
    return NextResponse.json({ error: 'วาระไม่ตรงกับงานประชุมที่ Active' }, { status: 403 });
  }

  // Validate transitions
  const validTransitions: Record<string, string[]> = {
    PENDING: ['OPEN'],
    OPEN: ['CLOSED'],
    CLOSED: ['ANNOUNCED'],
  };

  if (!validTransitions[agenda.status]?.includes(status)) {
    return NextResponse.json(
      { error: `ไม่สามารถเปลี่ยนจาก ${agenda.status} → ${status}` },
      { status: 400 }
    );
  }

  let updated;

  // If closing vote, create snapshot
  if (status === 'CLOSED') {
    updated = await prisma.$transaction(async (tx) => {
      const statusUpdate = await tx.agenda.updateMany({
        where: {
          id: agendaId,
          meetingId: activeEvent.id,
          status: agenda.status,
        },
        data: { status },
      });

      if (statusUpdate.count !== 1) {
        throw new Error('Agenda status changed while closing vote');
      }

    // ─── FR4.3: Merge Pre-votes from Proxy Form B/C ───
    // Auto-merge split votes from proxy that haven't been voted yet
    const proxySplitVotes = await tx.proxySplitVote.findMany({
      where: {
        agendaId,
        proxy: {
          meetingId: activeEvent.id,
          proxyType: { in: ['FORM_B', 'FORM_C'] },
        },
      },
      include: {
        proxy: {
          include: {
            shareholder: { select: { id: true, shares: true } },
          },
        },
      },
    });

    for (const sv of proxySplitVotes) {
      // Check if this shareholder already voted on this agenda (manual vote overrides pre-vote)
      const existingVote = await tx.vote.findFirst({
        where: {
          agendaId,
          shareholderId: sv.proxy.shareholderId,
          subAgendaId: sv.subAgendaId || null,
        },
      });

      if (!existingVote) {
        await tx.vote.create({
          data: {
            companyId: activeEvent.companyId,
            meetingId: activeEvent.id,
            agendaId,
            subAgendaId: sv.subAgendaId || null,
            shareholderId: sv.proxy.shareholderId,
            voteChoice: sv.voteChoice,
            shares: sv.shares,
            isPreVote: true,
            scannedBy: 'SYSTEM_PREVOTE',
          },
        });
      }
    }

    // ─── Count current attendees (not checked out) ───
    const attendeeData = await tx.registration.aggregate({
      where: { meetingId: activeEvent.id, checkoutAt: null },
      _count: true,
      _sum: { shares: true },
    });

    // ─── FR6.2: Veto — exclude veto shareholders from eligible base ───
    let vetoShares = BigInt(0);
    if (agenda.vetoShareholderIds) {
      try {
        const vetoIds: string[] = JSON.parse(agenda.vetoShareholderIds);
        if (vetoIds.length > 0) {
          const vetoShareholders = await tx.shareholder.findMany({
            where: { id: { in: vetoIds }, meetingId: activeEvent.id },
            select: { shares: true },
          });
          for (const vs of vetoShareholders) {
            vetoShares += vs.shares;
          }
        }
      } catch {
        // Invalid JSON — ignore veto
      }
    }

    // ─── Aggregate ALL votes (including merged pre-votes) ───
    const votes = await tx.vote.findMany({
      where: { agendaId, meetingId: activeEvent.id },
    });

    let approveShares = BigInt(0);
    let disapproveShares = BigInt(0);
    let abstainShares = BigInt(0);
    let voidShares = BigInt(0);

    for (const v of votes) {
      switch (v.voteChoice) {
        case 'APPROVE': approveShares += v.shares; break;
        case 'DISAPPROVE': disapproveShares += v.shares; break;
        case 'ABSTAIN': abstainShares += v.shares; break;
        case 'VOID': voidShares += v.shares; break;
      }
    }

    const totalAttendeeShares = attendeeData._sum.shares || BigInt(0);
    // Eligible shares = attendee shares minus veto shares
    const eligibleShares = totalAttendeeShares - vetoShares;

    // ─── FR7.1: Default APPROVE — "นับแบบหักลบ" ───
    // Shares that didn't submit any ballot = assume APPROVE
    const totalExplicitVotedShares = approveShares + disapproveShares + abstainShares + voidShares;
    const implicitApproveShares = eligibleShares - totalExplicitVotedShares;
    if (implicitApproveShares > BigInt(0)) {
      approveShares += implicitApproveShares;
    }

    // ─── FR6.1: Determine result based on resolution type ───
    // Calculate denominator correctly per Thai Public Company Act
    let result = 'PENDING';
    const totalVotedShares = approveShares + disapproveShares + abstainShares + voidShares;

    if (totalVotedShares > BigInt(0) || agenda.resolutionType === 'INFO') {
      switch (agenda.resolutionType) {
        case 'INFO':
          // วาระแจ้งเพื่อทราบ — ไม่มีการลงคะแนน
          result = 'ACKNOWLEDGED';
          break;

        case 'MAJORITY': {
          // มติทั่วไป (>50%): ฐาน = เห็นด้วย + ไม่เห็นด้วย (ไม่รวมงดฯ/บัตรเสีย)
          const majorityBase = approveShares + disapproveShares;
          if (majorityBase > BigInt(0)) {
            const pct = Number(approveShares * BigInt(10000) / majorityBase) / 100;
            result = pct > 50 ? 'APPROVED' : 'REJECTED';
          }
          break;
        }

        case 'TWO_THIRDS': {
          // มติ 2 ใน 3 (≥66.67%): ฐาน = เสียงทั้งหมดของผู้มาประชุม (รวมงดฯ/บัตรเสีย)
          const twoThirdsBase = totalVotedShares; // includes abstain + void
          if (twoThirdsBase > BigInt(0)) {
            const pct = Number(approveShares * BigInt(10000) / twoThirdsBase) / 100;
            result = pct >= 66.67 ? 'APPROVED' : 'REJECTED';
          }
          break;
        }

        case 'SPECIAL': {
          // มติพิเศษ (≥75%): ฐาน = เสียงทั้งหมดของผู้มาประชุม (รวมงดฯ/บัตรเสีย)
          const specialBase = totalVotedShares; // includes abstain + void
          if (specialBase > BigInt(0)) {
            const pct = Number(approveShares * BigInt(10000) / specialBase) / 100;
            result = pct >= 75 ? 'APPROVED' : 'REJECTED';
          }
          break;
        }

        case 'ELECTION': {
          // วาระเลือกตั้งกรรมการ — ใช้วิธี Sub-agenda โหวตรายบุคคล
          // ผลจะถูกแยกเป็น sub-agenda ใน VoteSnapshot.snapshotData
          result = 'ANNOUNCED'; // ประกาศผลเป็นรายบุคคล
          break;
        }

        default: {
          // Fallback: majority
          const fallbackBase = approveShares + disapproveShares;
          if (fallbackBase > BigInt(0)) {
            const pct = Number(approveShares * BigInt(10000) / fallbackBase) / 100;
            result = pct > 50 ? 'APPROVED' : 'REJECTED';
          }
          break;
        }
      }
    }

    // ─── Create or update snapshot (FR9.1: Data Snapshot) ───
    await tx.voteSnapshot.upsert({
      where: { agendaId },
      create: {
        agendaId,
        meetingId: activeEvent.id,
        totalAttendees: attendeeData._count || 0,
        totalShares: activeEvent.totalShares,
        eligibleShares,
        approveShares,
        disapproveShares,
        abstainShares,
        voidShares,
        result,
        snapshotData: JSON.stringify({
          totalVotes: votes.length,
          vetoShares: vetoShares.toString(),
          implicitApproveShares: (implicitApproveShares > BigInt(0) ? implicitApproveShares : BigInt(0)).toString(),
          preVotesMerged: proxySplitVotes.length,
          closedBy: user.username,
          closedAt: new Date().toISOString(),
        }),
      },
      update: {
        totalAttendees: attendeeData._count || 0,
        eligibleShares,
        approveShares,
        disapproveShares,
        abstainShares,
        voidShares,
        result,
        closedAt: new Date(),
        snapshotData: JSON.stringify({
          totalVotes: votes.length,
          vetoShares: vetoShares.toString(),
          implicitApproveShares: (implicitApproveShares > BigInt(0) ? implicitApproveShares : BigInt(0)).toString(),
          preVotesMerged: proxySplitVotes.length,
          closedBy: user.username,
          closedAt: new Date().toISOString(),
        }),
      },
    });

      const closedAgenda = await tx.agenda.findUniqueOrThrow({
        where: { id: agendaId },
      });
      return closedAgenda;
    });
  }

  // Update agenda status
  if (!updated) {
    updated = await prisma.agenda.update({
      where: { id: agendaId },
      data: { status },
    });
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: user.userId,
      action: `AGENDA_${status}`,
      entity: 'Agenda',
      entityId: agendaId,
      details: JSON.stringify({
        วาระ: `${agenda.orderNo}: ${agenda.titleTh}`,
        สถานะ: `${agenda.status} → ${status}`,
        changedBy: user.username,
      }),
    },
  });

  sseManager.broadcast('agenda');

  return NextResponse.json(updated);
}

export const PUT = withAuth(handlePut, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'CHAIRMAN']);
