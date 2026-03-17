import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// POST /api/events/[id]/clear — Clear event data
// body: { level: 'session' | 'all' }
// session: clears registrations, votes, ballots, snapshots, proxies, audit logs + reset agendas
// all: clears everything except users & companies
async function handlePost(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const eventId = segments[segments.indexOf('events') + 1];
  const { level } = await req.json();

  if (!['session', 'all'].includes(level)) {
    return NextResponse.json({ error: 'level ต้องเป็น session หรือ all' }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: 'ไม่พบงานประชุม' }, { status: 404 });
  }

  // Log the clear action BEFORE deleting
  await prisma.auditLog.create({
    data: {
      companyId: event.companyId,
      meetingId: event.id,
      action: level === 'all' ? 'CLEAR_ALL_DATA' : 'CLEAR_SESSION_DATA',
      details: JSON.stringify({
        level,
        eventName: event.name,
        clearedBy: user.username,
        clearedAt: new Date().toISOString(),
      }),
    },
  });

  // Delete in correct order (respect foreign keys)
  // 1. Votes (depends on ballots, agendas, shareholders)
  await prisma.vote.deleteMany({ where: { meetingId: eventId } });

  // 2. Vote snapshots (depends on agendas)
  await prisma.voteSnapshot.deleteMany({
    where: { agenda: { meetingId: eventId } },
  });

  // 3. Ballots (depends on agendas, shareholders)
  await prisma.ballot.deleteMany({ where: { meetingId: eventId } });

  // 4. Registrations
  await prisma.registration.deleteMany({ where: { meetingId: eventId } });

  // 5. Proxy split votes → Proxies
  const proxyIds = await prisma.proxy.findMany({
    where: { meetingId: eventId },
    select: { id: true },
  });
  if (proxyIds.length > 0) {
    await prisma.proxySplitVote.deleteMany({
      where: { proxyId: { in: proxyIds.map(p => p.id) } },
    });
  }
  await prisma.proxy.deleteMany({ where: { meetingId: eventId } });

  // 6. Audit logs (except the one we just created)
  await prisma.auditLog.deleteMany({
    where: {
      meetingId: eventId,
      action: { notIn: ['CLEAR_ALL_DATA', 'CLEAR_SESSION_DATA'] },
    },
  });

  // 7. Reset agenda statuses back to PENDING + clear MC scripts
  await prisma.agenda.updateMany({
    where: { meetingId: eventId },
    data: { status: 'PENDING', mcScript: null },
  });

  // 8. Reset event status to DRAFT + clear quorum snapshot
  await prisma.event.update({
    where: { id: eventId },
    data: { status: 'DRAFT', closedAt: null, quorumSnapshot: null },
  });

  if (level === 'all') {
    // Also delete agendas (sub-agendas first) and shareholders
    const agendaIds = await prisma.agenda.findMany({
      where: { meetingId: eventId },
      select: { id: true },
    });
    if (agendaIds.length > 0) {
      await prisma.subAgenda.deleteMany({
        where: { agendaId: { in: agendaIds.map(a => a.id) } },
      });
    }
    await prisma.agenda.deleteMany({ where: { meetingId: eventId } });
    await prisma.shareholder.deleteMany({ where: { meetingId: eventId } });
  }

  const summary = level === 'all'
    ? 'ล้างข้อมูลทั้งหมด (ผู้ถือหุ้น + วาระ + ลงทะเบียน + โหวต) เรียบร้อย'
    : 'ล้างข้อมูลรอบประชุม (ลงทะเบียน + โหวต + บัตร + มอบฉันทะ) เรียบร้อย';

  return NextResponse.json({ success: true, message: summary });
}

export const POST = withAuth(handlePost, ['SUPER_ADMIN']);
