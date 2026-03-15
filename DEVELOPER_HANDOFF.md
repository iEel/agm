# 📋 Developer Handoff — e-AGM & QR Ballot System

> **สถานะ**: Phase 1-10 เสร็จสมบูรณ์ ✅ | FR Audit + State Machine + Ballot Print + MC Screen + SSE Real-time
> **อัปเดตล่าสุด**: 15 มีนาคม 2569 (v19 — SSE Real-time Updates + BigInt Fix + Registration Search & Pagination)

---

## 1. ภาพรวมโปรเจค

ระบบจัดการประชุมผู้ถือหุ้น (AGM/EGM) แบบอิเล็กทรอนิกส์ ตาม พ.ร.บ. บริษัทมหาชนจำกัด รองรับ:
- **Multi-Tenant**: จัดการหลายบริษัท + หลายรอบประชุม (Sequential Events)
- **Registration**: ลงทะเบียน + คำนวณ Quorum แบบ Real-time (SSE) + ค้นหา + Pagination
- **Proxy**: มอบฉันทะแบบ ก./ข./ค. + Split Vote + Pre-vote auto-merge
- **Voting**: QR Ballot + สแกน USB/กล้องมือถือ + **นับแบบหักลบ** (Deduction Method)
- **Resolution**: 6 ประเภทมติ (ฐานตัวหาร/Denominator ถูกต้องตามกฎหมาย)
- **Dashboard**: ประธาน + ผู้ตรวจสอบ (Read-only) + Freeze ระหว่างโหวต
- **Import**: นำเข้า Excel/CSV จาก TSD + PDPA Registration Slip
- **Export**: PDF/Excel รายงาน + Audit Log

---

## 2. Technology Stack

| Layer | Tech | Version |
|---|---|---|
| Framework | **Next.js** (App Router) | 16.1.6 |
| Language | TypeScript | 5.x |
| UI | React + Tailwind CSS v4 | React 19.2, TW 4.x |
| ORM | **Prisma** v7 (prisma-client generator) | 7.5.0 |
| DB Driver | `@prisma/adapter-mssql` + `tedious` | — |
| Database | **MS SQL Server** (Instance: `alpha`) | — |
| Auth | JWT (jose) + bcryptjs + httpOnly Cookie | — |
| Icons | lucide-react | 0.577 |
| Excel | xlsx | 0.18.5 |
| QR | qrcode + html5-qrcode | — |
| Fonts | IBM Plex Sans Thai + Inter (Google Fonts) | — |

---

## 3. วิธี Setup โปรเจค

### 3.1 Prerequisites
- Node.js v24+
- MS SQL Server พร้อม instance name (เช่น `192.168.110.106\alpha`)
- Database `eagm_db` ที่สร้างไว้แล้ว

### 3.2 ติดตั้ง

```bash
# 1. Clone / ก๊อปมา
cd d:\Antigravity\agm

# 2. Install dependencies
npm install

# 3. Copy .env
copy .env.example .env
# แก้ไข .env ตาม environment ของคุณ (ดู section 4)

# 4. Generate Prisma Client
npx prisma generate

# 5. Push schema ขึ้น DB (สร้าง tables)
npx prisma db push

# 6. Run dev server
npm run dev
# เปิด http://localhost:3000

# 7. Seed ข้อมูลเริ่มต้น (ทำครั้งเดียว)
# POST http://localhost:3000/api/seed
curl -X POST http://localhost:3000/api/seed
```

### 3.3 Default Login

| Username | Password | Role |
|----------|----------|------|
| `admin` | `admin1234` | SUPER_ADMIN |

---

## 4. Environment Variables (.env)

```env
# Application
APP_NAME=e-AGM
APP_PORT=3000
NODE_ENV=development

# Database (MS SQL Server)
DATABASE_URL=sqlserver://192.168.110.106:1433;database=eagm_db;user=sa;password=YOUR_PASSWORD;encrypt=false;trustServerCertificate=true;instanceName=alpha

# Authentication
AUTH_SECRET=your-random-secret-at-least-32-chars
JWT_EXPIRES_IN=8h
```

> ⚠️ **สำคัญ**: `instanceName` ใน `DATABASE_URL` ต้องตรงกับ SQL Server instance

---

## 5. โครงสร้างไฟล์ (File Structure)

```
d:\Antigravity\agm\
├── prisma/
│   ├── schema.prisma          # 14 tables (ดู section 6)
│   └── prisma.config.ts       # Prisma config
├── src/
│   ├── app/
│   │   ├── globals.css        # Design system (dark theme, CSS vars)
│   │   ├── layout.tsx         # Root layout
│   │   ├── login/page.tsx     # Login page
│   │   ├── quorum-display/page.tsx  # 🆕 Public full-screen quorum display
│   │   ├── vote-results/page.tsx    # 🆕 Public full-screen vote results
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx     # Sidebar + session provider
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── admin/
│   │   │   │   ├── companies/page.tsx
│   │   │   │   ├── events/page.tsx
│   │   │   │   └── users/page.tsx
│   │   │   ├── setup/
│   │   │   │   ├── agendas/page.tsx      # ตั้งค่าวาระ
│   │   │   │   ├── shareholders/page.tsx  # ข้อมูลผู้ถือหุ้น
│   │   │   │   └── proxies/page.tsx       # มอบฉันทะ
│   │   │   ├── registration/page.tsx      # ลงทะเบียน + Quorum + ค้นหา + Pagination
│   │   │   ├── quorum/page.tsx            # สถานะองค์ประชุม
│   │   │   ├── tallying/page.tsx          # สแกน QR + โหวต
│   │   │   ├── chairman/page.tsx          # Dashboard ประธาน
│   │   │   └── auditor/page.tsx           # ผู้ตรวจสอบ
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   └── session/route.ts
│   │       ├── seed/route.ts
│   │       ├── companies/route.ts
│   │       ├── events/
│   │       │   ├── route.ts               # GET/POST
│   │       │   └── [id]/
│   │       │       ├── route.ts           # GET/PUT/DELETE
│   │       │       └── activate/route.ts  # POST Set Active Event
│   │       ├── agendas/
│   │       │   ├── route.ts               # GET/POST
│   │       │   └── [id]/
│   │       │       ├── route.ts           # GET/PUT/DELETE
│   │       │       ├── status/route.ts    # PUT (vote open/close + snapshot)
│   │       │       └── sub-agendas/route.ts
│   │       ├── shareholders/
│   │       │   ├── route.ts               # GET/POST
│   │       │   ├── import/route.ts        # POST (Excel/CSV)
│   │       │   └── [id]/route.ts          # GET/PUT(no shares!/DELETE
│   │       ├── registrations/
│   │       │   ├── route.ts               # GET+Quorum / POST check-in
│   │       │   ├── [id]/route.ts          # PUT checkout
│   │       │   └── [id]/slip/route.ts     # POST PDPA registration slip
│   │       ├── proxies/route.ts           # GET/POST Form A/B/C (+split vote validation)
│   │       ├── ballots/route.ts           # GET/POST (skips ACKNOWLEDGEMENT)
│   │       ├── votes/route.ts             # GET+summary / POST vote
│   │       ├── sse/route.ts               # 🆕 SSE real-time event stream (v19)
│   │       ├── sse/quorum/route.ts        # SSE quorum (+freeze flag)
│   │       ├── public/
│   │       │   ├── quorum/route.ts         # GET public quorum (no auth)
│   │       │   └── vote-results/route.ts   # GET public vote results (no auth)
│   │       ├── reports/
│   │       │   ├── pdf-data/route.ts       # GET PDF data
│   │       │   ├── vote-summary/route.ts   # GET vote summary
│   │       │   ├── vote-export/route.ts    # GET Excel export
│   │       │   └── registration-export/route.ts
│   │       └── audit-logs/route.ts
│   ├── lib/
│   │   ├── prisma.ts                      # PrismaClient + MsSql adapter
│   │   ├── auth.ts                        # JWT verify, requireAuth, withAuth
│   │   ├── session-context.tsx            # React context สำหรับ session
│   │   ├── serialize.ts                   # 🆕 BigInt serializer utility (v19)
│   │   ├── sse-manager.ts                 # 🆕 SSE connection manager (v19)
│   │   └── use-sse.ts                     # 🆕 React hook for SSE (v19)
│   ├── types/index.ts                     # Types, roles, nav config
│   └── generated/prisma/                  # Auto-generated Prisma client
├── .env
├── .env.example
├── package.json
├── tsconfig.json
└── next.config.ts
```

