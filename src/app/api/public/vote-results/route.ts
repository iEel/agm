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
    const agendaOrderParam = url.searchParams.get('agendaOrder') || '1';
    // Support decimal format: "5.1" means agenda 5, sub-agenda 1
    const [mainOrderStr, subOrderStr] = agendaOrderParam.split('.');
    const agendaOrder = parseInt(mainOrderStr);
    const selectedSubOrder = subOrderStr ? parseInt(subOrderStr) : null;

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
    // Agenda 1: no previous → additional = 0 (everyone is original attendee)
    // Agenda 2+: additional = current − previous snapshot
    let additionalCount = 0;
    let additionalShares = BigInt(0);

    if (agenda.orderNo > 1) {
      // Find the closest previous agenda that has a snapshot
      // (INFO agendas are skipped since they never create snapshots)
      const prevAgendas = [...allAgendas]
        .filter(a => a.orderNo < agenda.orderNo)
        .sort((a, b) => b.orderNo - a.orderNo);
      
      for (const candidate of prevAgendas) {
        const prevSnapshot = await prisma.voteSnapshot.findUnique({
          where: { agendaId: candidate.id },
          select: { totalAttendees: true, eligibleShares: true },
        });
        if (prevSnapshot) {
          additionalCount = totalCount - prevSnapshot.totalAttendees;
          additionalShares = totalShares - prevSnapshot.eligibleShares;
          if (additionalCount < 0) additionalCount = 0;
          if (additionalShares < BigInt(0)) additionalShares = BigInt(0);
          break;
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
    const dp = activeEvent.decimalPrecision || 4;

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
        approvePercent: approvePercent.toFixed(dp),
        disapprovePercent: disapprovePercent.toFixed(dp),
        totalPercent: denominator > BigInt(0) ? ((Number(total) / Number(denominator)) * 100).toFixed(dp) : '0'.padEnd(dp + 2, '0'),
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
      // If a specific sub-agenda is selected, only compute that one
      const subsToProcess = selectedSubOrder
        ? agenda.subAgendas.filter(s => s.orderNo === selectedSubOrder)
        : agenda.subAgendas;
      const subResults = [];
      for (const sub of subsToProcess) {
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

    // Get open/close timestamps from audit logs (only if agenda has been opened)
    let openLog = null;
    let closeLog = null;
    if (agenda.status !== 'PENDING') {
      openLog = await prisma.auditLog.findFirst({
        where: { action: 'AGENDA_OPEN', entityId: agenda.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      closeLog = await prisma.auditLog.findFirst({
        where: { action: 'AGENDA_CLOSED', entityId: agenda.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
    }

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
        titleTh: selectedSubOrder && agenda.resolutionType === 'ELECTION'
          ? `${agenda.titleTh} : ${agenda.subAgendas.find(s => s.orderNo === selectedSubOrder)?.titleTh || ''}`
          : agenda.titleTh,
        description: agenda.description,
        resolutionType: agenda.resolutionType,
        status: agenda.status,
        openedAt: openLog?.createdAt?.toISOString() || null,
        closedAt: closeLog?.createdAt?.toISOString() || null,
      },
      results: mainResults,
      subAgendaResults,
      // Expand election agendas into sub-agenda entries (5.1, 5.2, ...)
      allAgendas: await (async () => {
        const expanded: Array<{ orderNo: number; subOrderNo?: number; displayNo: string; titleTh: string; title: string; resolutionType: string; status: string }> = [];
        for (const a of allAgendas) {
          if (a.resolutionType === 'ELECTION') {
            // Fetch sub-agendas for this election agenda
            const subs = await prisma.subAgenda.findMany({
              where: { agendaId: a.id },
              select: { orderNo: true, titleTh: true, title: true },
              orderBy: { orderNo: 'asc' },
            });
            if (subs.length > 0) {
              for (const sub of subs) {
                expanded.push({
                  orderNo: a.orderNo,
                  subOrderNo: sub.orderNo,
                  displayNo: `${a.orderNo}.${sub.orderNo}`,
                  titleTh: `${a.titleTh} : ${sub.titleTh}`,
                  title: `${a.title} : ${sub.title}`,
                  resolutionType: a.resolutionType,
                  status: a.status,
                });
              }
            } else {
              // No sub-agendas yet, show as normal
              expanded.push({
                orderNo: a.orderNo,
                displayNo: `${a.orderNo}`,
                titleTh: a.titleTh,
                title: a.title,
                resolutionType: a.resolutionType,
                status: a.status,
              });
            }
          } else {
            expanded.push({
              orderNo: a.orderNo,
              displayNo: `${a.orderNo}`,
              titleTh: a.titleTh,
              title: a.title,
              resolutionType: a.resolutionType,
              status: a.status,
            });
          }
        }
        return expanded;
      })(),
      selectedSubOrder,
      decimalPrecision: dp,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Public vote results error:', err);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด' }, { status: 500 });
  }
}
