'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/lib/session-context';
import { AlertCircle, RefreshCw, Users, Percent, Maximize2 } from 'lucide-react';

interface QuorumData {
  company: { nameTh: string; nameEn: string; logoUrl: string | null };
  event: { name: string; type: string; date: string; venue: string | null };
  self: { count: number; shares: string };
  proxy: { count: number; shares: string };
  total: { count: number; shares: string };
  totalPaidUpShares: string;
  totalShareholders: number;
  percentage: string;
  quorumMet: boolean;
  quorumDetail: { personsOk: boolean; sharesOk: boolean; minPersons: number; minSharesFraction: string };
  timestamp: string;
}

export default function QuorumPage() {
  const { activeEvent } = useSession();
  const [data, setData] = useState<QuorumData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/registrations/quorum-summary');
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const fmt = (n: string | number) => BigInt(n).toLocaleString('th-TH');
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">ไม่มีงานประชุมที่ Active</h2>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-text-muted text-sm">กำลังโหลดข้อมูลองค์ประชุม...</p>
      </div>
    );
  }

  const pct = parseFloat(data.percentage);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Percent className="w-5 h-5 text-white" />
            </div>
            สถานะองค์ประชุม
          </h1>
          <p className="text-sm text-text-secondary mt-1">{activeEvent.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">อัปเดตอัตโนมัติ</p>
            <p className="text-xs text-text-muted flex items-center gap-1 justify-end">
              <RefreshCw className="w-3 h-3 animate-spin" /> ทุก 5 วินาที
            </p>
          </div>
          <a
            href="/quorum-display"
            target="_blank"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-primary/25 cursor-pointer"
          >
            <Maximize2 className="w-4 h-4" />
            เปิดเต็มจอ
          </a>
        </div>
      </div>

      {/* Formal Display Card */}
      <div className="glass-card overflow-hidden">
        {/* Company Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-6 text-white">
          <div className="flex items-center justify-center gap-6">
            <div className="text-center flex-1">
              <h2 className="text-xl font-bold">{data.company.nameTh}</h2>
              <p className="text-sm opacity-80">{data.company.nameEn}</p>
              <div className="mt-3 flex flex-col items-center gap-1">
                <p className="text-base font-semibold">
                  {data.event.type === 'AGM' ? 'การประชุมสามัญผู้ถือหุ้นประจำปี' : 'การประชุมวิสามัญผู้ถือหุ้น'}
                </p>
                <p className="text-sm opacity-80">
                  {fmtDate(data.event.date)}
                  {data.event.venue && ` ณ ${data.event.venue}`}
                </p>
              </div>
            </div>
            {data.company.logoUrl && (
              <div className="flex-shrink-0">
                <img src={data.company.logoUrl} alt={data.company.nameTh} className="w-16 h-16 object-contain rounded-lg bg-white p-1.5" />
              </div>
            )}
          </div>
        </div>

        {/* Section Header */}
        <div className="bg-emerald-600 px-6 py-2.5">
          <h3 className="text-center text-sm font-bold text-white">
            สรุปสถานะการลงทะเบียน
          </h3>
        </div>

        {/* Timestamp */}
        <div className="px-6 py-2 text-center border-b border-border">
          <p className="text-xs text-text-muted">
            ข้อมูลการลงทะเบียน ณ เวลาปัจจุบัน&ensp;
            <strong className="text-text-secondary">
              {(() => {
                const d = new Date(data.timestamp);
                const dd = String(d.getDate()).padStart(2, '0');
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear() + 543;
                return `${dd}/${mm}/${yyyy}`;
              })()}
            </strong>
            &ensp;
            <strong className="text-text-secondary">{fmtTime(data.timestamp)}</strong>
          </p>
        </div>

        {/* Registration Table */}
        <div className="px-4 py-4">
          <p className="text-xs text-text-muted mb-3 font-medium">
            ผู้ถือหุ้นมาร่วมประชุมมีดังนี้ (No. of Shareholder attend)
          </p>

          <table className="w-full border-collapse text-text-primary" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th className="text-left py-2 px-3 bg-emerald-600 text-white text-xs font-bold w-[22%]">
                  <span className="block">ประเภทผู้ถือหุ้น</span>
                  <span className="block text-[10px] font-normal text-emerald-100">(Type of Shareholders)</span>
                </th>
                <th className="text-center py-2 px-2 bg-emerald-600 text-white text-xs font-bold w-[12%]" colSpan={2}>
                  <span className="block">จำนวนผู้ถือหุ้น</span>
                  <span className="block text-[10px] font-normal text-emerald-100">(No. of Shareholders)</span>
                </th>
                <th className="py-2 px-2 bg-emerald-600 w-[22%]">&nbsp;</th>
                <th className="text-right py-2 px-3 bg-emerald-600 text-white text-xs font-bold w-[44%]" colSpan={2}>
                  <span className="block">จำนวนหุ้น</span>
                  <span className="block text-[10px] font-normal text-emerald-100">(No. of Shares)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* Self */}
              <tr>
                <td className="py-3 px-3">
                  <span className="text-sm font-bold text-text-primary">มาด้วยตัวเอง</span>
                  <span className="block text-[10px] text-text-muted">(Shareholders)</span>
                </td>
                <td className="py-3 px-1 text-right">
                  <span className="text-lg font-bold text-text-primary">{data.self.count.toLocaleString('th-TH')}</span>
                </td>
                <td className="py-3 px-1 text-left">
                  <span className="text-[10px] text-text-muted">ราย<br/>(Persons)</span>
                </td>
                <td className="py-3 px-2 text-left">
                  <span className="text-[10px] text-text-muted">ถือหุ้นรวม<br/>(No. of Shares)</span>
                </td>
                <td className="py-3 px-1 text-right">
                  <span className="text-lg font-bold text-text-primary">{fmt(data.self.shares)}</span>
                </td>
                <td className="py-3 px-2 text-left">
                  <span className="text-[10px] text-text-muted">หุ้น<br/>(Shares)</span>
                </td>
              </tr>

              {/* Proxy */}
              <tr>
                <td className="py-3 px-3">
                  <span className="text-sm font-bold text-text-primary">รับมอบฉันทะ</span>
                  <span className="block text-[10px] text-text-muted">(Proxies)</span>
                </td>
                <td className="py-3 px-1 text-right">
                  <span className="text-lg font-bold text-text-primary">{data.proxy.count.toLocaleString('th-TH')}</span>
                </td>
                <td className="py-3 px-1 text-left">
                  <span className="text-[10px] text-text-muted">ราย<br/>(Persons)</span>
                </td>
                <td className="py-3 px-2 text-left">
                  <span className="text-[10px] text-text-muted">ถือหุ้นรวม<br/>(No. of Shares)</span>
                </td>
                <td className="py-3 px-1 text-right">
                  <span className="text-lg font-bold text-text-primary">{fmt(data.proxy.shares)}</span>
                </td>
                <td className="py-3 px-2 text-left">
                  <span className="text-[10px] text-text-muted">หุ้น<br/>(Shares)</span>
                </td>
              </tr>

              {/* Divider */}
              <tr><td colSpan={6} className="border-t-2 border-gray-800 dark:border-gray-400 h-0 p-0"></td></tr>

              {/* Total */}
              <tr className="bg-bg-tertiary/30">
                <td className="py-3 px-3">
                  <span className="text-sm font-bold text-text-primary">รวม</span>
                  <span className="block text-[10px] text-text-muted">(Total)</span>
                </td>
                <td className="py-3 px-1 text-right">
                  <span className="text-xl font-black text-text-primary">{data.total.count.toLocaleString('th-TH')}</span>
                </td>
                <td className="py-3 px-1 text-left">
                  <span className="text-[10px] font-medium text-text-secondary">ราย<br/>(Persons)</span>
                </td>
                <td className="py-3 px-2 text-left">
                  <span className="text-[10px] font-medium text-text-secondary">รวมผู้ถือหุ้นทั้งสิ้น<br/>(Total No. of Shares)</span>
                </td>
                <td className="py-3 px-1 text-right">
                  <span className="text-xl font-black text-text-primary">{fmt(data.total.shares)}</span>
                </td>
                <td className="py-3 px-2 text-left">
                  <span className="text-[10px] font-medium text-text-secondary">หุ้น<br/>(Shares)</span>
                </td>
              </tr>

              {/* Percentage */}
              <tr>
                <td className="py-3 px-3">
                  <span className="text-sm font-bold text-text-primary">คิดเป็น</span>
                  <span className="block text-[10px] text-text-muted">(Total shares are)</span>
                </td>
                <td className="py-3 px-1 text-right">
                  <span className={`text-xl font-black ${pct >= 33.33 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {data.percentage}
                  </span>
                </td>
                <td className="py-3 px-1 text-left">
                  <span className="text-sm font-bold text-text-secondary">%</span>
                </td>
                <td className="py-3 px-2 text-left">
                  <span className="text-[10px] text-text-muted">ของหุ้นที่จำหน่ายได้ทั้งหมด<br/>(of Total Paid up Capital)</span>
                </td>
                <td className="py-3 px-1 text-right">
                  <span className="text-base font-bold text-text-primary">{fmt(data.totalPaidUpShares)}</span>
                </td>
                <td className="py-3 px-2 text-left">
                  <span className="text-[10px] text-text-muted">หุ้น<br/>(Shares)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Quorum Status Banner */}
        <div className={`px-6 py-4 border-t-2 ${
          data.quorumMet
            ? 'bg-emerald-500/10 border-emerald-500/30'
            : 'bg-amber-500/10 border-amber-500/30'
        }`}>
          <div className="flex items-center justify-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              data.quorumMet ? 'bg-emerald-500/20' : 'bg-amber-500/20'
            }`}>
              {data.quorumMet
                ? <Users className="w-5 h-5 text-emerald-500" />
                : <AlertCircle className="w-5 h-5 text-amber-500" />
              }
            </div>
            <p className="text-sm font-bold">
              <span className={data.quorumMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                สถานะองค์ประชุม:
              </span>
              {' '}
              <span className={`text-base ${data.quorumMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {data.quorumMet ? 'องค์ประชุมครบสมบูรณ์' : 'ยังไม่ครบองค์ประชุม'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