---

## 6. Database Schema (14 Tables)

```
┌─────────────┐   ┌──────────┐   ┌──────────────┐
│  companies   │──▶│  events   │──▶│ shareholders  │
└─────────────┘   └──────────┘   └──────────────┘
       │               │                │
       │               │         ┌──────┴───────┐
       │               │         ▼              ▼
       │          ┌────────┐  ┌────────────┐ ┌────────┐
       │          │agendas │  │registrations│ │proxies │
       │          └────────┘  └────────────┘ └────────┘
       │               │                         │
       │          ┌────┴────┐              ┌─────┴──────┐
       │          ▼         ▼              ▼            │
       │    ┌──────────┐ ┌────────┐   ┌───────────────┐│
       │    │sub_agendas│ │ballots │   │proxy_split_   ││
       │    └──────────┘ └────────┘   │votes          ││
       │                      │       └───────────────┘│
       │                      ▼                        │
       │                 ┌─────────┐                   │
       │                 │ votes   │                   │
       │                 └─────────┘                   │
       │                      │                        │
       │                ┌─────┴─────┐                  │
       │                ▼           │                  │
       │         ┌─────────────┐   │                  │
       │         │vote_snapshots│   │                  │
       │         └─────────────┘   │                  │
       │                           │                  │
       └──────────────▶┌───────────┴┐                 │
                       │ audit_logs  │                 │
                       └────────────┘                 │
                       ┌────────────┐                 │
                       │   users    │                 │
                       └────────────┘
```

**Logical Isolation**: ทุก table มี `companyId` + `meetingId` สำหรับแยกข้อมูลตาม บริษัท/งานประชุม

### ตาราง/Model สำคัญ:

| Model | Table Name | หน้าที่ |
|-------|-----------|---------|
| Company | `companies` | บริษัท (tenant) |
| Event | `events` | งานประชุม AGM/EGM |
| User | `users` | ผู้ใช้ระบบ (6 roles) |
| Shareholder | `shareholders` | ผู้ถือหุ้น (per meeting) |
| Agenda | `agendas` | วาระประชุม |
| SubAgenda | `sub_agendas` | วาระย่อย (ELECTION — เลือกตั้งกรรมการรายบุคคล) |
| Registration | `registrations` | ลงทะเบียนเข้าประชุม |
| Proxy | `proxies` | หนังสือมอบฉันทะ |
| ProxySplitVote | `proxy_split_votes` | การแบ่งโหวตล่วงหน้า (Form B/C) |
| Ballot | `ballots` | บัตรลงคะแนน + QR data |
| Vote | `votes` | ผลโหวต |
| VoteSnapshot | `vote_snapshots` | Snapshot ณ ตอนปิดโหวต |
| AuditLog | `audit_logs` | Log ทุกการกระทำ |

---

## 7. ระบบ Authentication & Authorization

### Flow:
```
Login (username/password)
  → bcrypt.compare()
  → Sign JWT (jose, HS256)
  → Set httpOnly Cookie ("token")
  → Redirect to /dashboard
```

### 6 User Roles:

| Role | ภาษาไทย | สิทธิ์การเข้าถึง |
|------|---------|-----------------|
| `SUPER_ADMIN` | ผู้ดูแลระบบสูงสุด | ทุกหน้า |
| `SYSTEM_ADMIN` | ผู้จัดการระบบ | setup, registration, tallying |
| `REGISTRATION_STAFF` | เจ้าหน้าที่ลงทะเบียน | /registration เท่านั้น |
| `TALLYING_STAFF` | เจ้าหน้าที่นับคะแนน | /tallying เท่านั้น |
| `CHAIRMAN` | ประธาน/พิธีกร | /chairman เท่านั้น |
| `AUDITOR` | ผู้ตรวจสอบ | /auditor (read-only) |

### Helper Functions (src/lib/auth.ts):
```typescript
// ดึง user จาก JWT cookie
const user = await getAuthUser();

// Require auth + role check — throws AuthError
const user = await requireAuth(['SUPER_ADMIN', 'SYSTEM_ADMIN']);

// Wrapper สำหรับ API route handler
export const GET = withAuth(handler, ['SUPER_ADMIN']);
```

---

## 8. API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → JWT cookie |
| GET | `/api/auth/session` | Get current session + active event |
| POST | `/api/auth/logout` | Clear cookie |
| POST | `/api/seed` | Seed admin + demo data (ทำครั้งเดียว) |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/companies` | CRUD บริษัท |
| GET/POST | `/api/events` | CRUD งานประชุม |

### Setup
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/agendas` | List วาระ (active event) |
| POST | `/api/agendas` | สร้างวาระ (auto orderNo) |
| GET/PUT/DELETE | `/api/agendas/[id]` | CRUD วาระ |
| GET/POST | `/api/agendas/[id]/sub-agendas` | วาระย่อย |
| GET | `/api/shareholders` | List (search, pagination) |
| POST | `/api/shareholders` | สร้างผู้ถือหุ้น |
| POST | `/api/shareholders/import` | นำเข้า Excel/CSV |
| GET/PUT/DELETE | `/api/shareholders/[id]` | CRUD รายบุคคล |
| GET/POST | `/api/proxies` | หนังสือมอบฉันทะ Form A/B/C |

