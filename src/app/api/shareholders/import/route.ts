import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

// POST /api/shareholders/import — Excel/CSV upload & import
async function handlePost(req: NextRequest, user: AuthUser) {
  const activeEvent = await prisma.event.findFirst({
    where: { isActive: true },
  });

  if (!activeEvent) {
    return NextResponse.json({ error: 'ไม่มีงานประชุมที่ Active' }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'กรุณาอัปโหลดไฟล์' }, { status: 400 });
    }

    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'ไฟล์ไม่มีข้อมูล' }, { status: 400 });
    }

    // Map column names (support Thai and English headers)
    const columnMap: Record<string, string[]> = {
      registrationNo: ['registrationNo', 'registration_no', 'เลขทะเบียน', 'ลำดับ', 'No', 'no.'],
      titleTh: ['titleTh', 'คำนำหน้า', 'คำนำหน้า (ไทย)', 'Title (TH)'],
      firstNameTh: ['firstNameTh', 'ชื่อ', 'ชื่อ (ไทย)', 'First Name (TH)'],
      lastNameTh: ['lastNameTh', 'นามสกุล', 'นามสกุล (ไทย)', 'Last Name (TH)'],
      titleEn: ['titleEn', 'คำนำหน้า (อังกฤษ)', 'Title (EN)'],
      firstNameEn: ['firstNameEn', 'ชื่อ (อังกฤษ)', 'First Name (EN)'],
      lastNameEn: ['lastNameEn', 'นามสกุล (อังกฤษ)', 'Last Name (EN)'],
      // Also support combined name columns
      nameTh: ['nameTh', 'ชื่อ-นามสกุล', 'ชื่อ-นามสกุล (ไทย)', 'Name (TH)'],
      nameEn: ['name', 'nameEn', 'ชื่อ-นามสกุล (อังกฤษ)', 'Name (EN)'],
      idCard: ['idCard', 'id_card', 'เลขประจำตัว', 'เลขบัตรประชาชน', 'ID Card', 'เลขที่บัตร', 'Tax ID', 'Passport'],
      shares: ['shares', 'จำนวนหุ้น', 'Shares', 'หุ้น'],
    };

    function findValue(row: Record<string, unknown>, fieldKeys: string[]): string {
      for (const key of fieldKeys) {
        const found = Object.keys(row).find(
          (k) => k.toLowerCase().trim() === key.toLowerCase().trim()
        );
        if (found && row[found] !== undefined && row[found] !== null) {
          return String(row[found]).trim();
        }
      }
      return '';
    }

    // Split combined name "นาย สมชาย ใจดี" into parts
    function splitThaiName(fullName: string): { titleTh: string; firstNameTh: string; lastNameTh: string } {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 3) {
        return { titleTh: parts[0], firstNameTh: parts[1], lastNameTh: parts.slice(2).join(' ') };
      } else if (parts.length === 2) {
        return { titleTh: '', firstNameTh: parts[0], lastNameTh: parts[1] };
      }
      return { titleTh: '', firstNameTh: fullName, lastNameTh: '' };
    }

    function splitEnName(fullName: string): { titleEn: string; firstNameEn: string; lastNameEn: string } {
      const parts = fullName.trim().split(/\s+/);
      const titles = ['mr.', 'mrs.', 'ms.', 'miss', 'mr', 'mrs', 'ms', 'dr.', 'dr'];
      if (parts.length >= 2 && titles.includes(parts[0].toLowerCase())) {
        return { titleEn: parts[0], firstNameEn: parts[1], lastNameEn: parts.slice(2).join(' ') };
      } else if (parts.length >= 2) {
        return { titleEn: '', firstNameEn: parts[0], lastNameEn: parts.slice(1).join(' ') };
      }
      return { titleEn: '', firstNameEn: fullName, lastNameEn: '' };
    }

    const results = { created: 0, updated: 0, errors: [] as string[] };

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNum = i + 2;

      const registrationNo = findValue(row, columnMap.registrationNo);
      const idCard = findValue(row, columnMap.idCard);
      const sharesStr = findValue(row, columnMap.shares);

      // Try individual name fields first, fall back to combined name
      let titleTh = findValue(row, columnMap.titleTh);
      let firstNameTh = findValue(row, columnMap.firstNameTh);
      let lastNameTh = findValue(row, columnMap.lastNameTh);
      let titleEn = findValue(row, columnMap.titleEn);
      let firstNameEn = findValue(row, columnMap.firstNameEn);
      let lastNameEn = findValue(row, columnMap.lastNameEn);

      // If no separate fields, try combined name
      if (!firstNameTh) {
        const combinedTh = findValue(row, columnMap.nameTh);
        if (combinedTh) {
          const parsed = splitThaiName(combinedTh);
          titleTh = titleTh || parsed.titleTh;
          firstNameTh = parsed.firstNameTh;
          lastNameTh = lastNameTh || parsed.lastNameTh;
        }
      }
      if (!firstNameEn) {
        const combinedEn = findValue(row, columnMap.nameEn);
        if (combinedEn) {
          const parsed = splitEnName(combinedEn);
          titleEn = titleEn || parsed.titleEn;
          firstNameEn = parsed.firstNameEn;
          lastNameEn = lastNameEn || parsed.lastNameEn;
        }
      }

      // Validate required fields
      if (!registrationNo) {
        results.errors.push(`แถวที่ ${rowNum}: ไม่มีเลขทะเบียน`);
        continue;
      }
      if (!firstNameTh) {
        results.errors.push(`แถวที่ ${rowNum}: ไม่มีชื่อ (ภาษาไทย)`);
        continue;
      }
      if (!sharesStr || isNaN(Number(sharesStr))) {
        results.errors.push(`แถวที่ ${rowNum}: จำนวนหุ้นไม่ถูกต้อง`);
        continue;
      }

      try {
        const existing = await prisma.shareholder.findFirst({
          where: {
            companyId: activeEvent.companyId,
            meetingId: activeEvent.id,
            registrationNo,
          },
        });

        const data = {
          titleTh: titleTh || null,
          firstNameTh,
          lastNameTh: lastNameTh || '',
          titleEn: titleEn || null,
          firstNameEn: firstNameEn || null,
          lastNameEn: lastNameEn || null,
          idCard: idCard || '',
          shares: BigInt(Math.floor(Number(sharesStr))),
        };

        if (existing) {
          await prisma.shareholder.update({
            where: { id: existing.id },
            data,
          });
          results.updated++;
        } else {
          await prisma.shareholder.create({
            data: {
              companyId: activeEvent.companyId,
              meetingId: activeEvent.id,
              registrationNo,
              ...data,
            },
          });
          results.created++;
        }
      } catch (err) {
        results.errors.push(`แถวที่ ${rowNum}: ${(err as Error).message}`);
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.userId,
        action: 'IMPORT_SHAREHOLDERS',
        entity: 'Shareholder',
        details: JSON.stringify({
          fileName: file.name,
          totalRows: rawData.length,
          created: results.created,
          updated: results.updated,
          errors: results.errors.length,
          changedBy: user.username,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      totalRows: rawData.length,
      ...results,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการนำเข้าไฟล์: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN']);
