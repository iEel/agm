'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer';

// Register Thai font (Sarabun)
Font.register({
  family: 'Sarabun',
  fonts: [
    { src: '/fonts/Sarabun-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/Sarabun-Bold.ttf', fontWeight: 'bold' },
    { src: '/fonts/Sarabun-Italic.ttf', fontStyle: 'italic' },
  ],
});

// Styles
const colors = {
  primary: '#4f46e5',
  green: '#059669',
  red: '#dc2626',
  amber: '#d97706',
  gray: '#6b7280',
  lightGray: '#f3f4f6',
  border: '#d1d5db',
  text: '#111827',
  muted: '#6b7280',
  white: '#ffffff',
  headerBg: '#1e3a5f',
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Sarabun',
    fontSize: 10,
    padding: 40,
    color: colors.text,
    backgroundColor: colors.white,
  },
  // Header
  headerContainer: {
    textAlign: 'center',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottom: `1pt solid ${colors.border}`,
  },
  logo: {
    width: 50,
    height: 50,
    objectFit: 'contain',
    marginHorizontal: 'auto',
    marginBottom: 8,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  companyNameEn: {
    fontSize: 10,
    color: colors.muted,
    marginBottom: 2,
  },
  address: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 10,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reportSubtitle: {
    fontSize: 10,
    color: colors.muted,
  },
  // Section
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: `0.5pt solid ${colors.border}`,
    color: colors.headerBg,
  },
  section: {
    marginBottom: 18,
  },
  // Table
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.headerBg,
  },
  tableHeaderCell: {
    padding: 6,
    fontSize: 9,
    fontWeight: 'bold',
    color: colors.white,
    borderRight: `0.5pt solid ${colors.white}`,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${colors.border}`,
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${colors.border}`,
    backgroundColor: '#f9fafb',
  },
  tableRowTotal: {
    flexDirection: 'row',
    borderBottom: `0.5pt solid ${colors.border}`,
    backgroundColor: colors.lightGray,
  },
  tableCell: {
    padding: 6,
    fontSize: 9,
    borderRight: `0.5pt solid ${colors.border}`,
  },
  tableCellRight: {
    padding: 6,
    fontSize: 9,
    textAlign: 'right',
    borderRight: `0.5pt solid ${colors.border}`,
  },
  tableCellBold: {
    padding: 6,
    fontSize: 9,
    fontWeight: 'bold',
    borderRight: `0.5pt solid ${colors.border}`,
  },
  // Agenda
  agendaCard: {
    marginBottom: 12,
    padding: 10,
    border: `0.5pt solid ${colors.border}`,
    borderRadius: 4,
  },
  agendaTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  agendaMeta: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 8,
  },
  resultBadge: {
    fontSize: 9,
    fontWeight: 'bold',
    padding: '3 8',
    borderRadius: 3,
  },
  approved: {
    color: colors.green,
    backgroundColor: '#ecfdf5',
  },
  rejected: {
    color: colors.red,
    backgroundColor: '#fef2f2',
  },
  pending: {
    color: colors.gray,
    backgroundColor: colors.lightGray,
  },
  // Signature
  signatureArea: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 40,
    paddingTop: 15,
    borderTop: `0.5pt solid ${colors.border}`,
  },
  signatureBlock: {
    width: '40%',
    textAlign: 'center',
  },
  signatureLine: {
    borderTop: `0.5pt solid ${colors.text}`,
    marginTop: 50,
    paddingTop: 6,
  },
  signatureLabel: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  signatureDate: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 3,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 7,
    color: colors.muted,
    borderTop: `0.5pt solid ${colors.border}`,
    paddingTop: 5,
  },
  // Flex helpers
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smallNote: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 4,
  },
});

// Interfaces (same shape as reports page)
export interface PDFReportData {
  event: { name: string; type: string; date: string; venue: string };
  company: { name: string; nameTh: string; address: string; taxId: string; logoUrl?: string };
  statistics: {
    totalShareholders: number;
    totalRegistrations: number;
    currentAttendees: number;
    currentShares: string;
    totalShares: string;
    quorumPercentage: string;
    proxyCount: number;
    selfCount: number;
    selfShares: string;
    proxyAttendeeCount: number;
    proxyAttendeeShares: string;
  };
  agendas: Array<{
    orderNo: number;
    titleTh: string;
    resolutionType: string;
    status: string;
    snapshot: {
      totalAttendees: number;
      eligibleShares: string;
      approveShares: string;
      disapproveShares: string;
      abstainShares: string;
      voidShares: string;
      result: string;
      closedAt: string;
    } | null;
  }>;
}