### Operation
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/registrations` | List + **Quorum real-time** |
| POST | `/api/registrations` | Check-in ผู้ถือหุ้น |
| PUT | `/api/registrations/[id]` | Check-out / Re-check-in |
| GET/POST | `/api/ballots` | Generate QR Ballots |
| POST | `/api/ballots/auto-generate` | สร้างบัตรทุกวาระอัตโนมัติ (per shareholder, หลัง check-in) |
| GET | `/api/votes?agendaId=xxx` | List votes + **summary** |
| POST | `/api/votes` | ลงคะแนน (QR scan / manual) |

### Reports & Admin
| Method | Path | Description |
|--------|------|-------------|
| PUT | `/api/agendas/[id]/status` | เปลี่ยนสถานะวาระ (PENDING→OPEN→CLOSED→ANNOUNCED) + auto snapshot |
| GET | `/api/reports/vote-summary` | สรุปผลคะแนนทุกวาระ (JSON) |
| GET | `/api/reports/vote-export` | ดาวน์โหลด Excel ผลโหวต |
| GET | `/api/reports/registration-export` | ดาวน์โหลด Excel การลงทะเบียน |
| GET | `/api/audit-logs` | Audit log (paginated, SUPER_ADMIN only) |

### Public APIs (ไม่ต้อง Login)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/public/quorum` | สถานะองค์ประชุม (สำหรับ projector/นักลงทุน) |
| GET | `/api/public/vote-results?agendaOrder=1` | ผลลงคะแนนแต่ละวาระ (สำหรับ projector) |

### SSE (Server-Sent Events)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sse` | 🆕 SSE stream — broadcast events (registration/vote/agenda) |

Event types: `registration`, `vote`, `agenda`, `refresh`
Heartbeat: ทุก 30 วินาที
Fallback: ถ้า SSE ขาด → client กลับไปใช้ polling อัตโนมัติ

### Public Display Pages (ไม่ต้อง Login)
| Path | Description |
|------|-------------|
| `/quorum-display` | หน้าเต็มจอสถานะองค์ประชุม (SSE real-time) |
| `/vote-results` | หน้าเต็มจอผลลงคะแนนแต่ละวาระ (SSE real-time) |
| `/ballot-print?shareholderId=xxx` | หน้าพิมพ์บัตรลงคะแนน (ใบลงทะเบียน + บัตรรายวาระ) |

### Key Concepts:
- **Active Event**: ทุก API (ยกเว้น auth/admin) ใช้ `isActive: true` event
- **Quorum**: คำนวณจาก registrations ที่ `checkoutAt = null`
- **Vote Duplicate Prevention**: unique constraint `[agendaId, shareholderId, subAgendaId]`
- **QR Format**: `EAGM|{eventId}|{agendaId}|{shareholderId}|{token}` (non-election)
- **QR Format (Election)**: `EAGM|{eventId}|{agendaId}|{subAgendaId}|{shareholderId}|{token}`
- **Ref Code**: `E{eventId}-A{orderNo}-S{registrationNo}` (พิมพ์ใต้ QR เผื่อคีย์มือกรณี QR ยับ)
- **Shares Guard (FR2.2)**: PUT `/api/shareholders/[id]` ห้ามแก้ไข shares → return 403
- **Ballot Skip (FR5.1)**: POST `/api/ballots` ไม่สร้างบัตรให้วาระ INFO
- **Split Vote Validation (FR4.2)**: POST `/api/proxies` validate ผลรวม split vote ≤ สิทธิที่มี
- **BigInt Serialization**: ใช้ `serializeBigInt()` จาก `src/lib/serialize.ts` แปลง BigInt → string ก่อน JSON response
- **SSE Freeze (FR8.3)**: SSE ส่ง `quorum.frozen: true` เมื่อมีวาระ OPEN

### Resolution Types & Denominator Logic (FR6.1):
| ประเภท | Type Code | Threshold | ฐานตัวหาร (Denominator) |
|--------|-----------|-----------|------------------------|
| แจ้งเพื่อทราบ | `INFO` | — | ไม่มีโหวต |
| มติทั่วไป | `MAJORITY` | >50% | เห็นด้วย + ไม่เห็นด้วย |
| มติ 2/3 | `TWO_THIRDS` | ≥66.67% | หุ้นผู้เข้าประชุมทั้งหมด (= เห็นด้วย + ไม่เห็นด้วย + งดฯ + บัตรเสีย) |
| มติพิเศษ 3/4 | `SPECIAL` | ≥75% | หุ้นผู้เข้าประชุมทั้งหมด (= เห็นด้วย + ไม่เห็นด้วย + งดฯ + บัตรเสีย) |
| เลือกตั้งกรรมการ | `ELECTION` | >50%/คน | เห็นด้วย + ไม่เห็นด้วย (แยกรายบุคคล Sub-agenda) |

### FR7.1 — นับแบบหักลบ (Deduction Method):
- ระบบเก็บ **เฉพาะบัตรไม่เห็นด้วย / งดออกเสียง / บัตรเสีย** ที่ยิงเข้ามา
- **ไม่ได้เก็บบัตรเห็นด้วย** → คำนวณจากการหัก
- Formula: `เห็นด้วย = หุ้นผู้เข้าประชุมทั้งหมด − (ไม่เห็นด้วย + งดออกเสียง + บัตรเสีย)`
- ใช้กับ **ทุกประเภทมติ** (MAJORITY, SPECIAL, TWO_THIRDS, ELECTION)

### FR4.3 — Pre-vote Auto-merge:
- เมื่อปิดโหวต → ดึง `ProxySplitVote` (Proxy Form B/C)
- สร้าง Vote records (`isPreVote: true`) อัตโนมัติ (ถ้ายังไม่มี manual vote)

### FR6.2 — Veto (ตัดสิทธิผู้มีส่วนได้เสีย):
- Agenda มี field `vetoShareholderIds` (JSON array)
- เมื่อปิดโหวต → หักหุ้น veto ออกจาก eligibleShares

### 🔄 Agenda State Machine (สวิตช์ควบคุมศูนย์กลาง)

