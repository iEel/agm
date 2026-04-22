import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import * as XLSX from 'xlsx';
import { getJwtSecret } from '@/lib/auth';

// Allow large Excel files (up to 20MB)
export const maxDuration = 300; // 5 minutes max

const BATCH_SIZE = 500;

// Column mapping (support Thai and English headers)
const columnMap: Record<string, string[]> = {
  registrationNo: ['registrationNo', 'registration_no', 'เลขทะเบียน', 'ลำดับ', 'No', 'no.'],
  titleTh: ['titleTh', 'คำนำหน้า', 'คำนำหน้า (ไทย)', 'Title (TH)'],
  firstNameTh: ['firstNameTh', 'ชื่อ', 'ชื่อ (ไทย)', 'First Name (TH)'],
  lastNameTh: ['lastNameTh', 'นามสกุล', 'นามสกุล (ไทย)', 'Last Name (TH)'],
  titleEn: ['titleEn', 'คำนำหน้า (อังกฤษ)', 'Title (EN)'],
  firstNameEn: ['firstNameEn', 'ชื่อ (อังกฤษ)', 'First Name (EN)'],
  lastNameEn: ['lastNameEn', 'นามสกุล (อังกฤษ)', 'Last Name (EN)'],
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

/** Helper: write an SSE event to the stream */
function writeSSE(
  controller: ReadableStreamDefaultController,
  event: string,
  data: Record<string, unknown>
) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(msg));
}

// POST /api/shareholders/import — Excel/CSV upload & import with SSE progress
export async function POST(req: NextRequest) {
  // --- Manual auth check (we can't use withAuth because we return a stream) ---
  const token = req.cookies.get('token')?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let userId: string;
  let username: string;
  let userCompanyId: string | undefined;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const role = payload.role as string;
    if (!['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    userId = payload.userId as string;
    username = payload.username as string;
    userCompanyId = payload.companyId as string | undefined;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Check active event ---
  const activeEvent = await prisma.event.findFirst({ where: { isActive: true } });
  if (!activeEvent) {
    return new Response(JSON.stringify({ error: 'ไม่มีงานประชุมที่ Active' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (userCompanyId && userCompanyId !== activeEvent.companyId) {
    return new Response(JSON.stringify({ error: 'ไม่มีสิทธิ์เข้าถึงงานประชุมนี้' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Read & parse file ---
  let rawData: Record<string, unknown>[];
  let fileName: string;
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return new Response(JSON.stringify({ error: 'กรุณาอัปโหลดไฟล์' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    fileName = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

    if (!rawData || rawData.length === 0) {
      return new Response(JSON.stringify({ error: 'ไฟล์ไม่มีข้อมูล' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'ไม่สามารถอ่านไฟล์ได้: ' + (error as Error).message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // --- Pre-validate & prepare all rows ---
  const totalRows = rawData.length;
  const companyId = activeEvent.companyId;
  const meetingId = activeEvent.id;

  interface PreparedRow {
    rowNum: number;
    registrationNo: string;
    data: {
      titleTh: string | null;
      firstNameTh: string;
      lastNameTh: string;
      titleEn: string | null;
      firstNameEn: string | null;
      lastNameEn: string | null;
      idCard: string;
      shares: bigint;
    };
  }

  const prepared: PreparedRow[] = [];
  const validationErrors: string[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const rowNum = i + 2; // Excel is 1-indexed + header row

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
      validationErrors.push(`แถวที่ ${rowNum}: ไม่มีเลขทะเบียน`);
      continue;
    }
    if (!firstNameTh) {
      validationErrors.push(`แถวที่ ${rowNum}: ไม่มีชื่อ (ภาษาไทย)`);
      continue;
    }
    if (!sharesStr || isNaN(Number(sharesStr))) {
      validationErrors.push(`แถวที่ ${rowNum}: จำนวนหุ้นไม่ถูกต้อง`);
      continue;
    }

    prepared.push({
      rowNum,
      registrationNo,
      data: {
        titleTh: titleTh || null,
        firstNameTh,
        lastNameTh: lastNameTh || '',
        titleEn: titleEn || null,
        firstNameEn: firstNameEn || null,
        lastNameEn: lastNameEn || null,
        idCard: idCard || '',
        shares: BigInt(Math.floor(Number(sharesStr))),
      },
    });
  }

  // --- Stream response with SSE progress ---
  const stream = new ReadableStream({
    async start(controller) {
      const results = { created: 0, updated: 0, errors: [...validationErrors] };

      // Send initial event with total count
      writeSSE(controller, 'progress', {
        processed: 0,
        total: totalRows,
        valid: prepared.length,
        validationErrors: validationErrors.length,
        created: 0,
        updated: 0,
        errors: validationErrors.length,
        batchErrors: validationErrors.slice(0, 20), // send first 20 validation errors
      });

      // Process in batches
      const totalBatches = Math.ceil(prepared.length / BATCH_SIZE);
      let processedCount = 0;

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const batchStart = batchIdx * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, prepared.length);
        const batch = prepared.slice(batchStart, batchEnd);
        const batchErrors: string[] = [];

        try {
          // Process batch inside a transaction
          await prisma.$transaction(async (tx) => {
            for (const item of batch) {
              try {
                const existing = await tx.shareholder.findUnique({
                  where: {
                    meetingId_registrationNo: {
                      meetingId,
                      registrationNo: item.registrationNo,
                    },
                  },
                  select: { id: true },
                });

                if (existing) {
                  await tx.shareholder.update({
                    where: { id: existing.id },
                    data: item.data,
                  });
                  results.updated++;
                } else {
                  await tx.shareholder.create({
                    data: {
                      companyId,
                      meetingId,
                      registrationNo: item.registrationNo,
                      ...item.data,
                    },
                  });
                  results.created++;
                }
              } catch (err) {
                const msg = `แถวที่ ${item.rowNum}: ${(err as Error).message}`;
                batchErrors.push(msg);
                results.errors.push(msg);
              }
            }
          });
        } catch (err) {
          // Transaction-level failure — mark entire batch as error
          const msg = `Batch ${batchIdx + 1} failed: ${(err as Error).message}`;
          batchErrors.push(msg);
          results.errors.push(msg);
        }

        processedCount += batch.length;

        // Emit progress event
        writeSSE(controller, 'progress', {
          processed: processedCount,
          total: totalRows,
          valid: prepared.length,
          created: results.created,
          updated: results.updated,
          errors: results.errors.length,
          batchErrors: batchErrors.slice(0, 10), // limit per-batch errors sent
        });
      }

      // Audit log
      try {
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'IMPORT_SHAREHOLDERS',
            entity: 'Shareholder',
            details: JSON.stringify({
              fileName,
              totalRows,
              validRows: prepared.length,
              created: results.created,
              updated: results.updated,
              errors: results.errors.length,
              changedBy: username,
            }),
          },
        });
      } catch {
        // Don't fail the import if audit log fails
      }

      // Send completion event
      writeSSE(controller, 'complete', {
        success: true,
        totalRows,
        validRows: prepared.length,
        created: results.created,
        updated: results.updated,
        errors: results.errors.length,
        allErrors: results.errors.slice(0, 100), // limit to first 100 errors
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
