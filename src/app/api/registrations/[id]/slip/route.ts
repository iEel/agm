import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

// POST /api/registrations/[id]/slip — Generate PDPA registration slip data
async function handlePost(req: NextRequest, user: AuthUser) {
  const segments = req.nextUrl.pathname.split('/');
  const id = segments[segments.indexOf('registrations') + 1];

  const registration = await prisma.registration.findUnique({
    where: { id },
    include: {
      shareholder: true,
      event: { include: { company: true } },
    },
  });

  if (!registration) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลการลงทะเบียน' }, { status: 404 });
  }

  const slipData = {
    registrationId: registration.id,
    company: {
      name: registration.event.company.nameTh,
      nameEn: registration.event.company.name,
    },
    event: {
      name: registration.event.name,
      date: registration.event.date,
      venue: registration.event.venue,
    },
    shareholder: {
      registrationNo: registration.shareholder.registrationNo,
      name: `${registration.shareholder.titleTh || ''} ${registration.shareholder.firstNameTh} ${registration.shareholder.lastNameTh}`.trim(),
      idCard: registration.shareholder.idCard.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1-$2-$3-$4-$5'),
      shares: registration.shareholder.shares.toString(),
    },
    attendeeType: registration.attendeeType,
    proxyName: registration.proxyName,
    checkinAt: registration.checkinAt,
    registeredBy: registration.registeredBy,
    pdpaConsent: {
      th: 'ข้าพเจ้ายินยอมให้บริษัทเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของข้าพเจ้า เพื่อวัตถุประสงค์ในการจัดประชุมผู้ถือหุ้น การลงทะเบียน การลงคะแนนเสียง และการจัดทำรายงานการประชุม ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562',
      en: 'I consent to the collection, use, and disclosure of my personal data for the purposes of shareholder meeting management, registration, voting, and meeting report preparation in accordance with the Personal Data Protection Act B.E. 2562 (PDPA).',
    },
  };

  return NextResponse.json(slipData);
}

export const POST = withAuth(handlePost, ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'REGISTRATION_STAFF']);
