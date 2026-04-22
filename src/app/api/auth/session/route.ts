import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/prisma';
import { getJwtSecret } from '@/lib/auth';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token.value, getJwtSecret());

    const companyId = payload.companyId as string | undefined;

    // Get active event info
    const activeEvent = await prisma.event.findFirst({
      where: {
        isActive: true,
        ...(companyId ? { companyId } : {}),
      },
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
            decimalPrecision: activeEvent.decimalPrecision ?? 4,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