การกดปุ่ม "เปิดโหวต" / "ปิดโหวต" ไม่ใช่แค่จับเวลา แต่เป็น **State Machine** ที่สั่งระบบอื่นๆ ทั้งหมดให้ทำงานสอดคล้องกัน

**Transition**: `PENDING → OPEN → CLOSED → ANNOUNCED`

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ก่อนเปิด (PENDING)                         │
│  • บัตร: พิมพ์ได้                                                    │
│  • สแกน: ❌ ไม่ได้ (API ปฏิเสธ status ≠ OPEN)                       │
│  • จอ Projector: องค์ประชุม LIVE ปกติ                                 │
├─────────────────────────────────────────────────────────────────────┤
│  🟢 [เปิดวาระ] (Record Open Time)                                   │
├─────────────────────────────────────────────────────────────────────┤
│                         ระหว่างเปิด (OPEN)                           │
│  • บัตร: พิมพ์ได้ (คนเข้าสายยังรับบัตรวาระนี้ได้)                     │
│  • สแกน: ✅ ได้ (ปลดล็อค)                                            │
│  • จอ Projector: 🔒 แช่แข็ง (ตัวเลของค์ประชุมหยุดวิ่ง)              │
│  • Check-out: หุ้นไม่ถูกหัก (ถือว่าอยู่ตอนเริ่มวาระ = เห็นด้วย)       │
├─────────────────────────────────────────────────────────────────────┤
│  🔴 [ปิดวาระ] (Record Close Time)                                   │
│  ↳ 1. Snapshot ล็อคยอดผู้เข้าประชุม = ฐานตัวหารตายตัว                │
│  ↳ 2. Merge Pre-vote (Form B/C) เข้าบวกกับคะแนนหน้างาน              │
│  ↳ 3. คำนวณ "เห็นด้วย" แบบหักลบ (Deduction)                         │
│  ↳ 4. ตัดสิทธิ Veto shareholders (ถ้ามี)                             │
│  ↳ 5. บันทึกผลลง VoteSnapshot                                       │
├─────────────────────────────────────────────────────────────────────┤
│                          หลังปิด (CLOSED)                            │
│  • บัตร: ❌ พิมพ์ไม่ได้ (API ปฏิเสธ "ปิดรับลงคะแนนแล้ว")            │
│  • สแกน: ❌ ไม่ได้ (API ปฏิเสธ)                                      │
│  • จอ Projector: 🔓 ปลดล็อค กลับมา LIVE + แสดงผลโหวต                │
│  • ฐานตัวหาร: 🔒 ล็อคถาวรใน Snapshot (ใครเข้า-ออกไม่มีผลแล้ว)       │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation files**:
- State transition + Snapshot: `src/app/api/agendas/[id]/status/route.ts`
- **Status transition buttons**: `src/app/(dashboard)/setup/agendas/page.tsx` (เปิดโหวต/ปิดโหวต/ประกาศผล)
- Scanner guard: `src/app/api/votes/route.ts` (line 100: `agenda.status !== 'OPEN'`)
- Ballot guard: `src/app/api/ballots/route.ts` (FR5.2: rejects CLOSED/ANNOUNCED)
- Quorum freeze: `src/app/api/sse/quorum/route.ts` (sends `frozen: true` when any agenda OPEN)

### FR9.2 — Vote Results Quorum (แยกผู้เข้าร่วม "เพิ่ม" vs "ทั้งสิ้น")

หน้า `/vote-results` แสดง 2 บรรทัด:

| บรรทัด | สูตร | แหล่งข้อมูล |
|--------|------|------------|
| **เพิ่มเป็นจำนวน** | Snapshot วาระนี้ − Snapshot วาระก่อนหน้า | `VoteSnapshot.totalAttendees` |
| **ทั้งสิ้น** | Snapshot (ถ้าปิด) หรือ Real-time (ถ้ายังเปิด) | `VoteSnapshot` / `Registration` |

- วาระที่ 1: ไม่มีวาระก่อนหน้า → "เพิ่ม" = "ทั้งสิ้น"
- Implementation: `src/app/api/public/vote-results/route.ts`

### FR9.3 — Vote Results Row Ordering

ลำดับรายการในตารางแตกต่างตามประเภทมติ:

| MAJORITY / ELECTION | SPECIAL / TWO_THIRDS |
|---------------------|---------------------|
| เห็นด้วย (%) | เห็นด้วย (%) |
| ไม่เห็นด้วย (%) | ไม่เห็นด้วย (%) |
| ── เส้นคั่น ── | งดออกเสียง (%) |
| **รวม (%)** | บัตรเสีย (%) |
| งดออกเสียง (ไม่มี%) | ── เส้นคั่น ── |
| บัตรเสีย (ไม่มี%) | **รวม = 100%** |

- Implementation: `src/app/vote-results/page.tsx`

---

## 9. Design System

### Theme: Dark Glassmorphism
- Background: `#0f172a` (slate-900)
- Cards: `rgba(30,41,59,0.7)` + backdrop-blur + border
- Primary: Indigo `#6366f1`
- Font: IBM Plex Sans Thai (TH) + Inter (EN)

### CSS Utility Classes (globals.css):
```css
.glass-card          /* Frosted glass card */
.glass-card-light    /* Lighter variant */
.gradient-primary    /* Indigo gradient button */
.input-field         /* Form input styling */
.badge               /* Status/type badge */
.animate-fade-in     /* Entrance animation */
.animate-pulse-glow  /* Loading pulse */
.stagger-1..5        /* Staggered animation delays */
```

### Color Coding:
- **Vote**: เห็นด้วย=emerald, ไม่เห็นด้วย=red, งด=amber, เสีย=gray
- **Resolution**: Acknowledge=blue, Majority=emerald, 2/3=amber, 3/4=red, Election=purple
- **Proxy**: Form ก.=blue, Form ข.=emerald, Form ค.=purple
- **Status**: PENDING=gray, OPEN=emerald, CLOSED=red, ANNOUNCED=blue

---

## 10. สิ่งที่เสร็จแล้ว (Phase 1-8 + FR Audit) ✅

### Core (Phase 1-4)
- [x] Project scaffolding + Prisma + Auth + Dark theme
- [x] Login / Dashboard / Sidebar navigation
- [x] Company & Event management + Set Active Event
- [x] Agenda Setup API + UI (5 resolution types + sub-agendas)
- [x] Shareholder Import API + UI (Excel/CSV + search + pagination)
- [x] Proxy Management API + UI (Form A/B/C + split vote validation)
- [x] Registration API + UI (check-in/out + real-time quorum)
- [x] QR Ballot Generation API (skips INFO agendas)
- [x] Vote Tallying API + UI (QR scan USB + mobile camera + deduction method)
- [x] Chairman Dashboard (large quorum + vote results + LIVE)
- [x] Auditor Dashboard (read-only monitoring)

