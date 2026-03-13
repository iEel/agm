// User role definitions for the e-AGM system

export type UserRole =
  | 'SUPER_ADMIN'
  | 'SYSTEM_ADMIN'
  | 'REGISTRATION_STAFF'
  | 'TALLYING_STAFF'
  | 'CHAIRMAN'
  | 'AUDITOR';

export type ResolutionType =
  | 'INFO'        // วาระแจ้งเพื่อทราบ
  | 'MAJORITY'    // มติทั่วไป >50%
  | 'TWO_THIRDS'  // มติ 2 ใน 3 >=66.66%
  | 'SPECIAL'     // มติพิเศษ >=75%
  | 'ELECTION';   // วาระเลือกตั้งกรรมการ

export type VoteChoice = 'APPROVE' | 'DISAPPROVE' | 'ABSTAIN' | 'VOID';

export type AgendaStatus = 'PENDING' | 'OPEN' | 'CLOSED';

export type EventStatus = 'DRAFT' | 'REGISTRATION' | 'VOTING' | 'CLOSED';

export type ProxyType = 'FORM_A' | 'FORM_B' | 'FORM_C';

export type AttendeeType = 'SELF' | 'PROXY';

// Display labels in Thai
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: 'ผู้ดูแลระบบสูงสุด',
  SYSTEM_ADMIN: 'ผู้จัดการระบบ',
  REGISTRATION_STAFF: 'เจ้าหน้าที่ลงทะเบียน',
  TALLYING_STAFF: 'เจ้าหน้าที่นับคะแนน',
  CHAIRMAN: 'ประธาน / พิธีกร',
  AUDITOR: 'ผู้ตรวจสอบ',
};

export const RESOLUTION_LABELS: Record<ResolutionType, string> = {
  INFO: 'แจ้งเพื่อทราบ',
  MAJORITY: 'มติทั่วไป (>50%)',
  TWO_THIRDS: 'มติ 2 ใน 3 (≥66.66%)',
  SPECIAL: 'มติพิเศษ (≥75%)',
  ELECTION: 'เลือกตั้งกรรมการ',
};

export const VOTE_LABELS: Record<VoteChoice, string> = {
  APPROVE: 'เห็นด้วย',
  DISAPPROVE: 'ไม่เห็นด้วย',
  ABSTAIN: 'งดออกเสียง',
  VOID: 'บัตรเสีย',
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: 'ร่าง',
  REGISTRATION: 'เปิดลงทะเบียน',
  VOTING: 'กำลังลงคะแนน',
  CLOSED: 'ปิดการประชุม',
};

export const AGENDA_STATUS_LABELS: Record<AgendaStatus, string> = {
  PENDING: 'รอดำเนินการ',
  OPEN: 'เปิดรับโหวต',
  CLOSED: 'ปิดโหวตแล้ว',
};

// Role-based route access configuration
export const ROLE_ACCESS: Record<string, UserRole[]> = {
  '/admin': ['SUPER_ADMIN'],
  '/setup': ['SUPER_ADMIN', 'SYSTEM_ADMIN'],
  '/registration': ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'REGISTRATION_STAFF'],
  '/mc': ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'CHAIRMAN'],
  '/tallying': ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'TALLYING_STAFF'],
  '/chairman': ['SUPER_ADMIN', 'CHAIRMAN'],
  '/auditor': ['SUPER_ADMIN', 'AUDITOR'],
};

// Navigation menu items per role
export interface NavItem {
  label: string;
  href: string;
  icon: string; // Lucide icon name
}

export interface NavSection {
  heading?: string; // Section heading (optional — null for flat items)
  items: NavItem[];
}