// Helpers
const fmt = (n: string | number) => BigInt(n).toLocaleString('th-TH');
const fmtDate = (d: string) => {
  const date = new Date(d);
  const thaiYear = date.getFullYear() + 543;
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return `${date.getDate()} ${months[date.getMonth()]} ${thaiYear}`;
};
const pct = (v: string, total: string) => {
  const t = Number(total);
  return t > 0 ? ((Number(v) / t) * 100).toFixed(2) : '0.00';
};

const RESOLUTION_LABELS: Record<string, string> = {
  INFO: 'แจ้งเพื่อทราบ',
  MAJORITY: 'มติทั่วไป (>50%)',
  TWO_THIRDS: 'มติ 2 ใน 3 (≥66.66%)',
  SPECIAL: 'มติพิเศษ (≥75%)',
  ELECTION: 'เลือกตั้งกรรมการ',
};

const RESULT_LABELS: Record<string, string> = {
  APPROVED: 'อนุมัติ',
  REJECTED: 'ไม่อนุมัติ',
  ACKNOWLEDGED: 'รับทราบ',
  PENDING: 'รอผล',
};

// Main PDF Document Component
export const ReportPDFDocument = ({ data }: { data: PDFReportData }) => {
  const now = new Date().toLocaleString('th-TH');
  const meetingType = data.event.type === 'AGM' ? 'สามัญ' : 'วิสามัญ';

  return (
    <Document
      title={`รายงานการประชุม${meetingType}ผู้ถือหุ้น — ${data.company.nameTh}`}
      author="e-AGM System"
    >
      <Page size="A4" style={s.page}>
        {/* ─── Header ─── */}
        <View style={s.headerContainer}>
          {data.company.logoUrl && (
            <Image src={data.company.logoUrl} style={s.logo} />
          )}
          <Text style={s.companyName}>{data.company.nameTh}</Text>
          <Text style={s.companyNameEn}>{data.company.name}</Text>
          {data.company.address && <Text style={s.address}>{data.company.address}</Text>}
          <Text style={s.reportTitle}>รายงานการประชุม{meetingType}ผู้ถือหุ้น</Text>
          <Text style={s.reportSubtitle}>{data.event.name}</Text>
          <Text style={s.reportSubtitle}>
            วันที่ {fmtDate(data.event.date)}
            {data.event.venue ? ` ณ ${data.event.venue}` : ''}
          </Text>
        </View>

        {/* ─── Attendance / Quorum ─── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>สรุปองค์ประชุม (Attendance / Quorum Report)</Text>

          {/* Table header */}
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, { width: '40%' }]}>ประเภท</Text>
            <Text style={[s.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>จำนวน (ราย)</Text>
            <Text style={[s.tableHeaderCell, { width: '25%', textAlign: 'right' }]}>จำนวนหุ้น</Text>
            <Text style={[s.tableHeaderCell, { width: '15%', textAlign: 'right', borderRight: 'none' }]}>คิดเป็น %</Text>
          </View>

          {/* Self */}
          <View style={s.tableRow}>
            <Text style={[s.tableCell, { width: '40%' }]}>ผู้ถือหุ้นมาประชุมด้วยตนเอง</Text>
            <Text style={[s.tableCellRight, { width: '20%' }]}>{data.statistics.selfCount.toLocaleString()}</Text>
            <Text style={[s.tableCellRight, { width: '25%' }]}>{fmt(data.statistics.selfShares)}</Text>
            <Text style={[s.tableCellRight, { width: '15%', borderRight: 'none' }]}>{pct(data.statistics.selfShares, data.statistics.totalShares)}%</Text>
          </View>

          {/* Proxy */}
          <View style={s.tableRowAlt}>
            <Text style={[s.tableCell, { width: '40%' }]}>ผู้รับมอบฉันทะ</Text>
            <Text style={[s.tableCellRight, { width: '20%' }]}>{data.statistics.proxyAttendeeCount.toLocaleString()}</Text>
            <Text style={[s.tableCellRight, { width: '25%' }]}>{fmt(data.statistics.proxyAttendeeShares)}</Text>
            <Text style={[s.tableCellRight, { width: '15%', borderRight: 'none' }]}>{pct(data.statistics.proxyAttendeeShares, data.statistics.totalShares)}%</Text>
          </View>

          {/* Total */}
          <View style={s.tableRowTotal}>
            <Text style={[s.tableCellBold, { width: '40%' }]}>รวมผู้มาประชุมทั้งสิ้น</Text>
            <Text style={[s.tableCellRight, { width: '20%', fontWeight: 'bold' }]}>{data.statistics.currentAttendees.toLocaleString()}</Text>
            <Text style={[s.tableCellRight, { width: '25%', fontWeight: 'bold' }]}>{fmt(data.statistics.currentShares)}</Text>
            <Text style={[s.tableCellRight, { width: '15%', fontWeight: 'bold', borderRight: 'none' }]}>{data.statistics.quorumPercentage}%</Text>
          </View>

          <Text style={s.smallNote}>หุ้นที่จำหน่ายได้แล้วทั้งหมด: {fmt(data.statistics.totalShares)} หุ้น</Text>
        </View>

        {/* ─── Agenda Results ─── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ผลการลงคะแนนเสียง</Text>

          {data.agendas.map((a) => {
            const eligible = a.snapshot ? a.snapshot.eligibleShares : '0';
            const resultStyle = a.snapshot?.result === 'APPROVED' ? s.approved
              : a.snapshot?.result === 'REJECTED' ? s.rejected : s.pending;

            return (
              <View key={a.orderNo} style={s.agendaCard} wrap={false}>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.agendaTitle}>วาระที่ {a.orderNo}: {a.titleTh}</Text>
                    <Text style={s.agendaMeta}>
                      ประเภท: {RESOLUTION_LABELS[a.resolutionType] || a.resolutionType}
                    </Text>
                  </View>
                  {a.snapshot && (
                    <Text style={[s.resultBadge, resultStyle]}>
                      {RESULT_LABELS[a.snapshot.result || ''] || a.snapshot.result || 'รอผล'}
                    </Text>
                  )}
                </View>

                {a.snapshot ? (
                  <View>
                    {/* Vote table */}
                    <View style={s.tableHeader}>
                      <Text style={[s.tableHeaderCell, { width: '35%' }]}>รายการ</Text>
                      <Text style={[s.tableHeaderCell, { width: '35%', textAlign: 'right' }]}>จำนวนเสียงที่ลงมติ (1 หุ้น = 1 เสียง)</Text>
                      <Text style={[s.tableHeaderCell, { width: '30%', textAlign: 'right', borderRight: 'none' }]}>ร้อยละ (%)</Text>
                    </View>

                    {[
                      { label: 'เห็นด้วย (Approved)', value: a.snapshot.approveShares },
                      { label: 'ไม่เห็นด้วย (Disapproved)', value: a.snapshot.disapproveShares },
                      { label: 'งดออกเสียง (Abstained)', value: a.snapshot.abstainShares },
                      { label: 'บัตรเสีย (Voided Ballot)', value: a.snapshot.voidShares },
                    ].map((item, idx) => (
                      <View key={item.label} style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                        <Text style={[s.tableCell, { width: '35%' }]}>{item.label}</Text>
                        <Text style={[s.tableCellRight, { width: '35%' }]}>{fmt(item.value)}</Text>
                        <Text style={[s.tableCellRight, { width: '30%', borderRight: 'none', fontWeight: 'bold' }]}>{pct(item.value, eligible)}%</Text>
                      </View>
                    ))}

                    {/* Total row */}
                    <View style={s.tableRowTotal}>
                      <Text style={[s.tableCellBold, { width: '35%' }]}>รวม (Total)</Text>
                      <Text style={[s.tableCellRight, { width: '35%', fontWeight: 'bold' }]}>{fmt(eligible)}</Text>
                      <Text style={[s.tableCellRight, { width: '30%', fontWeight: 'bold', borderRight: 'none' }]}>100.00%</Text>
                    </View>

                    <Text style={s.smallNote}>
                      ผู้เข้าร่วม: {a.snapshot.totalAttendees} ราย | หุ้นมีสิทธิ: {fmt(a.snapshot.eligibleShares)} หุ้น
                    </Text>
                  </View>
                ) : (
                  <Text style={[s.smallNote, { fontStyle: 'italic' }]}>ยังไม่มีผลคะแนน</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* ─── Signature Area ─── */}
        <View style={s.signatureArea} wrap={false}>
          <View style={s.signatureBlock}>
            <View style={s.signatureLine}>
              <Text style={s.signatureLabel}>ประธานกรรมการ</Text>
              <Text style={s.signatureDate}>วันที่ ____/____/________</Text>
            </View>
          </View>
          <View style={s.signatureBlock}>
            <View style={s.signatureLine}>
              <Text style={s.signatureLabel}>เลขานุการบริษัท</Text>
              <Text style={s.signatureDate}>วันที่ ____/____/________</Text>
            </View>
          </View>
        </View>

        {/* ─── Footer ─── */}
        <Text style={s.footer} fixed>
          รายงานสร้างเมื่อ {now} — e-AGM System
        </Text>
      </Page>
    </Document>
  );
};