### Advanced Logic (Phase 5-6 + FR Audit)
- [x] SSE real-time quorum stream (`/api/sse/quorum`) with freeze during voting
- [x] **SSE global broadcast** — `/api/sse` stream สำหรับทุก event (registration/vote/agenda)
- [x] Agenda status transition (PENDING→OPEN→CLOSED→ANNOUNCED)
- [x] **Correct denominator logic** per Thai Public Company Act (FR6.1)
- [x] **Pre-vote auto-merge** from Proxy B/C on close (FR4.3)
- [x] **Veto exclusion** — deduct veto shareholders from eligible base (FR6.2)
- [x] **Deduction voting** — implicit APPROVE for non-voted shares (FR7.1)
- [x] Auto vote snapshot on close (freeze quorum + calculate result)
- [x] Excel vote log export + registration export
- [x] PDF report page + PDPA registration slip
- [x] Audit log API
- [x] Vote summary report API
- [x] Shares edit protection (FR2.2 — PUT returns 403)

### Polish (Phase 7)
- [x] PWA manifest + service worker
- [x] Mobile camera QR scanner (html5-qrcode) on tallying page
- [x] Cloudflare Tunnel deployment guide

### Public Display Pages (Phase 8)
- [x] **สถานะองค์ประชุม** — `/quorum-display` (public, full-screen, auto-refresh 5s)
- [x] **สรุปผลการลงคะแนน** — `/vote-results` (public, per-agenda, dropdown selector)
- [x] Public API `/api/public/quorum` (no auth)
- [x] Public API `/api/public/vote-results` (no auth, correct denominator per resolution type)
- [x] Dashboard quorum page `/quorum` (authenticated, with "เปิดเต็มจอ" button)
- [x] Company logo display on public pages
- [x] Thai date + time on timestamp bar

### State Machine & UI (Phase 9)
- [x] **Status transition buttons** on agenda setup page (เปิดโหวต / ปิดโหวต / ประกาศผล) with confirm dialogs
- [x] **Ballot guard** (FR5.2) — rejects ballot printing for CLOSED/ANNOUNCED agendas
- [x] **Projector buttons** on chairman page (จอองค์ประชุม + จอผลลงคะแนน → open in new tab)
- [x] **Vote results row ordering** — conditional per resolution type (MAJORITY vs SPECIAL)
- [x] **Agenda open/close timestamps** — pulled from AuditLog (AGENDA_OPEN/CLOSED)
- [x] **Separate additional vs total attendees** — "เพิ่ม" from snapshot diff, "ทั้งสิ้น" from snapshot or live
- [x] **Resolution type label** moved to bottom of vote results (after open/close times)

