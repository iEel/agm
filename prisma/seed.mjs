// Seed script for e-AGM database
// Run with: node prisma/seed.mjs
import { PrismaClient } from '../src/generated/prisma/client.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

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

    console.log('✅ Super Admin created — username: admin');
  } else {
    console.log('⏭️  Super Admin already exists');
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
        totalShares: BigInt(100000000),
      },
    });

    console.log('✅ Demo company & event created');
  }

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
