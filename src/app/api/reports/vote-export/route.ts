import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

// GET /api/reports/vote-export — Export votes as Excel
async function handleGet(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
    include: { company: true },
  });

  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  const url = new URL(req.url);
  const agendaId = url.searchParams.get('agendaId');

  // Get votes
  const where: Record<string, unknown> = { meetingId: activeEvent.id };
  if (agendaId) where.agendaId = agendaId;

  const votes = await prisma.vote.findMany({
    where,
    include: {
      shareholder: {
        select: {
          registrationNo: true,
          titleTh: true,
          firstNameTh: true,
          lastNameTh: true,
          shares: true,
        },
      },
      agenda: {
        select: { orderNo: true, titleTh: true },
      },
    },
    orderBy: [
      { agenda: { orderNo: 'asc' } },
      { scannedAt: 'asc' },
    ],
  });

  // Build Excel data
  const rows = votes.map((v) => ({
    'วาระที่': v.agenda.orderNo,
    'วาระ': v.agenda.titleTh,
    'เลขทะเบียน': v.shareholder.registrationNo,
    'ชื่อ-นามสกุล': `${v.shareholder.titleTh || ''} ${v.shareholder.firstNameTh} ${v.shareholder.lastNameTh}`.trim(),
    'จำนวนหุ้น': Number(v.shareholder.shares),
    'คะแนนเสียง': (() => {
      switch (v.voteChoice) {
        case 'APPROVE': return 'เห็นด้วย';
        case 'DISAPPROVE': return 'ไม่เห็นด้วย';
        case 'ABSTAIN': return 'งดออกเสียง';
        case 'VOID': return 'บัตรเสีย';
        default: return v.voteChoice;
      }
    })(),
    'เวลาลงคะแนน': new Date(v.scannedAt).toLocaleString('th-TH'),
    'ผู้บันทึก': v.scannedBy || '',
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 8 },  // วาระที่
    { wch: 40 }, // วาระ
    { wch: 12 }, // เลขทะเบียน
    { wch: 30 }, // ชื่อ
    { wch: 15 }, // หุ้น
    { wch: 15 }, // คะแนน
    { wch: 20 }, // เวลา
    { wch: 15 }, // ผู้บันทึก
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vote Log');

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const filename = `vote_log_${activeEvent.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export const GET = withAuth(handleGet);
