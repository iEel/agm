import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'fallback-secret-change-me'
);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token.value, JWT_SECRET);

    // Get active event info
    const activeEvent = await prisma.event.findFirst({
      where: { isActive: true },
      include: {
        company: {
          select: { name: true, nameTh: true, logoUrl: true },
        },
      },
    });

    return NextResponse.json({
      user: {
        id: payload.userId,
        username: payload.username,
        displayName: payload.displayName,
        role: payload.role,
        companyId: payload.companyId,
      },
      activeEvent: activeEvent
        ? {
            id: activeEvent.id,
            name: activeEvent.name,
            status: activeEvent.status,
            companyName: activeEvent.company.nameTh || activeEvent.company.name,
            companyLogo: activeEvent.company.logoUrl,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
