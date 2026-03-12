import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// POST /api/seed — One-time seed for Super Admin + Demo data
// ใช้ครั้งเดียวตอนเริ่มระบบ
export async function POST() {
  try {
    const results: string[] = [];

    // ===== Super Admin =====
    const adminUsername = 'admin';
    const adminPassword = 'admin1234';

    const existingAdmin = await prisma.user.findUnique({
      where: { username: adminUsername },
    });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      
      await prisma.user.create({
        data: {
          username: adminUsername,
          passwordHash,
          displayName: 'System Administrator',
          role: 'SUPER_ADMIN',
          isActive: true,
        },
      });

      results.push('✅ Super Admin created (admin / admin1234)');
    } else {
      results.push('⏭️ Super Admin already exists');
    }

    // ===== Demo Company =====
    const demoCompany = await prisma.company.findFirst({
      where: { name: 'Demo Corporation' },
    });

    if (!demoCompany) {
      const company = await prisma.company.create({
        data: {
          name: 'Demo Corporation',
          nameTh: 'บริษัท เดโม คอร์ปอเรชั่น จำกัด (มหาชน)',
          directors: JSON.stringify([
            { nameTh: 'นายสมชาย ใจดี', nameEn: 'Mr. Somchai Jaidee', position: 'ประธานกรรมการ' },
            { nameTh: 'นางสาวสมหญิง ดีใจ', nameEn: 'Ms. Somying Deejai', position: 'กรรมการผู้จัดการ' },
          ]),
        },
      });

      await prisma.event.create({
        data: {
          companyId: company.id,
          name: 'AGM 2569',
          type: 'AGM',
          date: new Date('2026-04-25'),
          venue: 'ห้องประชุม Grand Ballroom, โรงแรมแกรนด์ กรุงเทพ',
          status: 'DRAFT',
          isActive: true,
          totalShares: BigInt(100000000),
        },
      });

      results.push('✅ Demo company & event created');
    } else {
      results.push('⏭️ Demo company already exists');
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      { error: 'Seed failed', details: String(error) },
      { status: 500 }
    );
  }
}