### Ballot Print System (Phase 10)
- [x] **`POST /api/ballots/auto-generate`** — สร้างบัตรทุกวาระอัตโนมัติ per shareholder (ELECTION แยกราย sub-agenda)
- [x] **`/ballot-print`** page — A4 แนวตั้ง, 6 บัตร/หน้า (2×3 grid), auto-print on load
- [x] **ใบลงทะเบียน** (Registration Slip) — PDPA consent + ช่องลงชื่อ
- [x] **บัตรลงคะแนนรายวาระ** — QR Code + Ref Code + ช่องกากบาท + deduction note
- [x] **บัตรเลือกตั้งกรรมการ** — แยก 1 ใบต่อ 1 ผู้สมัคร (sub-agenda)
- [x] **Auto-open** ballot print tab after check-in
- [x] **Reprint button** ในตารางลงทะเบียน
- [x] **REGISTRATION_STAFF** permission เพิ่มใน ballot API
- [x] **Veto exclusion** — ข้ามพิมพ์บัตรวาระที่ shareholder ถูกตัดสิทธิ (vetoShareholderIds)
- [x] **Proxy B/C pre-vote** — ห้ามพิมพ์ QR สำหรับวาระที่มี ProxySplitVote (คีย์ล่วงหน้าแล้ว)
- [x] **Pre-vote Summary Slip** — ใบสรุปการลงคะแนนล่วงหน้า (Proxy B/C) ตาราง วาระ→ผลโหวต
- [x] **Proxy A share consolidation** — รวมหุ้นจากหลายผู้มอบ → 1 บัตร/วาระ แสดงหุ้นรวม
- [x] **Proxy B/C blank agenda** — พิมพ์ QR เฉพาะวาระที่ปล่อยว่าง (ไม่ได้ระบุล่วงหน้า)
- [x] **SELF/PROXY layout** — แยกหัวบัตร (บัตรลงคะแนนเสียง vs ผู้รับมอบฉันทะ), ข้อมูลผู้โหวต, ช่องลงชื่อ
- [x] **ใบลงทะเบียนแยก SELF/PROXY** — หัว, ชื่อ, ประเภทมอบฉันทะ, ช่องลงชื่อแยกตามประเภท
- [x] **Watermark** — เลขวาระขนาดใหญ่จางๆ หลังบัตร (มุมขวาล่าง)
- [x] **Company logo** — แสดงข้างๆ ชื่อบริษัท (ไม่กินพื้นที่แนวตั้ง) ทั้งบัตรลงคะแนนและใบลงทะเบียน
- [x] **Merged Proxy → Registration** — รวมมอบฉันทะเข้าหน้าลงทะเบียน (2 ปุ่ม: มาเอง/มอบฉันทะ + Proxy Modal)
- [x] **REGISTRATION_STAFF permission** — เพิ่มสิทธิ์ POST `/api/proxies` ให้ REGISTRATION_STAFF
- [x] **Proxy Modal UI** — ปรับ UI หน้ามอบฉันทะ (card selector, search พร้อม icon, selected card)
- [x] **ใบลงทะเบียน: วันเวลาประชุม** — แสดงชื่อ + วันที่ (พ.ศ.) + เวลา (ดึงจาก Event.date)
- [x] **ใบลงทะเบียน: มอบฉันทะให้** — แสดง "มอบฉันทะให้ [ชื่อ]" เฉพาะผู้รับมอบฉันทะ
- [x] **Event datetime** — ฟอร์มสร้างประชุมเปลี่ยนจาก `date` เป็น `datetime-local` (ระบุเวลาได้)
- [x] **Registration Status Guard** — ลงทะเบียนได้เฉพาะ status `REGISTRATION` หรือ `VOTING` (ไม่ให้ check-in ตอน DRAFT/CLOSED)
- [x] **Header Company Name** — เปลี่ยน subtitle ทุกหน้าจากชื่อรอบประชุม → ชื่อบริษัท (10 หน้า)
- [x] **Nav Sections** — จัดกลุ่มเมนู Sidebar เป็น section: ตั้งค่า, ดำเนินการ, หน้าจอ, รายงาน (ทุก role)
- [x] **MC Screen (`/mc`)** — หน้าจอพิธีกร: Quorum bar, ควบคุมวาระ (เปิด/ปิด/ประกาศผล), Timeline วาระ, Script สำเร็จรูป
- [x] **Late Arrival Alert** — แจ้งเตือนผู้เข้าร่วมใหม่ระหว่างวาระ + Script ให้พิธีกรอ่าน + ปุ่มรับทราบ
- [x] **MC Script DB** — เพิ่ม `mcScript` (NText) ใน Agenda model + PATCH API + แก้ไข/บันทึก Script ผ่านหน้าจอ MC (เก็บแยกตามวาระ/Event)
- [x] **FR9.1 Voting Results** — เพิ่ม % แต่ละช่องโหวต (เป็นตาราง) + โลโก้บริษัท + พื้นที่ลงนาม (ประธานกรรมการ + เลขานุการบริษัท)
- [x] **FR9.2 Attendance Report** — แยกตาราง "มาด้วยตนเอง" vs "ผู้รับมอบฉันทะ" (จำนวนราย/หุ้น/% แยกแต่ละประเภท)
- [x] **xlsx import fix** — แก้ dynamic import `xlsx` ที่ทำให้ Excel ลงทะเบียน error 500
- [x] **Data Clear** — ปุ่มล้างข้อมูล 2 ระดับ (SUPER_ADMIN): "ล้างรอบประชุม" (เก็บวาระ+ผู้ถือหุ้น) / "ล้างทั้งหมด" (เหลือ Users+Companies) + Confirm พิมพ์ "ยืนยัน" + Audit Log
- [x] **Logo Upload** — เปลี่ยนช่อง URL โลโก้เป็นอัปโหลดไฟล์ (PNG/JPG/WebP/SVG, max 2MB) + preview + ลบได้ — เก็บที่ `public/uploads/`
- [x] **Camera QR Fix** — แก้ timing กล้องมือถือที่หน้านับคะแนน (`/tallying`): `startCamera()` ย้ายจาก onClick ไป useEffect + เปลี่ยน `console.error` เป็น `console.warn`
- [x] **MC Vote Results** — หน้า MC แสดงผลคะแนน (เห็นด้วย/ไม่เห็นด้วย/งด/เสีย + %, progress bar, badge อนุมัติ/ไม่อนุมัติ) ตอน CLOSED/ANNOUNCED
- [x] **Vote Subtraction Fix** — แก้ `/api/votes` และ MC ให้ใช้ `/api/public/vote-results` ตัวเดียวกับหน้าแสดงผล — คำนวณแบบหักลบถูกต้อง (approve = total − non-approve)
- [x] **MC Agenda Quorum** — หน้า MC แสดง "เข้าร่วมเพิ่มในวาระนี้" + "ผู้ถือหุ้นเข้าร่วมทั้งสิ้น" (ราย + หุ้น) แต่ละวาระ
- [x] **Additional Quorum Fix** — แก้ logic คำนวณ "เข้าร่วมเพิ่ม" วาระที่ 1 จาก total → **0** (ทุกคนเป็นผู้เข้าร่วมเดิม ไม่ใช่ "เพิ่ม")
- [x] **PDF Export** — ปุ่ม "ดาวน์โหลด PDF" ที่หน้ารายงาน ใช้ `@react-pdf/renderer` + Thai font (Sarabun) สร้าง PDF สวยๆ มี header/logo, ตาราง quorum, ผลโหวตแต่ละวาระ, ช่องลายเซ็น — component: `src/components/ReportPDF.tsx`
- [x] **Audit Log Viewer** — หน้า `/admin/audit-logs` สำหรับ SUPER_ADMIN: แสดงประวัติกิจกรรมทั้งหมด (icon+สีแยกประเภท), ตัวกรอง (ค้นหา/ประเภท/วันที่), แสดงชื่อผู้ใช้แทน UUID, ซ่อน entity ID — API เพิ่ม filter (action/userId/date/search)

### Audit Logging (v18)
- [x] **Comprehensive audit logs** — 9 action types: CHECKIN, CHECKOUT, RECHECKIN, CANCEL_REGISTRATION, VOTE, CREATE_AGENDA, UPDATE_AGENDA, DELETE_AGENDA, IMPORT_SHAREHOLDERS
- [x] **Audit log UI update** — Thai labels + icons + colors สำหรับ action types ใหม่

### Chairman Page Enhancements (v18)
- [x] **Thai status labels** — PENDING/OPEN/CLOSED/ANNOUNCED → รอดำเนินการ/กำลังโหวต/ปิดโหวตแล้ว/ประกาศผลแล้ว
- [x] **Vote result badges** — แสดง อนุมัติ ✅ / ไม่อนุมัติ ❌ สำหรับ CLOSED/ANNOUNCED agendas
- [x] **Sub-agenda display** — วาระเลือกตั้งแสดง sub-agendas บนหน้าจอประธาน

### Registration Improvements (v18)
- [x] **Search filter** — ค้นหาผู้ลงทะเบียนแล้วตามชื่อ, เลขทะเบียน, ผู้รับมอบ (real-time)
- [x] **Pagination** — 20 รายการ/หน้า + page controls + แสดง "พบ X จาก Y"

### BigInt Serialization Fix (v18)
- [x] **`src/lib/serialize.ts`** — `serializeBigInt()` utility แปลง BigInt → string อัตโนมัติทุกระดับ
- [x] **Fixed APIs** — `shareholders/[id]` (GET/PUT), `registrations/[id]` (checkout/recheckin)

### SSE Real-time Updates (v19)
- [x] **`src/lib/sse-manager.ts`** — SSE connection manager singleton + broadcast
- [x] **`src/app/api/sse/route.ts`** — SSE endpoint (heartbeat 30s, Nginx-compatible)
- [x] **`src/lib/use-sse.ts`** — React hook (auto reconnect + exponential backoff + polling fallback)
- [x] **Broadcast from APIs** — registration (checkin/checkout/recheckin/cancel), vote, agenda status
- [x] **8 pages updated** — registration, chairman, MC, tallying, auditor, quorum, quorum-display, vote-results

---

## 11. Enhancement Ideas (Optional) 💡

