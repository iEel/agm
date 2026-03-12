import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// GET /api/sse/quorum — Server-Sent Events for real-time quorum
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();
  let isActive = true;

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        if (!isActive) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          isActive = false;
        }
      };

      const fetchAndSend = async () => {
        try {
          const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
          if (!activeEvent) {
            sendEvent({ type: 'error', message: 'No active event' });
            return;
          }

          // Quorum data
          const quorumData = await prisma.registration.aggregate({
            where: { meetingId: activeEvent.id, checkoutAt: null },
            _count: true,
            _sum: { shares: true },
          });

          const totalRegistered = await prisma.registration.count({
            where: { meetingId: activeEvent.id },
          });

          // Active agendas status
          const agendas = await prisma.agenda.findMany({
            where: { meetingId: activeEvent.id },
            select: { id: true, orderNo: true, titleTh: true, status: true, resolutionType: true },
            orderBy: { orderNo: 'asc' },
          });

          // FR8.3: Check if any agenda is OPEN — freeze quorum during voting
          const openAgenda = agendas.find((a) => a.status === 'OPEN');
          const isVotingActive = !!openAgenda;

          // Get vote counts for OPEN agendas
          let voteSummary = null;

          if (openAgenda) {
            const votes = await prisma.vote.findMany({
              where: { agendaId: openAgenda.id, meetingId: activeEvent.id },
              select: { voteChoice: true, shares: true },
            });

            const summary = { approve: BigInt(0), disapprove: BigInt(0), abstain: BigInt(0), void: BigInt(0), totalVoted: 0 };
            for (const v of votes) {
              const key = v.voteChoice.toLowerCase() as keyof typeof summary;
              if (key !== 'totalVoted' && summary[key] !== undefined) {
                (summary[key] as bigint) += v.shares;
              }
              summary.totalVoted++;
            }

            voteSummary = {
              agendaId: openAgenda.id,
              agendaOrderNo: openAgenda.orderNo,
              agendaTitle: openAgenda.titleTh,
              resolutionType: openAgenda.resolutionType,
              approve: summary.approve.toString(),
              disapprove: summary.disapprove.toString(),
              abstain: summary.abstain.toString(),
              void: summary.void.toString(),
              totalVoted: summary.totalVoted,
            };
          }

          sendEvent({
            type: 'update',
            timestamp: new Date().toISOString(),
            quorum: {
              attendees: quorumData._count || 0,
              totalRegistered,
              shares: (quorumData._sum.shares || BigInt(0)).toString(),
              totalShares: activeEvent.totalShares.toString(),
              percentage: activeEvent.totalShares > 0
                ? ((Number(quorumData._sum.shares || 0) / Number(activeEvent.totalShares)) * 100).toFixed(2)
                : '0',
              frozen: isVotingActive, // FR8.3: flag for frontend to stop updating quorum display
            },
            agendas: agendas.map((a) => ({ id: a.id, orderNo: a.orderNo, titleTh: a.titleTh, status: a.status, resolutionType: a.resolutionType })),
            voteSummary,
          });
        } catch (err) {
          console.error('SSE error:', err);
        }
      };

      // Send initial data immediately
      await fetchAndSend();

      // Then send every 3 seconds
      const interval = setInterval(async () => {
        if (!isActive) {
          clearInterval(interval);
          return;
        }
        await fetchAndSend();
      }, 3000);

      // Clean up when client disconnects
      req.signal.addEventListener('abort', () => {
        isActive = false;
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
