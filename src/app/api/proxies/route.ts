import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/proxies — List proxies for active event
async function handleGet(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  const proxies = await prisma.proxy.findMany({
    where: { meetingId: activeEvent.id },
    include: {
      shareholder: {
        select: {
          registrationNo: true,
          firstNameTh: true,
          lastNameTh: true,
          shares: true,
        },
      },
      splitVotes: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ proxies });
}

// POST /api/proxies — Create proxy
async function handlePost(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  const { shareholderId, proxyType, proxyName, proxyIdCard, splitVotes } = await req.json();

  if (!shareholderId || !proxyType || !proxyName) {
    return NextResponse.json(
      { error: 'กรุณากรอก shareholderId, proxyType, proxyName' },
      { status: 400 }
    );
  }

  // Validate proxy type
  if (!['FORM_A', 'FORM_B', 'FORM_C'].includes(proxyType)) {
    return NextResponse.json({ error: 'ประเภทหนังสือมอบฉันทะไม่ถูกต้อง' }, { status: 400 });
  }

  const proxy = await prisma.proxy.create({
    data: {
      companyId: activeEvent.companyId,
      meetingId: activeEvent.id,
      shareholderId,
      proxyType,
      proxyName,
      proxyIdCard: proxyIdCard || null,
    },
  });

  // Create split votes for Form B/C
  if (splitVotes && Array.isArray(splitVotes) && splitVotes.length > 0) {
    // FR4.2: Validate total split shares don't exceed shareholder's actual shares
    const shareholder = await prisma.shareholder.findUnique({
      where: { id: shareholderId },
      select: { shares: true },
    });

    if (shareholder) {
      const totalSplitShares = splitVotes.reduce(
        (sum: bigint, sv: { shares: string | number }) => sum + BigInt(sv.shares),
        BigInt(0)
      );

      if (totalSplitShares > shareholder.shares) {
        // Rollback: delete the proxy we just created
        await prisma.proxy.delete({ where: { id: proxy.id } });
        return NextResponse.json(
          { error: `ผลรวมหุ้น split vote (${totalSplitShares}) เกินสิทธิที่มี (${shareholder.shares})` },
          { status: 400 }
        );
      }
    }

    for (const sv of splitVotes) {
      await prisma.proxySplitVote.create({
        data: {
          proxyId: proxy.id,
          agendaId: sv.agendaId,
          subAgendaId: sv.subAgendaId || null,
          voteChoice: sv.voteChoice,
          shares: BigInt(sv.shares),
        },
      });
    }
  }

  const created = await prisma.proxy.findUnique({
    where: { id: proxy.id },
    include: { splitVotes: true },
  });

  return NextResponse.json(created, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
