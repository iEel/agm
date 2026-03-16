'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSSE } from '@/lib/use-sse';

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

export default function QuorumDisplayPage() {
  const [data, setData] = useState<QuorumData | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());

  // Live clock — ticks every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/public/quorum');
      if (!res.ok) {
        setError('ไม่มีงานประชุมที่ Active');
        return;
      }
      const json = await res.json();
      setData(json);
      setError('');
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SSE real-time updates (falls back to polling every 5s)
  useSSE(fetchData, 5000);

  const fmt = (n: string | number) => BigInt(n).toLocaleString('th-TH');
  const fmtDate = (d: string) => {
    const date = new Date(d);
    const thaiYear = date.getFullYear() + 543;
    const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const weekdays = ['วันอาทิตย์','วันจันทร์','วันอังคาร','วันพุธ','วันพฤหัสบดี','วันศุกร์','วันเสาร์'];
    return `${weekdays[date.getDay()]}ที่ ${date.getDate()} ${months[date.getMonth()]} ${thaiYear}`;
  };
  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl text-gray-400 mb-2">⚠</p>
          <p className="text-gray-500 text-lg">{error}</p>
          <p className="text-gray-400 text-sm mt-2">กำลังพยายามเชื่อมต่อใหม่...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">กำลังโหลดข้อมูลองค์ประชุม...</p>
        </div>
      </div>
    );
  }

  const pct = parseFloat(data.percentage);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Company Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white py-8 px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-6">
          <div className="text-center flex-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {data.company.nameTh}
            </h1>
            <p className="text-lg text-slate-300 mt-1">{data.company.nameEn}</p>
            <div className="mt-4 flex flex-col items-center gap-1">
              <p className="text-xl font-semibold">
                {data.event.type === 'AGM' ? 'การประชุมสามัญผู้ถือหุ้นประจำปี' : 'การประชุมวิสามัญผู้ถือหุ้น'}
              </p>
              <p className="text-base text-slate-300">
                {fmtDate(data.event.date)}
                {data.event.venue && ` เวลา 14.00 น.`}
              </p>
              {data.event.venue && (
                <p className="text-sm text-slate-400">ณ {data.event.venue}</p>
              )}
            </div>
          </div>
          {data.company.logoUrl && (
            <div className="flex-shrink-0">
              <img
                src={data.company.logoUrl}
                alt={data.company.nameTh}
                className="w-24 h-24 object-contain rounded-xl bg-white p-2"
              />
            </div>
          )}
        </div>
      </header>

      {/* Section Title */}
      <div className="bg-emerald-600 py-3 text-center">
        <h2 className="text-xl font-bold text-white tracking-wide">
          สรุปสถานะการลงทะเบียน
        </h2>
      </div>

      {/* Timestamp — live clock */}
      <div className="bg-gray-50 border-b border-gray-200 py-2 text-center">
        <p className="text-sm text-gray-600">
          ข้อมูลการลงทะเบียน ณ เวลาปัจจุบัน&ensp;
          <strong className="text-gray-800">
            {(() => {
              const dd = String(now.getDate()).padStart(2, '0');
              const mm = String(now.getMonth() + 1).padStart(2, '0');
              const yyyy = now.getFullYear() + 543;
              return `${dd}/${mm}/${yyyy}`;
            })()}
          </strong>
          &ensp;
          <strong className="text-gray-800">
            {now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </strong>
        </p>
      </div>

      {/* Main Table */}
      <main className="flex-1 px-6 md:px-12 py-6 max-w-5xl mx-auto w-full">
        <p className="text-sm text-gray-500 mb-4 font-medium">
          ผู้ถือหุ้นมาร่วมประชุมมีดังนี้ (No. of Shareholder attend)
        </p>

        <table className="w-full border-collapse text-gray-800" style={{ borderSpacing: 0 }}>
          {/* Header */}
          <thead>
            <tr>
              <th className="text-left py-3 px-5 bg-emerald-600 text-white w-[24%]">
                <span className="block text-sm font-bold">ประเภทผู้ถือหุ้น</span>
                <span className="block text-xs font-normal text-emerald-100">(Type of Shareholders)</span>
              </th>
              <th className="text-center py-3 px-3 bg-emerald-600 text-white w-[14%]" colSpan={2}>
                <span className="block text-sm font-bold">จำนวนผู้ถือหุ้น</span>
                <span className="block text-xs font-normal text-emerald-100">(No. of Shareholders)</span>
              </th>
              <th className="py-3 px-3 bg-emerald-600 w-[24%]">&nbsp;</th>
              <th className="text-right py-3 px-5 bg-emerald-600 text-white w-[38%]" colSpan={2}>
                <span className="block text-sm font-bold">จำนวนหุ้น</span>
                <span className="block text-xs font-normal text-emerald-100">(No. of Shares)</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Shareholders (SELF) */}
            <tr>
              <td className="py-4 px-5">
                <span className="text-base font-bold">มาด้วยตัวเอง</span>
                <span className="block text-xs text-gray-500">(Shareholders)</span>
              </td>
              <td className="py-4 px-2 text-right">
                <span className="text-2xl font-bold">{data.self.count.toLocaleString('th-TH')}</span>
              </td>
              <td className="py-4 px-2 text-left">
                <span className="text-sm text-gray-500">ราย<br />(Persons)</span>
              </td>
              <td className="py-4 px-3 text-left">
                <span className="text-sm text-gray-500">ถือหุ้นรวม<br />(No. of Shares)</span>
              </td>
              <td className="py-4 px-2 text-right">
                <span className="text-2xl font-bold">{fmt(data.self.shares)}</span>
              </td>
              <td className="py-4 px-3 text-left">
                <span className="text-sm text-gray-500">หุ้น<br />(Shares)</span>
              </td>
            </tr>

            {/* Proxies */}
            <tr>
              <td className="py-4 px-5">
                <span className="text-base font-bold">รับมอบฉันทะ</span>
                <span className="block text-xs text-gray-500">(Proxies)</span>
              </td>
              <td className="py-4 px-2 text-right">
                <span className="text-2xl font-bold">{data.proxy.count.toLocaleString('th-TH')}</span>
              </td>
              <td className="py-4 px-2 text-left">
                <span className="text-sm text-gray-500">ราย<br />(Persons)</span>
              </td>
              <td className="py-4 px-3 text-left">
                <span className="text-sm text-gray-500">ถือหุ้นรวม<br />(No. of Shares)</span>
              </td>
              <td className="py-4 px-2 text-right">
                <span className="text-2xl font-bold">{fmt(data.proxy.shares)}</span>
              </td>
              <td className="py-4 px-3 text-left">
                <span className="text-sm text-gray-500">หุ้น<br />(Shares)</span>
              </td>
            </tr>

            {/* Divider */}
            <tr><td colSpan={6} className="border-t-2 border-gray-800 h-0 p-0"></td></tr>

            {/* Total */}
            <tr className="bg-gray-50">
              <td className="py-4 px-5">
                <span className="text-lg font-bold">รวม</span>
                <span className="block text-xs text-gray-500">(Total)</span>
              </td>
              <td className="py-4 px-2 text-right">
                <span className="text-3xl font-black">{data.total.count.toLocaleString('th-TH')}</span>
              </td>
              <td className="py-4 px-2 text-left">
                <span className="text-sm font-medium text-gray-600">ราย<br />(Persons)</span>
              </td>
              <td className="py-4 px-3 text-left">
                <span className="text-sm font-medium text-gray-600">รวมผู้ถือหุ้นทั้งสิ้น<br />(Total No. of Shares)</span>
              </td>
              <td className="py-4 px-2 text-right">
                <span className="text-3xl font-black">{fmt(data.total.shares)}</span>
              </td>
              <td className="py-4 px-3 text-left">
                <span className="text-sm font-medium text-gray-600">หุ้น<br />(Shares)</span>
              </td>
            </tr>

            {/* Percentage */}
            <tr>
              <td className="py-4 px-5">
                <span className="text-base font-bold">คิดเป็น</span>
                <span className="block text-xs text-gray-500">(Total shares are)</span>
              </td>
              <td className="py-4 px-2 text-right">
                <span className={`text-3xl font-black ${pct >= 33.33 ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {data.percentage}
                </span>
              </td>
              <td className="py-4 px-2 text-left">
                <span className="text-lg font-bold text-gray-700">%</span>
              </td>
              <td className="py-4 px-3 text-left">
                <span className="text-sm text-gray-600">ของหุ้นที่จำหน่ายได้ทั้งหมด<br />(of Total Paid up Capital)</span>
              </td>
              <td className="py-4 px-2 text-right">
                <span className="text-2xl font-bold">{fmt(data.totalPaidUpShares)}</span>
              </td>
              <td className="py-4 px-3 text-left">
                <span className="text-sm text-gray-500">หุ้น<br />(Shares)</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Quorum Status */}
        <div className={`mt-6 py-4 px-6 rounded-xl border-2 flex items-center gap-4 ${
          data.quorumMet
            ? 'bg-emerald-50 border-emerald-500'
            : 'bg-amber-50 border-amber-500'
        }`}>
          <div className={`text-4xl ${data.quorumMet ? '' : ''}`}>
            {data.quorumMet ? '✅' : '⚠️'}
          </div>
          <div>
            <p className="text-lg font-bold">
              <span className="text-gray-700">สถานะองค์ประชุม:&ensp;</span>
              <span className={`text-xl ${data.quorumMet ? 'text-emerald-700' : 'text-amber-700'}`}>
                {data.quorumMet ? 'องค์ประชุมครบสมบูรณ์' : 'ยังไม่ครบองค์ประชุม'}
              </span>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-3 text-center">
        <p className="text-xs text-gray-400">
          ข้อมูลอัปเดตอัตโนมัติทุก 5 วินาที — e-AGM System
        </p>
      </footer>
    </div>
  );
}
