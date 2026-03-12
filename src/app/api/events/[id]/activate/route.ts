import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// POST /api/events/[id]/activate — Set as Active Event (FR1.3)
export const POST = withAuth(async (req: NextRequest, user: AuthUser) => {
  const url = new URL(req.url);
  const segments = url.pathname.split('/');
  const id = segments[segments.indexOf('events') + 1];

  // Verify event exists
  const event = await prisma.event.findUnique({
    where: { id },
    include: { company: { select: { nameTh: true, name: true } } },
  });

  if (!event) {
    return NextResponse.json({ error: 'ไม่พบงานประชุมนี้' }, { status: 404 });
  }

  // Deactivate all events, then activate this one
  await prisma.$transaction([
    prisma.event.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    prisma.event.update({
      where: { id },
      data: { isActive: true },
    }),
  ]);

  // Audit log
  await prisma.auditLog.create({
    data: {
      companyId: event.companyId,
      meetingId: event.id,
      userId: user.userId,
      action: 'SET_ACTIVE_EVENT',
      entity: 'Event',
      entityId: event.id,
      details: JSON.stringify({ eventName: event.name, companyName: event.company.nameTh }),
    },
  });

  return NextResponse.json({
    success: true,
    message: `เปิดใช้งาน "${event.name}" สำเร็จ`,
  });
}, ['SUPER_ADMIN']);