- [ ] Responsive design audit สำหรับ tablet ทุกหน้า
- [ ] Export รายงาน (Excel/PDF) สำหรับรายชื่อผู้ลงทะเบียน, ผลคะแนน, Audit log
- [ ] Session timeout warning ก่อน JWT หมดอายุ
- [ ] Role-based sidebar (ซ่อนเมนูที่ไม่เกี่ยวข้องกับ role)
- [ ] Manual vote input fallback (พิมพ์ refCode ด้วยมือกรณี QR เสียหาย)
- [ ] Shareholder import สำหรับ Proxy Form C (Excel split vote)
- [ ] Multi-language support (EN/TH toggle)
- [ ] Database backup scheduler สำหรับวันประชุม

---

## 12. Deployment (Production)

### วิธี Deploy แบบปกติ (ไม่ใช้ Docker)

```bash
# 1. Build production
npm run build

# 2. Start production server
npm run start
# หรือใช้ PM2
npm install -g pm2
pm2 start npm --name "eagm" -- start
pm2 save
pm2 startup
```

### Nginx Config (สำหรับ SSE)

ถ้าใช้ Nginx เป็น reverse proxy ต้องเพิ่ม config สำหรับ SSE:

```nginx
server {
    listen 80;
    server_name agm.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection '';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;           # สำคัญ! SSE ต้องปิด buffering
        proxy_cache off;               # ปิด cache สำหรับ SSE
        proxy_read_timeout 86400s;     # keep-alive 24 ชั่วโมง
    }
}
```

> ⚠️ **สำคัญ**: `proxy_buffering off` และ `proxy_set_header Connection ''` จำเป็นสำหรับ SSE

### Cloudflare Tunnel Setup

โปรเจคนี้รองรับ **Cloudflare Tunnel** (cloudflared) เป็นทางเลือกแทน Nginx:

```bash
# 1. ติดตั้ง cloudflared
# Windows: ดาวน์โหลดจาก https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# 2. Login
cloudflared tunnel login

# 3. สร้าง tunnel
cloudflared tunnel create eagm

# 4. Config (cloudflared config.yml)
# tunnel: <TUNNEL_ID>
# credentials-file: ~/.cloudflared/<TUNNEL_ID>.json
# ingress:
#   - hostname: agm.yourdomain.com
#     service: http://localhost:3000
#   - service: http_status:404

# 5. Route DNS
cloudflared tunnel route dns eagm agm.yourdomain.com

# 6. Run
cloudflared tunnel run eagm
```

### Environment สำหรับ Production

```env
NODE_ENV=production
AUTH_SECRET=<random-64-char-string>
```

### Known Issues / Technical Debt:
1. **Prisma v7** ต้องใช้ `@prisma/adapter-mssql` เป็น driver adapter (ไม่ใช้ binary engine)
2. ~~**BigInt serialization** — ✅ แก้แล้ว: ใช้ `serializeBigInt()` จาก `src/lib/serialize.ts`~~
3. ~~**QR Camera** — ✅ แก้แล้ว: integrate `html5-qrcode` ในหน้า tallying~~
4. ~~**Events/Users Admin** — ✅ แก้แล้ว: CRUD + Edit/Delete สมบูรณ์~~

---

## 12. Prisma Commands Reference

```bash
# Generate Prisma Client (หลังแก้ schema)
npx prisma generate

# Push schema ขึ้น DB (ไม่สร้าง migration file)
npx prisma db push

# Reset DB + สร้าง tables ใหม่ (ลบข้อมูลทั้งหมด!)
npx prisma db push --force-reset

# เปิด Prisma Studio (GUI ดู database)
npx prisma studio

# สร้าง migration (สำหรับ production)
npx prisma migrate dev --name your_migration_name
```

---

## 13. Contact & Notes

- โปรเจคนี้ใช้ **Logical Isolation** (companyId + meetingId) แทน multi-database
- ทุก API route ที่เป็น operation ต้องมี **Active Event** (`isActive: true` ในตาราง events)
- Seed endpoint (`POST /api/seed`) ใช้สร้าง admin user + demo data ครั้งแรก
- Design system เป็น **Dark Theme** — ไม่มี light mode toggle

---

*สร้างโดย AI Assistant เมื่อ 12 มีนาคม 2569*

---

## Changelog v17 (14 มีนาคม 2569)

### 🆕 Proxy Form B/C — Split Vote UI
- เพิ่ม UI ระบุผลโหวตล่วงหน้าในหน้ามอบฉันทะ (`/setup/proxies`)
- แสดงปุ่ม เห็นด้วย/ไม่เห็นด้วย/งดออกเสียง สำหรับแต่ละวาระ
- ปุ่มลัด "เห็นด้วยทั้งหมด" / "ล้าง"
- ตาราง proxy แสดงจำนวน split votes + expand ดูรายละเอียด

### 🔧 Registration → Proxy Auto-detect
- หน้าลงทะเบียน auto-detect proxy ที่ตั้งค่าไว้ → auto-fill ประเภท + ชื่อผู้รับมอบ
- แสดง banner "ตั้งค่ามอบฉันทะไว้แล้ว" เมื่อมี proxy record อยู่
- ไม่สร้าง proxy ซ้ำเมื่อลงทะเบียน

### 🐛 Bug Fixes
- **proxyType mismatch**: Registration เก็บ `B` แต่ proxy table เก็บ `FORM_B` → แก้ mapping ใน `auto-generate/route.ts` ทุกจุด (3 จุด)
- **Ballot duplicate (P2002)**: ELECTION sub-agendas ใช้ `agendaId` เดียวกัน → เพิ่ม try/catch P2002
- **BigInt serialization**: แก้ `GET/POST /api/proxies` ที่ shares เป็น BigInt → แปลงเป็น string
- **Clear modal contrast**: สีตัวหนังสือ `text-amber-300` อ่านยากใน Light mode → เปลี่ยนเป็น `text-amber-900 dark:text-amber-200`

### 🖨️ Ballot Print Improvements
- แสดงประเภทมอบฉันทะเป็นภาษาไทย (ก./ข./ค.) แทน A/B/C
- ใบสรุปการลงคะแนนล่วงหน้า: ช่องลงชื่อแสดงชื่อ **ผู้รับมอบฉันทะ** (ไม่ใช่ผู้ถือหุ้น)
- ผลโหวตล่วงหน้าแสดงถูกต้อง (เห็นด้วย/ไม่เห็นด้วย/งดออกเสียง) แทน "-"
- เอาชื่องาน (event name) ออกจาก header ใบลงทะเบียน
- แก้ไขหน้าว่างเปล่าตอนพิมพ์ (ใช้ `page-break-before` แทน `page-break-after`)
- แก้ QR Code ถูกบีบผิดรูป (เพิ่ม `min-width/min-height` + `flex-shrink: 0`)

