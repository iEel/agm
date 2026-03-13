import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// GET /api/audit-logs — List audit logs with filters
async function handleGet(req: NextRequest, user: AuthUser) {
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const action = url.searchParams.get('action') || '';
  const userId = url.searchParams.get('userId') || '';
  const dateFrom = url.searchParams.get('dateFrom') || '';
  const dateTo = url.searchParams.get('dateTo') || '';
  const search = url.searchParams.get('search') || '';

  // Build where clause
  const where: Record<string, unknown> = {};

  if (action) {
    where.action = action;
  }
  if (userId) {
    where.userId = userId;
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, unknown>).lte = to;
    }
  }
  if (search) {
    where.OR = [
      { action: { contains: search } },
      { entity: { contains: search } },
      { userId: { contains: search } },
      { details: { contains: search } },
    ];
  }

  const [logs, total, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
    // Get distinct action types for filter dropdown
    prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    }),
  ]);

  return NextResponse.json({
    logs,
    actions: actions.map(a => a.action),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export const GET = withAuth(handleGet, ['SUPER_ADMIN']);
