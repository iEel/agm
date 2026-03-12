'use client';

import { useState, useEffect, useCallback } from 'react';

interface VoteData {
  company: { nameTh: string; nameEn: string; logoUrl: string | null };
  event: { name: string; type: string; date: string; venue: string | null };
  quorum: { additionalCount: number; additionalShares: string; attendeeCount: number; attendeeShares: string };
  agenda: { orderNo: number; titleTh: string; title: string; description: string | null; resolutionType: string; status: string; openedAt: string | null; closedAt: string | null };
  results: {
    approve: string; disapprove: string; abstain: string; voided: string; total: string;
    approvePercent: string; disapprovePercent: string; totalPercent: string;
    denominator: string; threshold: number; thresholdLabel: string; passed: boolean; result: string;
  };
  subAgendaResults: Array<{
    orderNo: number; title: string; titleTh: string;
    approve: string; disapprove: string; abstain: string; voided: string;
    approvePercent: string; disapprovePercent: string;
    passed: boolean; result: string; thresholdLabel: string;
  }> | null;
  allAgendas: Array<{ orderNo: number; titleTh: string; title: string; resolutionType: string; status: string }>;
  timestamp: string;
}

export default function VoteResultsDisplayPage() {
  const [data, setData] = useState<VoteData | null>(null);
  const [selectedAgenda, setSelectedAgenda] = useState(1);
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/vote-results?agendaOrder=${selectedAgenda}`);
      if (!res.ok) { setError('ไม่มีงานประชุมที่ Active หรือไม่พบวาระ'); return; }
      const json = await res.json();
      setData(json);
      setError('');
    } catch { setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'); }
  }, [selectedAgenda]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const fmt = (n: string | number) => BigInt(n).toLocaleString('th-TH');
  const fmtDate = (d: string) => {
    const date = new Date(d);
    const thaiYear = date.getFullYear() + 543;
    const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    const weekdays = ['วันอาทิตย์','วันจันทร์','วันอังคาร','วันพุธ','วันพฤหัสบดี','วันศุกร์','วันเสาร์'];
    return `${weekdays[date.getDay()]}ที่ ${date.getDate()} ${months[date.getMonth()]} ${thaiYear}`;
  };
  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

  const resolutionLabel = (type: string) => {
    switch (type) {
      case 'MAJORITY': return 'มติทั่วไป (>50%)';
      case 'SPECIAL': return 'มติพิเศษ (≥75%)';
      case 'TWO_THIRDS': return 'มติ 2/3 (≥66.67%)';
      case 'ELECTION': return 'เลือกตั้งกรรมการ';
      case 'INFO': return 'วาระแจ้งเพื่อทราบ';
      default: return type;
    }
  };

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
          <p className="text-gray-500">กำลังโหลดผลการลงคะแนน...</p>
        </div>
      </div>
    );
  }

  const r = data.results;
  const isElection = data.agenda.resolutionType === 'ELECTION';
  const isInfo = data.agenda.resolutionType === 'INFO';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Company Header */}
      <header className="bg-gradient-to-r from-slate-800 to-slate-900 text-white py-6 px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-6">
          <div className="text-center flex-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{data.company.nameTh}</h1>
            <p className="text-lg text-slate-300 mt-1">{data.company.nameEn}</p>
            <div className="mt-3 flex flex-col items-center gap-1">
              <p className="text-xl font-semibold">
                {data.event.type === 'AGM' ? 'การประชุมสามัญผู้ถือหุ้นประจำปี' : 'การประชุมวิสามัญผู้ถือหุ้น'}
              </p>
              <p className="text-base text-slate-300">{fmtDate(data.event.date)}</p>
            </div>
          </div>
          {data.company.logoUrl && (
            <div className="flex-shrink-0">
              <img src={data.company.logoUrl} alt={data.company.nameTh} className="w-24 h-24 object-contain rounded-xl bg-white p-2" />
            </div>
          )}
        </div>
      </header>

      {/* Agenda Selector */}
      <div className="bg-emerald-600 py-3 px-8 flex items-center justify-center gap-4">
        <h2 className="text-lg font-bold text-white">สรุปผลการลงคะแนนวาระที่:</h2>
        <select
          value={selectedAgenda}
          onChange={(e) => setSelectedAgenda(Number(e.target.value))}
          className="px-4 py-1.5 rounded-lg text-gray-800 font-bold text-lg bg-white border-0 cursor-pointer"
        >
          {data.allAgendas.map((a) => (
            <option key={a.orderNo} value={a.orderNo}>
              {a.orderNo}
            </option>
          ))}
        </select>
        <span className="text-emerald-100 text-sm">
          ({data.allAgendas.length} วาระ)
        </span>
      </div>

      {/* Agenda Title */}
      <div className="bg-gray-50 border-b border-gray-200 py-3 px-8 text-center">
        <p className="text-base text-gray-700 font-medium">{data.agenda.titleTh}</p>
        {data.agenda.description && (
          <p className="text-sm text-gray-500 mt-1">{data.agenda.description}</p>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 px-6 md:px-12 py-6 max-w-5xl mx-auto w-full">
        {isInfo ? (
          <div className="text-center py-12">
            <p className="text-2xl text-gray-400">📋</p>
            <p className="text-lg text-gray-600 mt-2">วาระแจ้งเพื่อทราบ — ไม่มีการลงคะแนน</p>
          </div>
        ) : (
          <>
            {/* Quorum Info */}
            <div className="mb-5 text-sm text-gray-600 border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full" style={{ borderSpacing: 0 }}>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-2.5 px-4 text-left">ในวาระนี้มีผู้ถือหุ้นเข้าร่วมประชุมเพิ่มเป็นจำนวน</td>
                    <td className="py-2.5 px-2 text-right font-bold text-gray-800 whitespace-nowrap">{data.quorum.additionalCount}</td>
                    <td className="py-2.5 px-1 text-left text-gray-500 whitespace-nowrap">ราย</td>
                    <td className="py-2.5 px-1 text-left text-gray-500 whitespace-nowrap">รวม</td>
                    <td className="py-2.5 px-2 text-right font-bold text-gray-800 whitespace-nowrap">{fmt(data.quorum.additionalShares)}</td>
                    <td className="py-2.5 px-4 text-left text-gray-500 whitespace-nowrap">หุ้น</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="py-2.5 px-4 text-left font-bold text-gray-700">รวมผู้ถือหุ้นเข้าร่วมประชุมทั้งสิ้น</td>
                    <td className="py-2.5 px-2 text-right font-black text-gray-900 whitespace-nowrap">{data.quorum.attendeeCount}</td>
                    <td className="py-2.5 px-1 text-left text-gray-500 whitespace-nowrap">ราย</td>
                    <td className="py-2.5 px-1 text-left text-gray-500 whitespace-nowrap">รวม</td>
                    <td className="py-2.5 px-2 text-right font-black text-gray-900 whitespace-nowrap">{fmt(data.quorum.attendeeShares)}</td>
                    <td className="py-2.5 px-4 text-left text-gray-500 whitespace-nowrap">หุ้น</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Vote Results Table (for non-election agendas) */}
            {!isElection ? (
              <>
                <table className="w-full border-collapse text-gray-800" style={{ borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th className="text-left py-3 px-5 bg-emerald-600 text-white text-sm font-bold w-[35%]">
                        <span className="block">รายการ</span>
                      </th>
                      <th className="text-center py-3 px-5 bg-emerald-600 text-white text-sm font-bold w-[40%]">
                        <span className="block">จำนวนเสียงที่ลงมติ</span>
                        <span className="block text-xs font-normal text-emerald-100">(1 หุ้น = 1 เสียง)</span>
                      </th>
                      <th className="text-center py-3 px-5 bg-emerald-600 text-white text-sm font-bold w-[25%]">
                        <span className="block">ร้อยละ (%)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* เห็นด้วย — always first */}
                    <tr>
                      <td className="py-3 px-5 text-lg font-bold">เห็นด้วย <span className="text-gray-500 font-normal">(Approved)</span></td>
                      <td className="py-3 px-5 text-right text-3xl font-bold">{fmt(r.approve)}</td>
                      <td className="py-3 px-5 text-right text-3xl font-bold text-emerald-700">{r.approvePercent}</td>
                    </tr>
                    {/* ไม่เห็นด้วย — always second */}
                    <tr>
                      <td className="py-3 px-5 text-base font-bold">ไม่เห็นด้วย <span className="text-gray-500 font-normal">(Disapproved)</span></td>
                      <td className="py-3 px-5 text-right text-2xl font-bold">{fmt(r.disapprove)}</td>
                      <td className="py-3 px-5 text-right text-2xl font-bold">{r.disapprovePercent}</td>
                    </tr>

                    {/* MAJORITY: รวม มาก่อน งดฯ/บัตรเสีย */}
                    {(data.agenda.resolutionType === 'MAJORITY' || data.agenda.resolutionType === 'ELECTION') && (
                      <>
                        <tr><td colSpan={3} className="border-t-2 border-gray-800 h-0 p-0"></td></tr>
                        <tr className="bg-gray-50">
                          <td className="py-3 px-5 text-lg font-bold">รวม <span className="text-gray-500 font-normal">(Total)</span></td>
                          <td className="py-3 px-5 text-right text-3xl font-black">{fmt(r.total)}</td>
                          <td className="py-3 px-5 text-right text-3xl font-black">{r.totalPercent}</td>
                        </tr>
                        <tr>
                          <td className="py-3 px-5 text-base font-bold">งดออกเสียง <span className="text-gray-500 font-normal">(Abstained)</span></td>
                          <td className="py-3 px-5 text-right text-2xl font-bold">{fmt(r.abstain)}</td>
                          <td className="py-3 px-5 text-right"></td>
                        </tr>
                        <tr>
                          <td className="py-3 px-5 text-base font-bold">บัตรเสีย <span className="text-gray-500 font-normal">(Voided Ballot)</span></td>
                          <td className="py-3 px-5 text-right text-2xl font-bold">{fmt(r.voided)}</td>
                          <td className="py-3 px-5 text-right"></td>
                        </tr>
                      </>
                    )}

                    {/* SPECIAL / TWO_THIRDS: งดฯ/บัตรเสีย มาก่อน รวม */}
                    {(data.agenda.resolutionType === 'SPECIAL' || data.agenda.resolutionType === 'TWO_THIRDS') && (
                      <>
                        <tr>
                          <td className="py-3 px-5 text-base font-bold">งดออกเสียง <span className="text-gray-500 font-normal">(Abstained)</span></td>
                          <td className="py-3 px-5 text-right text-2xl font-bold">{fmt(r.abstain)}</td>
                          <td className="py-3 px-5 text-right text-2xl font-bold">
                            {BigInt(r.denominator) > BigInt(0) ? (Number(BigInt(r.abstain)) / Number(BigInt(r.denominator)) * 100).toFixed(4) : '0.0000'}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-5 text-base font-bold">บัตรเสีย <span className="text-gray-500 font-normal">(Voided Ballot)</span></td>
                          <td className="py-3 px-5 text-right text-2xl font-bold">{fmt(r.voided)}</td>
                          <td className="py-3 px-5 text-right text-2xl font-bold">
                            {BigInt(r.denominator) > BigInt(0) ? (Number(BigInt(r.voided)) / Number(BigInt(r.denominator)) * 100).toFixed(4) : '0.0000'}
                          </td>
                        </tr>
                        <tr><td colSpan={3} className="border-t-2 border-gray-800 h-0 p-0"></td></tr>
                        <tr className="bg-gray-50">
                          <td className="py-3 px-5 text-lg font-bold">รวม <span className="text-gray-500 font-normal">(Total)</span></td>
                          <td className="py-3 px-5 text-right text-3xl font-black">{fmt(r.denominator)}</td>
                          <td className="py-3 px-5 text-right text-3xl font-black">100.0000</td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>

              </>
            ) : (
              /* Election Results — per candidate */
              <>
                {data.subAgendaResults && data.subAgendaResults.length > 0 ? (
                  data.subAgendaResults.map((sub, idx) => (
                    <div key={idx} className="mb-6">
                      <h3 className="text-base font-bold text-gray-800 mb-2 bg-gray-100 py-2 px-4 rounded-lg">
                        {data.agenda.orderNo}.{sub.orderNo} {sub.titleTh}
                      </h3>
                      <table className="w-full border-collapse text-gray-800 mb-2" style={{ borderSpacing: 0 }}>
                        <thead>
                          <tr>
                            <th className="text-left py-2 px-4 bg-emerald-600 text-white text-sm font-bold w-[35%]">รายการ</th>
                            <th className="text-center py-2 px-4 bg-emerald-600 text-white text-sm font-bold w-[40%]">
                              จำนวนเสียง<br/><span className="text-xs font-normal text-emerald-100">(1 หุ้น = 1 เสียง)</span>
                            </th>
                            <th className="text-center py-2 px-4 bg-emerald-600 text-white text-sm font-bold w-[25%]">ร้อยละ (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-2 px-4 font-bold">เห็นด้วย</td>
                            <td className="py-2 px-4 text-right text-xl font-bold">{fmt(sub.approve)}</td>
                            <td className="py-2 px-4 text-right text-xl font-bold text-emerald-700">{sub.approvePercent}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4 font-bold">ไม่เห็นด้วย</td>
                            <td className="py-2 px-4 text-right text-xl font-bold">{fmt(sub.disapprove)}</td>
                            <td className="py-2 px-4 text-right text-xl font-bold">{sub.disapprovePercent}</td>
                          </tr>
                          <tr>
                            <td className="py-2 px-4 font-bold">งดออกเสียง</td>
                            <td className="py-2 px-4 text-right text-xl font-bold">{fmt(sub.abstain)}</td>
                            <td className="py-2 px-4 text-right"></td>
                          </tr>
                        </tbody>
                      </table>
                      <div className={`py-2 px-4 rounded-lg text-sm font-bold ${
                        sub.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        ผลการลงคะแนน: {sub.result}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">ยังไม่มี Sub-Agenda สำหรับวาระเลือกตั้ง</p>
                )}
              </>
            )}

            {/* Agenda Open/Close Times */}
            <div className="mt-6 text-sm text-gray-600 space-y-1">
              <p>
                <span className="font-bold">สรุปผลการลงคะแนน:</span>&ensp;
                <span className={`font-bold text-base ${r.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                  {r.result}
                </span>
              </p>
              <p>
                <span>วาระการประชุมเปิดเมื่อเวลา</span>&ensp;
                <strong className="text-gray-800">
                  {data.agenda.openedAt ? fmtTime(data.agenda.openedAt) : '—'}
                </strong>&ensp;น.
              </p>
              <p>
                <span>วาระการประชุมปิดเมื่อเวลา</span>&ensp;
                <strong className="text-gray-800">
                  {data.agenda.closedAt ? fmtTime(data.agenda.closedAt) : '—'}
                </strong>&ensp;น.
              </p>
              <p>
                <span>ประเภทมติ:</span>&ensp;
                <span className="text-gray-800">{resolutionLabel(data.agenda.resolutionType)}</span>
              </p>
            </div>
          </>
        )}
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
