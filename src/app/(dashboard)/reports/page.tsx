'use client';

import { useState } from 'react';
import { useSession } from '@/lib/session-context';
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react';

interface ReportData {
  event: { name: string; type: string; date: string; venue: string };
  company: { name: string; nameTh: string; address: string; taxId: string };
  statistics: {
    totalShareholders: number;
    totalRegistrations: number;
    currentAttendees: number;
    currentShares: string;
    totalShares: string;
    quorumPercentage: string;
    proxyCount: number;
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
          <p className="text-sm text-text-secondary mt-1">{activeEvent.name}</p>
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
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-medium border border-amber-500/20 hover:bg-amber-500/25 cursor-pointer">
            <FileText className="w-3 h-3" /> พิมพ์ / PDF
          </button>
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

          {/* Statistics */}
          <div className="mb-8">
            <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 print:text-black">สถิติการประชุม</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'ผู้ถือหุ้นทั้งหมด', value: reportData.statistics.totalShareholders.toLocaleString('th-TH'), suffix: 'ราย' },
                { label: 'ลงทะเบียน', value: reportData.statistics.totalRegistrations.toLocaleString('th-TH'), suffix: 'ราย' },
                { label: 'มอบฉันทะ', value: reportData.statistics.proxyCount.toLocaleString('th-TH'), suffix: 'ราย' },
                { label: 'องค์ประชุม', value: reportData.statistics.quorumPercentage, suffix: '%' },
              ].map(({ label, value, suffix }) => (
                <div key={label} className="p-3 rounded-xl bg-bg-tertiary/50 text-center print:border print:border-gray-300 print:bg-gray-50">
                  <p className="text-xs text-text-muted print:text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-text-primary print:text-black">{value}<span className="text-xs font-normal ml-0.5">{suffix}</span></p>
                </div>
              ))}
            </div>
            <div className="mt-3 text-xs text-text-muted text-center print:text-gray-500">
              หุ้นที่เข้าร่วม: {formatShares(reportData.statistics.currentShares)} / {formatShares(reportData.statistics.totalShares)} หุ้น
            </div>
          </div>

          {/* Agenda Results */}
          <div>
            <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 print:text-black">ผลการลงคะแนนเสียง</h4>
            <div className="space-y-4">
              {reportData.agendas.map((a) => (
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
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {[
                          { label: 'เห็นด้วย', value: a.snapshot.approveShares, color: 'text-emerald-400 print:text-green-700' },
                          { label: 'ไม่เห็นด้วย', value: a.snapshot.disapproveShares, color: 'text-red-400 print:text-red-700' },
                          { label: 'งดออกเสียง', value: a.snapshot.abstainShares, color: 'text-amber-400 print:text-amber-700' },
                          { label: 'บัตรเสีย', value: a.snapshot.voidShares, color: 'text-gray-400 print:text-gray-700' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="text-center p-2 rounded-lg bg-bg-tertiary/50 print:border print:border-gray-200">
                            <p className="text-[10px] text-text-muted print:text-gray-500">{label}</p>
                            <p className={`text-sm font-bold ${color}`}>{formatShares(value)}</p>
                          </div>
                        ))}
                      </div>
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
              ))}
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