### ⚙️ Agenda Setup
- Title (English) ไม่บังคับกรอกแล้ว (ทั้ง UI + API + sub-agendas)
- วาระย่อย (ELECTION): เพิ่มปุ่ม **แก้ไข** (inline edit) + **ลบ**
- API ใหม่: `PUT/DELETE /api/sub-agendas/[id]`

### 📋 Registration — Pending Proxy List
- เพิ่ม section **"มอบฉันทะรอลงทะเบียน"** ที่หน้าลงทะเบียน
- แสดงรายชื่อ proxy ที่ตั้งค่าไว้แต่ยังไม่ได้ check-in
- กดปุ่ม **"ลงทะเบียน"** → ลงทะเบียน + พิมพ์บัตรทันที (ไม่ต้องค้นหา)
- ลงทะเบียนแล้วหายจากรายการอัตโนมัติ (ซ่อน/แสดงได้)
- ค้นหาผู้ถือหุ้นที่มี proxy → แสดงปุ่ม "มอบฉันทะ แบบ ข." เป็นปุ่มหลัก

---

## Changelog v18 (15 มีนาคม 2569)

### 🗳️ Election Sub-agenda Display on Vote Results
- **Dropdown แยกวาระย่อย**: วาระเลือกตั้ง (ELECTION) แสดงเป็น 5.1, 5.2, 5.3 ใน dropdown แทนที่จะแสดงเป็นวาระเดียว "5"
- **ชื่อวาระผสม**: เมื่อเลือก sub-agenda แสดง "ชื่อวาระหลัก : ชื่อผู้สมัคร" เช่น "พิจารณาฯ เลือกตั้งกรรมการ : รศ. ดร.วันชัย รัตนวงษ์"
- **ผลคะแนนเฉพาะราย**: เลือก 5.1 → แสดงผลคะแนนเฉพาะผู้สมัครคนนั้น
- **นับจำนวนวาระ**: แสดง "(N วาระ)" นับจากวาระหลัก (unique) ไม่นับรวม sub-agenda
- Files: `src/app/api/public/vote-results/route.ts`, `src/app/vote-results/page.tsx`

### 🎛️ Election Voting Controls (Agenda Setup + MC)
- **Auto-expand**: วาระเลือกตั้งจะ expand sub-agendas อัตโนมัติเมื่อ status เป็น OPEN/CLOSED/ANNOUNCED
- **Status badge**: แสดง badge สถานะ ("กำลังโหวต"/"ปิดลงคะแนน") บน sub-agendas section
- **Edit guard**: ซ่อนปุ่มแก้ไข/ลบ/เพิ่ม sub-agenda เมื่อ status ≠ PENDING (ป้องกันแก้ระหว่างโหวต)
- **MC per-candidate results**: หน้า MC แสดงผลคะแนนรายบุคคลสำหรับวาระเลือกตั้ง (เห็นด้วย/ไม่เห็นด้วย/งด + progress bar + badge อนุมัติ/ไม่อนุมัติ)
- หมายเหตุ: เปิด-ปิดโหวตวาระเลือกตั้งทำ **พร้อมกันทั้งวาระ** (ตามหลักปฏิบัติ AGM ไทย)
- Files: `src/app/(dashboard)/setup/agendas/page.tsx`, `src/app/(dashboard)/mc/page.tsx`

### 📝 Audit Logging (v18)
- **9 action types ใหม่**: CHECKIN, CHECKOUT, RECHECKIN, CANCEL_REGISTRATION, VOTE, CREATE_AGENDA, UPDATE_AGENDA, DELETE_AGENDA, IMPORT_SHAREHOLDERS
- **Audit log UI**: Thai labels + icons + colors สำหรับทุก action type
- Files: 6 API routes + `src/app/(dashboard)/admin/audit-logs/page.tsx`

### 🎯 Chairman Page
- **Thai status labels**: แสดง "รอดำเนินการ/กำลังโหวต/ปิดโหวตแล้ว/ประกาศผลแล้ว" แทน English
- **Vote result badges**: แสดง อนุมัติ ✅ / ไม่อนุมัติ ❌ สำหรับ CLOSED/ANNOUNCED agendas
- **Sub-agenda display**: วาระเลือกตั้งแสดง sub-agendas

### 🔍 Registration Improvements
- **Search filter**: ค้นหาผู้ลงทะเบียนแล้ว (ชื่อ, เลขทะเบียน, ผู้รับมอบ) — real-time client-side
- **Pagination**: 20 รายการ/หน้า + page number buttons + ellipsis + prev/next

### 🐛 BigInt Serialization Fix
- **`src/lib/serialize.ts`**: `serializeBigInt()` utility แปลง BigInt → string recursively
- **Fixed**: `shareholders/[id]` (GET/PUT), `registrations/[id]` (checkout/recheckin)

---

## Changelog v19 (15 มีนาคม 2569)

### 🔄 SSE Real-time Updates (แทน Polling)

**Architecture:**
```
[API Mutation] → sseManager.broadcast('event-type')
                    ↓
[SSE Endpoint /api/sse] → ReadableStream → ทุก client ที่เปิดอยู่
                    ↓
[useSSE hook] → EventSource listener → refetch data ทันที
```

**ไฟล์ใหม่:**
| ไฟล์ | หน้าที่ |
|------|--------|
| `src/lib/sse-manager.ts` | Singleton จัดการ connections + broadcast events |
| `src/app/api/sse/route.ts` | SSE endpoint (heartbeat 30s, Nginx-compatible) |
| `src/lib/use-sse.ts` | React hook — auto reconnect (exponential backoff, max 5 attempts) + polling fallback |

**APIs ที่เพิ่ม broadcast:**
| API | Event Type | เมื่อไหร่ |
|-----|------------|----------|
| `POST /api/registrations` | `registration` | Check-in |
| `PUT /api/registrations/[id]` | `registration` | Checkout / Re-checkin |
| `DELETE /api/registrations/[id]` | `registration` | Cancel |
| `POST /api/votes` | `vote` | ลงคะแนน |
| `PUT /api/agendas/[id]/status` | `agenda` | เปิด/ปิด/ประกาศผลวาระ |

**8 หน้าที่เปลี่ยนจาก polling → SSE:**
1. `/registration` — 10s fallback
2. `/chairman` — 5s fallback
3. `/mc` — 5s fallback
4. `/tallying` — 5s fallback
5. `/auditor` — 10s fallback
6. `/quorum` — 5s fallback
7. `/quorum-display` — 5s fallback
8. `/vote-results` — 5s fallback

**Nginx config ที่ต้องเพิ่มสำหรับ SSE:**
```nginx
proxy_set_header Connection '';
proxy_buffering off;
```
