import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// GET /api/shareholders/template — Download shareholder import template
export async function GET() {
  // Template headers — matching the import column mapping
  const headers = [
    'เลขทะเบียน',
    'คำนำหน้า',
    'ชื่อ',
    'นามสกุล',
    'Title (EN)',
    'First Name (EN)',
    'Last Name (EN)',
    'เลขประจำตัว',
    'จำนวนหุ้น',
  ];

  // Sample data rows
  const sampleData = [
    ['001', 'นาย', 'สมชาย', 'ใจดี', 'Mr.', 'Somchai', 'Jaidee', '1234567890123', 10000],
    ['002', 'นาง', 'สมหญิง', 'ดีมาก', 'Mrs.', 'Somying', 'Deemak', '9876543210987', 5000],
    ['003', 'นางสาว', 'สุดใจ', 'รักดี', 'Ms.', 'Sudjai', 'Rakdee', '1122334455667', 25000],
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  const wsData = [headers, ...sampleData];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 14 }, // เลขทะเบียน
    { wch: 12 }, // คำนำหน้า
    { wch: 16 }, // ชื่อ
    { wch: 16 }, // นามสกุล
    { wch: 12 }, // Title (EN)
    { wch: 16 }, // First Name (EN)
    { wch: 16 }, // Last Name (EN)
    { wch: 18 }, // เลขประจำตัว
    { wch: 14 }, // จำนวนหุ้น
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Shareholders');

  // Add an instruction sheet
  const instructionData = [
    ['คู่มือการนำเข้าข้อมูลผู้ถือหุ้น'],
    [''],
    ['คอลัมน์ที่จำเป็น (Required):'],
    ['  - เลขทะเบียน: เลขทะเบียนผู้ถือหุ้น (ไม่ซ้ำ)'],
    ['  - ชื่อ: ชื่อภาษาไทย'],
    ['  - จำนวนหุ้น: จำนวนหุ้นที่ถือ (ตัวเลข)'],
    [''],
    ['คอลัมน์เสริม (Optional):'],
    ['  - คำนำหน้า: นาย, นาง, นางสาว, บริษัท ฯลฯ'],
    ['  - นามสกุล: นามสกุลภาษาไทย'],
    ['  - Title (EN): Mr., Mrs., Ms., etc.'],
    ['  - First Name (EN): ชื่อภาษาอังกฤษ'],
    ['  - Last Name (EN): นามสกุลภาษาอังกฤษ'],
    ['  - เลขประจำตัว: บัตรประชาชน / เลขภาษี / พาสปอร์ต'],
    [''],
    ['หมายเหตุ:'],
    ['  - ข้อมูลแถวที่ 1 (หัวคอลัมน์) จะไม่ถูกนำเข้า'],
    ['  - หากเลขทะเบียนซ้ำ ระบบจะอัปเดตข้อมูลเดิม'],
    ['  - รองรับไฟล์ .xlsx, .xls, .csv'],
    ['  - สามารถใช้ชื่อคอลัมน์ภาษาไทยหรือภาษาอังกฤษได้'],
    ['  - หรือใช้คอลัมน์ "ชื่อ-นามสกุล" รวมกันก็ได้ เช่น "นาย สมชาย ใจดี"'],
  ];
  const instructionSheet = XLSX.utils.aoa_to_sheet(instructionData);
  instructionSheet['!cols'] = [{ wch: 60 }];
  XLSX.utils.book_append_sheet(wb, instructionSheet, 'คู่มือ');

  // Generate buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="shareholders_template.xlsx"',
    },
  });
}
