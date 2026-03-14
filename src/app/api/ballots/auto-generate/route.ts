import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

/**
 * POST /api/ballots/auto-generate
 * Auto-generate ballots for a single shareholder across ALL eligible agendas.
 *
 * Full logic:
 * - Walk-in (SELF): QR for all eligible agendas
 * - Proxy A:        Consolidate shares from all grantors → 1 QR/agenda with total shares
 * - Proxy B/C:      QR ONLY for blank agendas; pre-voted agendas → preVoteSummary
 *
 * Skip rules:
 * - INFO agendas (no vote)
 * - CLOSED/ANNOUNCED agendas (late arrival)
 * - Veto shareholder (per agenda vetoShareholderIds)
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

  // Fetch shareholder
  const shareholder = await prisma.shareholder.findUnique({ where: { id: shareholderId } });
  if (!shareholder) {
    return NextResponse.json({ error: 'ไม่พบผู้ถือหุ้น' }, { status: 404 });
  }

  // Verify checked in
  const registration = await prisma.registration.findFirst({
    where: { meetingId: activeEvent.id, shareholderId, checkoutAt: null },
  });
  if (!registration) {
    return NextResponse.json({ error: 'ผู้ถือหุ้นยังไม่ได้ลงทะเบียน' }, { status: 400 });
  }

  const attendeeType = registration.attendeeType; // SELF or PROXY
  const proxyType = registration.proxyType; // A, B, C or null

  // ─────────────────────────────────────────────────────────
  // Gap 4: Proxy A — share consolidation
  // If this is a proxy holder (Proxy A), find ALL shareholders who delegated to them
  // and sum up total shares. For Proxy B/C the shares come from original shareholder.
  // ─────────────────────────────────────────────────────────
  let totalShares = shareholder.shares;
  let consolidatedFrom: { name: string; shares: string }[] = [];

  if (attendeeType === 'PROXY' && proxyType === 'A') {
    // Find all proxies where this shareholder/person is the proxy holder
    // The proxy record links shareholderId (grantor) with proxyName (holder name)
    // and the registration has the proxyName matching
    const proxyName = registration.proxyName;
    if (proxyName) {
      // Find all registrations for this meeting where proxyName matches and type is PROXY/A
      const allProxyRegs = await prisma.registration.findMany({
        where: {
          meetingId: activeEvent.id,
          attendeeType: 'PROXY',
          proxyType: 'A',
          proxyName: proxyName,
          checkoutAt: null,
        },
        include: {
          shareholder: { select: { firstNameTh: true, lastNameTh: true, shares: true, registrationNo: true } },
        },
      });

      if (allProxyRegs.length > 1) {
        totalShares = BigInt(0);
        consolidatedFrom = [];
        for (const reg of allProxyRegs) {
          totalShares += reg.shareholder.shares;
          consolidatedFrom.push({
            name: `${reg.shareholder.firstNameTh} ${reg.shareholder.lastNameTh}`,
            shares: reg.shareholder.shares.toString(),
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // Gap 2+5: Proxy B/C — fetch pre-voted agendas
  // ─────────────────────────────────────────────────────────
  interface PreVoteEntry {
    agendaOrderNo: number;
    displayOrder: string;
    titleTh: string;
    title: string;
    voteChoice: string;
    shares: string;
  }

  const preVoteSummary: PreVoteEntry[] = [];
  let preVotedAgendaIds = new Set<string>();
  let preVotedSubAgendaKeys = new Set<string>(); // "agendaId:subAgendaId"
  // Map registration proxyType ('B'/'C') to proxy table format ('FORM_B'/'FORM_C')
  const proxyTypeForDB = proxyType ? `FORM_${proxyType}` : undefined;

  if (attendeeType === 'PROXY' && (proxyType === 'B' || proxyType === 'C')) {
    // Find proxy record
    const proxy = await prisma.proxy.findFirst({
      where: { meetingId: activeEvent.id, shareholderId, proxyType: proxyTypeForDB },
      include: { splitVotes: true },
    });

    if (proxy && proxy.splitVotes.length > 0) {
      for (const sv of proxy.splitVotes) {
        if (sv.subAgendaId) {
          preVotedSubAgendaKeys.add(`${sv.agendaId}:${sv.subAgendaId}`);
        } else {
          preVotedAgendaIds.add(sv.agendaId);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // Get all eligible agendas
  // ─────────────────────────────────────────────────────────
  const agendas = await prisma.agenda.findMany({
    where: {
      meetingId: activeEvent.id,
      resolutionType: { not: 'INFO' },
      status: { in: ['PENDING', 'OPEN'] },
    },
    orderBy: { orderNo: 'asc' },
    include: { subAgendas: { orderBy: { orderNo: 'asc' } } },
  });

  interface BallotCard {
    agendaOrderNo: number;
    subOrderNo: number | null;
    displayOrder: string;
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
    // ─────────────────────────────────────────────────────────
    // Gap 1: Veto exclusion — skip agenda if shareholder is in veto list
    // ─────────────────────────────────────────────────────────
    if (agenda.vetoShareholderIds) {
      try {
        const vetoIds: string[] = JSON.parse(agenda.vetoShareholderIds);
        if (vetoIds.includes(shareholderId)) {
          continue; // Skip this agenda entirely
        }
      } catch { /* invalid JSON, ignore */ }
    }

    if (agenda.resolutionType === 'ELECTION' && agenda.subAgendas.length > 0) {
      // ELECTION: one ballot per sub-agenda (candidate)
      for (const sub of agenda.subAgendas) {
        const subKey = `${agenda.id}:${sub.id}`;

        // Gap 2: Proxy B/C — check if this sub-agenda has pre-vote
        if (preVotedSubAgendaKeys.has(subKey)) {
          // Add to pre-vote summary, don't generate QR
          const sv = (await prisma.proxy.findFirst({
            where: { meetingId: activeEvent.id, shareholderId, proxyType: proxyTypeForDB },
            include: { splitVotes: { where: { agendaId: agenda.id, subAgendaId: sub.id } } },
          }))?.splitVotes[0];

          preVoteSummary.push({
            agendaOrderNo: agenda.orderNo,
            displayOrder: `${agenda.orderNo}.${sub.orderNo}`,
            titleTh: `${agenda.titleTh} (${sub.titleTh})`,
            title: `${agenda.title} (${sub.title})`,
            voteChoice: sv?.voteChoice || '-',
            shares: sv?.shares.toString() || shareholder.shares.toString(),
          });
          continue;
        }

        // Generate QR ballot — upsert to avoid duplicate constraint errors
        const existing = await prisma.ballot.findUnique({
          where: { meetingId_agendaId_shareholderId: { meetingId: activeEvent.id, agendaId: agenda.id, shareholderId } },
          select: { qrData: true },
        });

        const refCode = `E${activeEvent.id.slice(0, 2)}-A${String(agenda.orderNo).padStart(2, '0')}${sub.orderNo}-S${shareholder.registrationNo}`;
        let qrData: string;

        if (existing) {
          qrData = existing.qrData;
        } else {
          const qrToken = randomUUID();
          qrData = `EAGM|${activeEvent.id.slice(0, 8)}|${agenda.id.slice(0, 8)}|${sub.id.slice(0, 8)}|${shareholderId.slice(0, 8)}|${qrToken.slice(0, 12)}`;
          try {
            await prisma.ballot.create({
              data: { companyId: activeEvent.companyId, meetingId: activeEvent.id, agendaId: agenda.id, shareholderId, qrData },
            });
          } catch (e: unknown) {
            // If unique constraint error (P2002), ballot was created between findUnique and create — use existing
            if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
              const found = await prisma.ballot.findUnique({
                where: { meetingId_agendaId_shareholderId: { meetingId: activeEvent.id, agendaId: agenda.id, shareholderId } },
                select: { qrData: true },
              });
              if (found) qrData = found.qrData;
            } else {
              throw e;
            }
          }
        }

        ballots.push({
          agendaOrderNo: agenda.orderNo, subOrderNo: sub.orderNo,
          displayOrder: `${agenda.orderNo}.${sub.orderNo}`,
          titleTh: sub.titleTh, title: sub.title,
          parentTitleTh: agenda.titleTh, parentTitle: agenda.title,
          resolutionType: agenda.resolutionType, qrData, refCode,
        });
      }
    } else {
      // Non-ELECTION agenda

      // Gap 2: Proxy B/C — check if this agenda has pre-vote
      if (preVotedAgendaIds.has(agenda.id)) {
        const sv = (await prisma.proxy.findFirst({
          where: { meetingId: activeEvent.id, shareholderId, proxyType: proxyTypeForDB },
          include: { splitVotes: { where: { agendaId: agenda.id, subAgendaId: null } } },
        }))?.splitVotes[0];

        preVoteSummary.push({
          agendaOrderNo: agenda.orderNo,
          displayOrder: `${agenda.orderNo}`,
          titleTh: agenda.titleTh,
          title: agenda.title,
          voteChoice: sv?.voteChoice || '-',
          shares: sv?.shares.toString() || shareholder.shares.toString(),
        });
        continue; // Don't generate QR
      }

      // Generate QR ballot — upsert to avoid duplicate constraint errors
      const existing = await prisma.ballot.findUnique({
        where: { meetingId_agendaId_shareholderId: { meetingId: activeEvent.id, agendaId: agenda.id, shareholderId } },
        select: { qrData: true },
      });

      const refCode = `E${activeEvent.id.slice(0, 2)}-A${String(agenda.orderNo).padStart(2, '0')}-S${shareholder.registrationNo}`;
      let qrData: string;

      if (existing) {
        qrData = existing.qrData;
      } else {
        const qrToken = randomUUID();
        qrData = `EAGM|${activeEvent.id.slice(0, 8)}|${agenda.id.slice(0, 8)}|${shareholderId.slice(0, 8)}|${qrToken.slice(0, 12)}`;
        try {
          await prisma.ballot.create({
            data: { companyId: activeEvent.companyId, meetingId: activeEvent.id, agendaId: agenda.id, shareholderId, qrData },
          });
        } catch (e: unknown) {
          if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
            const found = await prisma.ballot.findUnique({
              where: { meetingId_agendaId_shareholderId: { meetingId: activeEvent.id, agendaId: agenda.id, shareholderId } },
              select: { qrData: true },
            });
            if (found) qrData = found.qrData;
          } else {
            throw e;
          }
        }
      }

      ballots.push({
        agendaOrderNo: agenda.orderNo, subOrderNo: null,
        displayOrder: `${agenda.orderNo}`,
        titleTh: agenda.titleTh, title: agenda.title,
        parentTitleTh: null, parentTitle: null,
        resolutionType: agenda.resolutionType, qrData, refCode,
      });
    }
  }

  // Sort pre-vote summary by order
  preVoteSummary.sort((a, b) => {
    const aNum = parseFloat(a.displayOrder);
    const bNum = parseFloat(b.displayOrder);
    return aNum - bNum;
  });

  return NextResponse.json({
    success: true,
    company: {
      name: activeEvent.company.name,
      nameTh: activeEvent.company.nameTh,
      logoUrl: activeEvent.company.logoUrl,
    },
    event: { name: activeEvent.name, type: activeEvent.type, date: activeEvent.date?.toISOString(), venue: activeEvent.venue },
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
    attendeeType,
    proxyType,
    proxyName: registration.proxyName,
    // Gap 4: consolidated shares for Proxy A
    totalShares: totalShares.toString(),
    consolidatedFrom: consolidatedFrom.length > 1 ? consolidatedFrom : null,
    // Ballot cards (QR)
    ballots,
    // Gap 3: Pre-vote summary for Proxy B/C
    preVoteSummary: preVoteSummary.length > 0 ? preVoteSummary : null,
    total: ballots.length,
  });
}

export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'REGISTRATION_STAFF']);
