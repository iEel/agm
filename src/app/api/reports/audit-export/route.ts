import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

// Thai labels for action types
const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'เข้าสู่ระบบ',
  CREATE_USER: 'สร้างผู้ใช้',
  UPDATE_USER: 'แก้ไขผู้ใช้',
  DELETE_USER: 'ลบผู้ใช้',
  UPDATE_EVENT: 'แก้ไขงานประชุม',
  DELETE_EVENT: 'ลบงานประชุม',
  SET_ACTIVE_EVENT: 'เปิดใช้งานประชุม',
  AGENDA_OPEN: 'เปิดรับโหวต',
  AGENDA_CLOSED: 'ปิดโหวต',
  AGENDA_ANNOUNCED: 'ประกาศผล',
  CLEAR_SESSION_DATA: 'ล้างรอบประชุม',
  CLEAR_ALL_DATA: 'ล้างข้อมูลทั้งหมด',
  CHECKIN: 'ลงทะเบียนเข้าร่วม',
  CHECKOUT: 'ออกจากประชุม',
  RECHECKIN: 'กลับเข้าร่วมประชุม',
  CANCEL_REGISTRATION: 'ยกเลิกลงทะเบียน',
  VOTE: 'ลงคะแนนเสียง',
  CREATE_AGENDA: 'สร้างวาระ',
  UPDATE_AGENDA: 'แก้ไขวาระ',
  DELETE_AGENDA: 'ลบวาระ',
  IMPORT_SHAREHOLDERS: 'นำเข้าผู้ถือหุ้น',
};

// GET /api/reports/audit-export — Export audit logs as Excel
async function handleGet(req: NextRequest, user: AuthUser) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action') || '';
  const dateFrom = url.searchParams.get('dateFrom') || '';
  const dateTo = url.searchParams.get('dateTo') || '';

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      (where.createdAt as Record<string, unknown>).lte = to;
    }
  }

  // Fetch all matching logs (no pagination for export)
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10000, // safety limit
  });

  // Fetch user names for display
  const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))] as string[];
  const users = userIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, username: true },
      })
    : [];
  const userMap = new Map(users.map(u => [u.id, u.displayName || u.username]));

  // Build Excel rows
  const rows = logs.map((log, i) => {
    let detailStr = '';
    if (log.details) {
      try {
        const d = JSON.parse(log.details);
        detailStr = Object.entries(d)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
      } catch {
        detailStr = log.details;
      }
    }

    return {
      'ลำดับ': i + 1,
      'วันที่-เวลา': new Date(log.createdAt).toLocaleString('th-TH'),
      'ประเภท (EN)': log.action,
      'ประเภท (TH)': ACTION_LABELS[log.action] || log.action,
      'ผู้ดำเนินการ': log.userId ? (userMap.get(log.userId) || log.userId) : 'ระบบ',
      'หมวด': log.entity || '',
      'รายละเอียด': detailStr,
      'IP Address': log.ipAddress || '',
    };
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 6 },  // ลำดับ
    { wch: 22 }, // วันที่-เวลา
    { wch: 22 }, // ประเภท EN
    { wch: 22 }, // ประเภท TH
    { wch: 20 }, // ผู้ดำเนินการ
    { wch: 15 }, // หมวด
    { wch: 50 }, // รายละเอียด
    { wch: 16 }, // IP
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Logs');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const filename = `audit_log_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export const GET = withAuth(handleGet, ['SUPER_ADMIN']);