export const NAV_ITEMS: Record<UserRole, NavSection[]> = {
  SUPER_ADMIN: [
    {
      items: [
        { label: 'แดชบอร์ด', href: '/dashboard', icon: 'LayoutDashboard' },
      ],
    },
    {
      heading: 'ตั้งค่า',
      items: [
        { label: 'จัดการบริษัท', href: '/admin/companies', icon: 'Building2' },
        { label: 'จัดการงานประชุม', href: '/admin/events', icon: 'Calendar' },
        { label: 'จัดการผู้ใช้', href: '/admin/users', icon: 'Users' },
        { label: 'ตั้งค่าวาระ', href: '/setup/agendas', icon: 'ListOrdered' },
        { label: 'ข้อมูลผู้ถือหุ้น', href: '/setup/shareholders', icon: 'FileSpreadsheet' },
      ],
    },
    {
      heading: 'ดำเนินการ',
      items: [
        { label: 'การมอบฉันทะ', href: '/setup/proxies', icon: 'FileSignature' },
        { label: 'ลงทะเบียน', href: '/registration', icon: 'UserCheck' },
        { label: 'หน้าจอพิธีกร', href: '/mc', icon: 'Mic' },
        { label: 'นับคะแนน', href: '/tallying', icon: 'ScanLine' },
      ],
    },
    {
      heading: 'หน้าจอ',
      items: [
        { label: 'จอองค์ประชุม', href: '/quorum', icon: 'PieChart' },
        { label: 'จอผลลงคะแนน', href: '/chairman', icon: 'Monitor' },
      ],
    },
    {
      heading: 'รายงาน',
      items: [
        { label: 'ตรวจสอบ', href: '/auditor', icon: 'Shield' },
        { label: 'รายงาน', href: '/reports', icon: 'FileText' },
        { label: 'ประวัติกิจกรรม', href: '/admin/audit-logs', icon: 'ScrollText' },
      ],
    },
  ],
  SYSTEM_ADMIN: [
    {
      items: [
        { label: 'แดชบอร์ด', href: '/dashboard', icon: 'LayoutDashboard' },
      ],
    },
    {
      heading: 'ตั้งค่า',
      items: [
        { label: 'ตั้งค่าวาระ', href: '/setup/agendas', icon: 'ListOrdered' },
        { label: 'ข้อมูลผู้ถือหุ้น', href: '/setup/shareholders', icon: 'FileSpreadsheet' },
      ],
    },
    {
      heading: 'ดำเนินการ',
      items: [
        { label: 'การมอบฉันทะ', href: '/setup/proxies', icon: 'FileSignature' },
        { label: 'ลงทะเบียน', href: '/registration', icon: 'UserCheck' },
        { label: 'หน้าจอพิธีกร', href: '/mc', icon: 'Mic' },
        { label: 'นับคะแนน', href: '/tallying', icon: 'ScanLine' },
      ],
    },
    {
      heading: 'หน้าจอ',
      items: [
        { label: 'จอองค์ประชุม', href: '/quorum', icon: 'PieChart' },
      ],
    },
    {
      heading: 'รายงาน',
      items: [
        { label: 'รายงาน', href: '/reports', icon: 'FileText' },
      ],
    },
  ],
  REGISTRATION_STAFF: [
    {
      items: [
        { label: 'ลงทะเบียน', href: '/registration', icon: 'UserCheck' },
      ],
    },
  ],
  TALLYING_STAFF: [
    {
      items: [
        { label: 'นับคะแนน', href: '/tallying', icon: 'ScanLine' },
      ],
    },
  ],
  CHAIRMAN: [
    {
      heading: 'หน้าจอ',
      items: [
        { label: 'หน้าจอพิธีกร', href: '/mc', icon: 'Mic' },
        { label: 'จอองค์ประชุม', href: '/quorum', icon: 'PieChart' },
        { label: 'จอผลลงคะแนน', href: '/chairman', icon: 'Monitor' },
      ],
    },
  ],
  AUDITOR: [
    {
      heading: 'หน้าจอ',
      items: [
        { label: 'จอองค์ประชุม', href: '/quorum', icon: 'PieChart' },
      ],
    },
    {
      heading: 'รายงาน',
      items: [
        { label: 'ตรวจสอบ', href: '/auditor', icon: 'Shield' },
      ],
    },
  ],
};
