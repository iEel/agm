import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/public/vote-results?agendaOrder=1
 * Public vote results per agenda — matching Thai AGM formal display
 * 
 * DEDUCTION METHOD: System only scans DISAPPROVE/ABSTAIN/VOID ballots.
 * APPROVE = totalAttendeeShares - (DISAPPROVE + ABSTAIN + VOID)
 * 
 * Denominator logic per resolution type:
 * - MAJORITY (>50%):      denominator = approve + disapprove (excludes abstain & void)
 * - SPECIAL  (≥75%):      denominator = all attendee shares (= approve + disapprove + abstain + void)
 * - TWO_THIRDS (≥66.66%): denominator = all attendee shares
 * - ELECTION (>50% each): same as MAJORITY but per sub-agenda (candidate)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const agendaOrder = parseInt(url.searchParams.get('agendaOrder') || '1');

    const activeEvent = await prisma.event.findFirst({
      where: { isActive: true },
      include: { company: { select: { nameTh: true, name: true, logoUrl: true } } },
    });

    if (!activeEvent) {
      return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
    }

    // Get all agendas (for dropdown navigation)
    const allAgendas = await prisma.agenda.findMany({
      where: { meetingId: activeEvent.id },
      select: { id: true, orderNo: true, titleTh: true, title: true, resolutionType: true, status: true },
      orderBy: { orderNo: 'asc' },
    });

    // Get the selected agenda
    const agenda = await prisma.agenda.findFirst({
      where: { meetingId: activeEvent.id, orderNo: agendaOrder },
      include: {
        subAgendas: { orderBy: { orderNo: 'asc' } },
        snapshot: true,
      },
    });

    if (!agenda) {
      return NextResponse.json({ error: 'ไม่พบวาระที่ระบุ' }, { status: 404 });
    }

    // ─── Quorum: separate "additional" vs "total" ───
    // Real-time count (used if agenda not yet closed)
    const liveQuorum = await prisma.registration.aggregate({
      where: { meetingId: activeEvent.id, checkoutAt: null },
      _count: true,
      _sum: { shares: true },
    });
    const liveCount = liveQuorum._count || 0;
    const liveShares = liveQuorum._sum.shares || BigInt(0);

    // This agenda's snapshot (if closed — frozen data)
    const thisSnapshot = agenda.snapshot;

    // Total = snapshot if closed, otherwise real-time
    const totalCount = thisSnapshot ? thisSnapshot.totalAttendees : liveCount;
    const totalShares = thisSnapshot ? thisSnapshot.eligibleShares : liveShares;

    // Previous agenda's snapshot (for "additional" calculation)
    let additionalCount = totalCount;
    let additionalShares = totalShares;

    if (agenda.orderNo > 1) {
      const prevAgenda = allAgendas.find(a => a.orderNo === agenda.orderNo - 1);
      if (prevAgenda) {
        const prevSnapshot = await prisma.voteSnapshot.findUnique({
          where: { agendaId: prevAgenda.id },
          select: { totalAttendees: true, eligibleShares: true },
        });
        if (prevSnapshot) {
          additionalCount = totalCount - prevSnapshot.totalAttendees;
          additionalShares = totalShares - prevSnapshot.eligibleShares;
          // Ensure non-negative
          if (additionalCount < 0) additionalCount = 0;
          if (additionalShares < BigInt(0)) additionalShares = BigInt(0);
        }
      }
    }

    // attendeeShares used for vote calculation (deduction base)
    const attendeeCount = totalCount;
    const attendeeShares = totalShares;

    /**
     * Compute vote results using the DEDUCTION method:
     * - System only collects/scans: DISAPPROVE, ABSTAIN, VOID ballots
     * - APPROVE = totalEligibleShares - (DISAPPROVE + ABSTAIN + VOID)
     * 
     * @param votes - scanned votes (DISAPPROVE, ABSTAIN, VOID only)
     * @param resolutionType - determines denominator & threshold
     * @param eligibleShares - total shares of attendees eligible to vote in this agenda
     */
    const computeResults = (
      votes: { voteChoice: string; shares: bigint }[],
      resolutionType: string,
      eligibleShares: bigint
    ) => {
      let disapprove = BigInt(0);
      let abstain = BigInt(0);
      let voided = BigInt(0);

      for (const v of votes) {
        switch (v.voteChoice) {
          case 'DISAPPROVE': disapprove += v.shares; break;
          case 'ABSTAIN': abstain += v.shares; break;
          case 'VOID': voided += v.shares; break;
          // APPROVE votes are NOT scanned — computed via deduction
        }
      }

      // APPROVE = total eligible shares - all scanned ballots
      const approve = eligibleShares - disapprove - abstain - voided;

      // Denominator depends on resolution type
      let denominator: bigint;
      let threshold: number;
      let thresholdLabel: string;

      switch (resolutionType) {
        case 'SPECIAL':
          // ≥75% of ALL attendee shares (approve + disapprove + abstain + void)
          denominator = eligibleShares;
          threshold = 75;
          thresholdLabel = '≥ 3/4 (75%)';
          break;
        case 'TWO_THIRDS':
          // ≥66.67% of ALL attendee shares
          denominator = eligibleShares;
          threshold = 66.6667;
          thresholdLabel = '≥ 2/3 (66.67%)';
          break;
        case 'ELECTION':
        case 'MAJORITY':
        default:
          // >50% of (approve + disapprove) — excludes abstain & void
          denominator = approve + disapprove;
          threshold = 50;
          thresholdLabel = '> 50% (มติทั่วไป)';
          break;
      }

      const approvePercent = denominator > BigInt(0)
        ? (Number(approve) / Number(denominator) * 100)
        : 0;
      const disapprovePercent = denominator > BigInt(0)
        ? (Number(disapprove) / Number(denominator) * 100)
        : 0;

      const total = approve + disapprove;

      // Check if passed
      let passed: boolean;
      if (resolutionType === 'SPECIAL') {
        passed = approvePercent >= 75;
      } else if (resolutionType === 'TWO_THIRDS') {
        passed = approvePercent >= 66.6667;
      } else {
        passed = approvePercent > 50;
      }

      return {
        approve: approve.toString(),
        disapprove: disapprove.toString(),
        abstain: abstain.toString(),
        voided: voided.toString(),
        total: total.toString(),
        approvePercent: approvePercent.toFixed(4),
        disapprovePercent: disapprovePercent.toFixed(4),
        totalPercent: denominator > BigInt(0) ? ((Number(total) / Number(denominator)) * 100).toFixed(4) : '0.0000',
        denominator: denominator.toString(),
        threshold,
        thresholdLabel,
        passed,
        result: passed ? 'อนุมัติ' : 'ไม่อนุมัติ',
      };
    };

    // For ELECTION type, compute per sub-agenda (candidate)
    let subAgendaResults = null;
    if (agenda.resolutionType === 'ELECTION' && agenda.subAgendas.length > 0) {
      const subResults = [];
      for (const sub of agenda.subAgendas) {
        const votes = await prisma.vote.findMany({
          where: { agendaId: agenda.id, subAgendaId: sub.id },
          select: { voteChoice: true, shares: true },
        });
        const result = computeResults(votes, 'ELECTION', attendeeShares);
        subResults.push({
          orderNo: sub.orderNo,
          title: sub.title,
          titleTh: sub.titleTh,
          ...result,
        });
      }
      subAgendaResults = subResults;
    }

    // Main agenda vote totals
    const mainVotes = await prisma.vote.findMany({
      where: {
        agendaId: agenda.id,
        ...(agenda.resolutionType === 'ELECTION' ? {} : { subAgendaId: null }),
      },
      select: { voteChoice: true, shares: true },
    });
    const mainResults = computeResults(mainVotes, agenda.resolutionType, attendeeShares);

    // Get open/close timestamps from audit logs
    const openLog = await prisma.auditLog.findFirst({
      where: { action: 'AGENDA_OPEN', entityId: agenda.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const closeLog = await prisma.auditLog.findFirst({
      where: { action: 'AGENDA_CLOSED', entityId: agenda.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    return NextResponse.json({
      company: {
        nameTh: activeEvent.company.nameTh,
        nameEn: activeEvent.company.name,
        logoUrl: activeEvent.company.logoUrl,
      },
      event: {
        name: activeEvent.name,
        type: activeEvent.type,
        date: activeEvent.date.toISOString(),
        venue: activeEvent.venue,
      },
      quorum: {
        additionalCount,
        additionalShares: additionalShares.toString(),
        attendeeCount,
        attendeeShares: attendeeShares.toString(),
      },
      agenda: {
        orderNo: agenda.orderNo,
        title: agenda.title,
        titleTh: agenda.titleTh,
        description: agenda.description,
        resolutionType: agenda.resolutionType,
        status: agenda.status,
        openedAt: openLog?.createdAt?.toISOString() || null,
        closedAt: closeLog?.createdAt?.toISOString() || null,
      },
      results: mainResults,
      subAgendaResults,
      allAgendas: allAgendas.map(a => ({
        orderNo: a.orderNo,
        titleTh: a.titleTh,
        title: a.title,
        resolutionType: a.resolutionType,
        status: a.status,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Public vote results error:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
