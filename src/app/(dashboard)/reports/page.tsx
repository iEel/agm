'use client';

import { useState } from 'react';
import { useSession } from '@/lib/session-context';
import { FileText, Download, Loader2, AlertCircle, FileDown } from 'lucide-react';

interface ReportData {
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

const RESOLUTION_LABELS: Record<string, string> = {
  INFO: 'แจ้งเพื่อทราบ',
  MAJORITY: 'มติทั่วไป (>50%)',
  TWO_THIRDS: 'มติ 2 ใน 3 (≥66.66%)',
  SPECIAL: 'มติพิเศษ (≥75%)',
  ELECTION: 'เลือกตั้งกรรมการ',
};

const RESULT_LABELS: Record<string, string> = {
  APPROVED: '✅ อนุมัติ',
  REJECTED: '❌ ไม่อนุมัติ',
  ACKNOWLEDGED: '📋 รับทราบ',
  PENDING: '⏳ รอผล',
};

export default function ReportsPage() {
  const { activeEvent } = useSession();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reports/pdf-data');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setReportData(data);
    } catch {
      setError('ไม่สามารถดึงข้อมูลรายงานได้');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!reportData) return;
    setPdfLoading(true);
    try {
      const { pdf } = await import('@react-pdf/renderer');
      const { ReportPDFDocument } = await import('@/components/ReportPDF');
      const { createElement } = await import('react');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = await pdf(createElement(ReportPDFDocument, { data: reportData }) as any).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `รายงาน_${reportData.company.nameTh}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation error:', err);
      setError('ไม่สามารถสร้าง PDF ได้ — กรุณาลองใหม่');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleExportVotes = async () => {
    window.open('/api/reports/vote-export', '_blank');
  };

  const handleExportRegistrations = async () => {
    window.open('/api/reports/registration-export', '_blank');
  };

  const formatShares = (s: string) => BigInt(s).toLocaleString('th-TH');
  const formatDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-lg font-semibold text-text-primary">ไม่มีงานประชุมที่ Active</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            รายงาน
          </h1>
          <p className="text-sm text-text-secondary mt-1">{activeEvent.companyName}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchReport} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium cursor-pointer disabled:opacity-50">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {reportData ? 'รีเฟรช' : 'สร้างรายงาน'}
          </button>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="glass-card-light p-4 flex items-center gap-3 flex-wrap print:hidden">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">ส่งออก:</p>
        <button onClick={handleExportVotes} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium border border-emerald-500/20 hover:bg-emerald-500/25 cursor-pointer">
          <Download className="w-3 h-3" /> Excel ผลโหวต
        </button>
        <button onClick={handleExportRegistrations} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs font-medium border border-blue-500/20 hover:bg-blue-500/25 cursor-pointer">
          <Download className="w-3 h-3" /> Excel ลงทะเบียน
        </button>
        {reportData && (
          <>
            <button onClick={handleDownloadPDF} disabled={pdfLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-medium border border-primary/20 hover:bg-primary/25 cursor-pointer disabled:opacity-50">
              {pdfLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
              {pdfLoading ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลด PDF'}
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-medium border border-amber-500/20 hover:bg-amber-500/25 cursor-pointer">
              <FileText className="w-3 h-3" /> พิมพ์
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="glass-card p-4 text-center text-danger text-sm">{error}</div>
      )}

      {/* Report Preview */}
      {reportData && (
        <div id="report-content" className="glass-card p-8 print:bg-white print:text-black print:shadow-none">
          {/* Report Header */}
          <div className="text-center mb-8 border-b border-border pb-6 print:border-black">
            {reportData.company.logoUrl && (
              <img src={reportData.company.logoUrl} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-3" />
            )}
            <h2 className="text-xl font-bold text-text-primary print:text-black">{reportData.company.nameTh}</h2>
            <p className="text-sm text-text-secondary print:text-gray-600">{reportData.company.name}</p>
            {reportData.company.address && <p className="text-xs text-text-muted mt-1 print:text-gray-500">{reportData.company.address}</p>}
            <div className="mt-4">
              <h3 className="text-lg font-semibold text-text-primary print:text-black">
                รายงานการประชุม{reportData.event.type === 'AGM' ? 'สามัญ' : 'วิสามัญ'}ผู้ถือหุ้น
              </h3>
              <p className="text-sm text-text-secondary print:text-gray-600">{reportData.event.name}</p>
              <p className="text-xs text-text-muted mt-1 print:text-gray-500">
                วันที่ {formatDate(reportData.event.date)}
                {reportData.event.venue && ` ณ ${reportData.event.venue}`}
              </p>
            </div>
          </div>

          {/* Statistics — FR9.2: Self vs Proxy breakdown */}
          <div className="mb-8">
            <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 print:text-black">สรุปองค์ประชุม (Attendance / Quorum Report)</h4>
            <table className="w-full text-sm border-collapse print:text-black">
              <thead>
                <tr className="bg-bg-tertiary/50 print:bg-gray-100">
                  <th className="border border-border/50 print:border-gray-300 px-3 py-2 text-left font-semibold">ประเภท</th>
                  <th className="border border-border/50 print:border-gray-300 px-3 py-2 text-right font-semibold">จำนวน (ราย)</th>
                  <th className="border border-border/50 print:border-gray-300 px-3 py-2 text-right font-semibold">จำนวนหุ้น</th>
                  <th className="border border-border/50 print:border-gray-300 px-3 py-2 text-right font-semibold">คิดเป็น %</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2">ผู้ถือหุ้นมาประชุมด้วยตนเอง</td>
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2 text-right">{reportData.statistics.selfCount.toLocaleString('th-TH')}</td>
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2 text-right">{formatShares(reportData.statistics.selfShares)}</td>
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2 text-right">
                    {Number(reportData.statistics.totalShares) > 0
                      ? ((Number(reportData.statistics.selfShares) / Number(reportData.statistics.totalShares)) * 100).toFixed(2)
                      : '0.00'}%
                  </td>
                </tr>
                <tr>
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2">ผู้รับมอบฉันทะ</td>
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2 text-right">{reportData.statistics.proxyAttendeeCount.toLocaleString('th-TH')}</td>
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2 text-right">{formatShares(reportData.statistics.proxyAttendeeShares)}</td>
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2 text-right">
                    {Number(reportData.statistics.totalShares) > 0
                      ? ((Number(reportData.statistics.proxyAttendeeShares) / Number(reportData.statistics.totalShares)) * 100).toFixed(2)
                      : '0.00'}%
                  </td>
                </tr>
                <tr className="font-bold bg-bg-tertiary/30 print:bg-gray-50">
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2">รวมผู้มาประชุมทั้งสิ้น</td>
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2 text-right">{reportData.statistics.currentAttendees.toLocaleString('th-TH')}</td>
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2 text-right">{formatShares(reportData.statistics.currentShares)}</td>
                  <td className="border border-border/50 print:border-gray-300 px-3 py-2 text-right">{reportData.statistics.quorumPercentage}%</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2 text-xs text-text-muted print:text-gray-500">
              หุ้นที่จำหน่ายได้แล้วทั้งหมด: {formatShares(reportData.statistics.totalShares)} หุ้น
            </div>
          </div>

          {/* Agenda Results */}
          <div>
            <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 print:text-black">ผลการลงคะแนนเสียง</h4>
            <div className="space-y-4">
              {reportData.agendas.map((a) => {
                const eligible = a.snapshot ? BigInt(a.snapshot.eligibleShares) : BigInt(0);
                const pct = (v: string) => eligible > BigInt(0) ? ((Number(v) / Number(eligible)) * 100).toFixed(2) : '0.00';
                return (
                <div key={a.orderNo} className="p-4 rounded-xl bg-bg-tertiary/30 border border-border/50 print:border-gray-300 print:bg-white">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-text-primary print:text-black">
                        วาระที่ {a.orderNo}: {a.titleTh}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5 print:text-gray-500">
                        ประเภท: {RESOLUTION_LABELS[a.resolutionType] || a.resolutionType}
                      </p>
                    </div>
                    <span className={`badge text-xs print:text-black print:border print:border-gray-400 ${
                      a.status === 'CLOSED' || a.status === 'ANNOUNCED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-gray-500/15 text-gray-400'
                    }`}>{a.status}</span>
                  </div>

                  {a.snapshot ? (
                    <div>
                      <table className="w-full text-xs border-collapse mb-3 print:text-black">
                        <thead>
                          <tr className="bg-bg-tertiary/30 print:bg-gray-100">
                            <th className="border border-border/30 print:border-gray-300 px-2 py-1.5 text-left">คะแนน</th>
                            <th className="border border-border/30 print:border-gray-300 px-2 py-1.5 text-right">จำนวนหุ้น</th>
                            <th className="border border-border/30 print:border-gray-300 px-2 py-1.5 text-right">คิดเป็น %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: 'เห็นด้วย', value: a.snapshot.approveShares, color: 'text-emerald-400 print:text-green-700' },
                            { label: 'ไม่เห็นด้วย', value: a.snapshot.disapproveShares, color: 'text-red-400 print:text-red-700' },
                            { label: 'งดออกเสียง', value: a.snapshot.abstainShares, color: 'text-amber-400 print:text-amber-700' },
                            { label: 'บัตรเสีย', value: a.snapshot.voidShares, color: 'text-gray-400 print:text-gray-700' },
                          ].map(({ label, value, color }) => (
                            <tr key={label}>
                              <td className={`border border-border/30 print:border-gray-300 px-2 py-1.5 font-medium ${color}`}>{label}</td>
                              <td className="border border-border/30 print:border-gray-300 px-2 py-1.5 text-right">{formatShares(value)}</td>
                              <td className="border border-border/30 print:border-gray-300 px-2 py-1.5 text-right font-bold">{pct(value)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-text-muted print:text-gray-500">
                          ผู้เข้าร่วม: {a.snapshot.totalAttendees} | หุ้นมีสิทธิ: {formatShares(a.snapshot.eligibleShares)}
                        </span>
                        <span className="font-bold text-text-primary print:text-black">
                          {RESULT_LABELS[a.snapshot.result || ''] || a.snapshot.result}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted italic print:text-gray-400">ยังไม่มีผลคะแนน</p>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {/* Signature Area — FR9.1 */}
          <div className="mt-12 pt-6 border-t border-border print:border-gray-300">
            <div className="grid grid-cols-2 gap-12">
              <div className="text-center">
                <div className="h-20" />
                <div className="border-t border-border print:border-gray-400 mx-8 pt-2">
                  <p className="text-sm font-semibold text-text-primary print:text-black">ประธานกรรมการ</p>
                  <p className="text-xs text-text-muted print:text-gray-500">วันที่ ____/____/________</p>
                </div>
              </div>
              <div className="text-center">
                <div className="h-20" />
                <div className="border-t border-border print:border-gray-400 mx-8 pt-2">
                  <p className="text-sm font-semibold text-text-primary print:text-black">เลขานุการบริษัท</p>
                  <p className="text-xs text-text-muted print:text-gray-500">วันที่ ____/____/________</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-border text-center print:border-gray-300">
            <p className="text-xs text-text-muted print:text-gray-500">
              รายงานสร้างเมื่อ {new Date().toLocaleString('th-TH')} — e-AGM System
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
