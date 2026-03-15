import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

// GET /api/reports/registration-export — Registration log
async function handleGet(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
  });

  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  const registrations = await prisma.registration.findMany({
    where: { meetingId: activeEvent.id },
    include: {
      shareholder: {
        select: {
          registrationNo: true,
          titleTh: true,
          firstNameTh: true,
          lastNameTh: true,
          idCard: true,
          shares: true,
        },
      },
    },
    orderBy: { checkinAt: 'asc' },
  });

  const PROXY_TYPE_LABELS: Record<string, string> = {
    A: 'แบบ ก.', FORM_A: 'แบบ ก.',
    B: 'แบบ ข.', FORM_B: 'แบบ ข.',
    C: 'แบบ ค.', FORM_C: 'แบบ ค.',
  };

  const rows = registrations.map((r, i) => ({
    'ลำดับ': i + 1,
    'เลขทะเบียน': r.shareholder.registrationNo,
    'ชื่อ-นามสกุล': `${r.shareholder.titleTh || ''} ${r.shareholder.firstNameTh} ${r.shareholder.lastNameTh}`.trim(),
    'เลขบัตร': r.shareholder.idCard,
    'จำนวนหุ้น': Number(r.shareholder.shares),
    'ประเภท': r.attendeeType === 'SELF' ? 'มาด้วยตนเอง' : 'ผู้รับมอบฉันทะ',
    'ประเภทมอบฉันทะ': r.proxyType ? (PROXY_TYPE_LABELS[r.proxyType] || r.proxyType) : '',
    'ผู้รับมอบ': r.proxyName || '',
    'เวลาลงทะเบียน': new Date(r.checkinAt).toLocaleString('th-TH'),
    'เวลาออก': r.checkoutAt ? new Date(r.checkoutAt).toLocaleString('th-TH') : '',
    'ผู้ลงทะเบียน': r.registeredBy,
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 6 }, { wch: 12 }, { wch: 30 }, { wch: 16 },
    { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 25 },
    { wch: 20 }, { wch: 20 }, { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const filename = `registration_log_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export const GET = withAuth(handleGet);
