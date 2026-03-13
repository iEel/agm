'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Ballot Print Page — /ballot-print?shareholderId=xxx
 * A4 Portrait: Registration Slip (1 page) + Ballot Cards (6/page, 2x3 grid)
 *            + Pre-vote Summary Slip (for Proxy B/C)
 */

interface BallotData {
  company: { name: string; nameTh: string; logoUrl: string | null };
  event: { name: string; type: string; date?: string; venue?: string | null };
  shareholder: {
    registrationNo: string;
    titleTh: string | null;
    firstNameTh: string;
    lastNameTh: string;
    titleEn: string | null;
    firstNameEn: string | null;
    lastNameEn: string | null;
    shares: string;
  };
  checkinAt: string;
  attendeeType: string;
  proxyType: string | null;
  proxyName: string | null;
  totalShares: string;
  consolidatedFrom: { name: string; shares: string }[] | null;
  ballots: {
    agendaOrderNo: number;
    subOrderNo: number | null;
    displayOrder: string;
    titleTh: string;
    title: string;
    parentTitleTh: string | null;
    parentTitle: string | null;
    resolutionType: string;
    qrData: string;
    refCode: string;
  }[];
  preVoteSummary: {
    agendaOrderNo: number;
    displayOrder: string;
    titleTh: string;
    title: string;
    voteChoice: string;
    shares: string;
  }[] | null;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += n) result.push(arr.slice(i, i + n));
  return result;
}

const voteLabel: Record<string, string> = {
  APPROVE: 'เห็นด้วย (Approve)',
  DISAPPROVE: 'ไม่เห็นด้วย (Disapprove)',
  ABSTAIN: 'งดออกเสียง (Abstain)',
};

export default function BallotPrintPage() {
  const [data, setData] = useState<BallotData | null>(null);
  const [error, setError] = useState('');
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const printTriggered = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareholderId = params.get('shareholderId');
    if (!shareholderId) { setError('ไม่ได้ระบุ shareholderId'); return; }

    fetch('/api/ballots/auto-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareholderId }),
    })
      .then(res => res.json())
      .then(d => { if (d.error) { setError(d.error); return; } setData(d); })
      .catch(() => setError('เกิดข้อผิดพลาด'));
  }, []);

  useEffect(() => {
    if (!data || data.ballots.length === 0) return;
    const loadQR = async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const imgs: Record<string, string> = {};
        for (const b of data.ballots) {
          imgs[b.qrData] = await QRCode.toDataURL(b.qrData, {
            width: 100, margin: 1, color: { dark: '#000000', light: '#ffffff' },
          });
        }
        setQrImages(imgs);
      } catch { /* fallback */ }
    };
    loadQR();
  }, [data]);

  useEffect(() => {
    if (!data) return;
    const qrReady = data.ballots.length === 0 || Object.keys(qrImages).length === data.ballots.length;
    if (qrReady && !printTriggered.current) {
      printTriggered.current = true;
      setTimeout(() => window.print(), 500);
    }
  }, [data, qrImages]);

  const fmt = (n: string | number) => BigInt(n).toLocaleString('th-TH');
  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtThaiDate = (d: string) => {
    const dt = new Date(d);
    const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const dayName = days[dt.getDay()];
    const day = dt.getDate();
    const month = months[dt.getMonth()];
    const year = dt.getFullYear() + 543;
    const time = dt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    return `วัน${dayName}ที่ ${day} ${month} ${year} เวลา ${time} น.`;
  };

  if (error) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}><p style={{ color: 'red', fontSize: 18 }}>❌ {error}</p></div>;
  if (!data) return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}><p>กำลังโหลดข้อมูลบัตรลงคะแนน...</p></div>;

  const shareholderFullName = `${data.shareholder.titleTh || ''}${data.shareholder.firstNameTh} ${data.shareholder.lastNameTh}`;
  const attendeeLabel = data.attendeeType === 'SELF'
    ? 'มาประชุมด้วยตนเอง'
    : `ผู้รับมอบฉันทะ แบบ ${data.proxyType || ''}: ${data.proxyName || ''}`;

  // Use consolidated shares for Proxy A, otherwise shareholder shares
  const displayShares = data.totalShares || data.shareholder.shares;

  const ballotPages = chunk(data.ballots, 6);
  const hasPreVote = data.preVoteSummary && data.preVoteSummary.length > 0;
  const totalPages = 1 + ballotPages.length + (hasPreVote ? 1 : 0);

  return (
    <>
      <style>{`
        @media screen {
          body { background: #e5e7eb; }
          .print-page { max-width: 210mm; margin: 12px auto; box-shadow: 0 2px 12px rgba(0,0,0,0.2); }
          .no-print-btn { position: fixed; bottom: 20px; right: 20px; z-index: 99; }
        }
        @media print {
          @page { size: A4 portrait; margin: 5mm 6mm; }
          .no-print-btn { display: none !important; }
          .print-page { page-break-after: always; }
          .print-page:last-child { page-break-after: auto; }
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'IBM Plex Sans Thai', 'Sarabun', Arial, sans-serif; }
        .print-page { background: white; width: 210mm; min-height: 297mm; padding: 5mm; color: #000; }

        /* ─── Registration Slip ─── */
        .reg-slip { border: 2px solid #333; border-radius: 4px; padding: 24px 32px; max-width: 180mm; margin: 20mm auto; }
        .reg-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 14px; }
        .reg-header .company { font-size: 14pt; font-weight: bold; }
        .reg-header .event { font-size: 11pt; color: #333; margin-top: 2px; }
        .reg-header h2 { font-size: 15pt; margin: 10px 0 2px; }
        .reg-header h3 { font-size: 11pt; font-weight: normal; color: #555; }
        .reg-info p { margin: 4px 0; font-size: 11pt; }
        .reg-divider { border-top: 1px dashed #999; margin: 14px 0; }
        .reg-consent { text-align: center; font-size: 10.5pt; line-height: 1.7; padding: 4px 16px; }
        .reg-sign { text-align: center; margin-top: 20px; }
        .reg-sign .sig-line { display: inline-block; width: 220px; border-bottom: 1px dotted #333; }

        /* ─── Ballot Grid ─── */
        .ballot-grid { display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(3, 1fr); gap: 3mm; height: calc(297mm - 10mm); }

        /* ─── Single Ballot Card ─── */
        .ballot-card { border: 1.5px solid #444; border-radius: 3px; padding: 3mm 3.5mm; display: flex; flex-direction: column; overflow: hidden; font-size: 7.5pt; line-height: 1.35; position: relative; }
        .bc-watermark {
          position: absolute; bottom: 14mm; right: 3mm;
          font-size: 72pt; font-weight: 900; color: rgba(0,0,0,0.06);
          pointer-events: none; z-index: 0; line-height: 1;
        }
        .bc-header { text-align: center; border-bottom: 1px solid #888; padding-bottom: 2mm; margin-bottom: 2mm; }
        .bc-header .bc-company { font-size: 7pt; font-weight: bold; }
        .bc-header .bc-title { font-size: 8.5pt; font-weight: bold; margin: 1px 0; }
        .bc-header .bc-subtitle { font-size: 6.5pt; color: #555; }
        .bc-body { flex: 1; display: flex; flex-direction: column; }
        .bc-qr-row { display: flex; gap: 2.5mm; align-items: flex-start; margin-bottom: 2mm; }
        .bc-qr-row img { width: 18mm; height: 18mm; }
        .bc-qr-placeholder { width: 18mm; height: 18mm; border: 1px solid #ccc; display: flex; align-items: center; justify-content: center; font-size: 6pt; color: #999; }
        .bc-ref { font-family: monospace; font-size: 5.5pt; color: #777; text-align: center; margin-top: 1px; }
        .bc-agenda-no { font-size: 12pt; font-weight: 900; margin: 0; }
        .bc-agenda-no-en { font-size: 7pt; color: #666; }
        .bc-agenda-title { font-size: 7pt; margin: 1mm 0; }
        .bc-divider { border-top: 1px dashed #bbb; margin: 1.5mm 0; }
        .bc-info p { margin: 0.5mm 0; font-size: 6.5pt; }
        .bc-checkboxes { margin: 1.5mm 0; }
        .bc-checkbox { display: flex; align-items: center; gap: 2mm; margin: 1mm 0; font-size: 7.5pt; }
        .bc-box { width: 4mm; height: 4mm; border: 1.5px solid #333; flex-shrink: 0; }
        .bc-note { font-size: 5.5pt; color: #666; margin-top: auto; padding-top: 1mm; border-top: 1px dashed #ccc; }
        .bc-note strong { color: #000; }
        .bc-sign { font-size: 6pt; text-align: center; margin-top: 1.5mm; }
        .bc-sign .bc-sig-line { display: inline-block; width: 30mm; border-bottom: 1px dotted #333; }

        /* ─── Pre-vote Summary Slip ─── */
        .pv-slip { border: 2px solid #333; border-radius: 4px; padding: 20px 28px; max-width: 190mm; margin: 12mm auto; }
        .pv-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 14px; }
        .pv-header .company { font-size: 13pt; font-weight: bold; }
        .pv-header h2 { font-size: 14pt; margin: 8px 0 2px; }
        .pv-header h3 { font-size: 10pt; font-weight: normal; color: #555; }
        .pv-info p { margin: 3px 0; font-size: 10.5pt; }
        .pv-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt; }
        .pv-table th, .pv-table td { border: 1px solid #555; padding: 6px 10px; text-align: left; }
        .pv-table th { background: #f0f0f0; font-weight: bold; font-size: 9pt; }
        .pv-table .vote-cell { font-weight: bold; text-align: center; }
        .pv-notice { font-size: 9.5pt; text-align: center; margin-top: 14px; padding: 10px; border: 1px solid #999; background: #fafafa; }
      `}</style>

      {/* ═══════════ Page 1: Registration Slip ═══════════ */}
      <div className="print-page">
        <div className="reg-slip">
          <div className="reg-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
              {data.company.logoUrl && (
                <img src={data.company.logoUrl} alt="logo" style={{ width: 'auto', height: '10mm', objectFit: 'contain' }} />
              )}
              <span className="company">{data.company.nameTh}</span>
            </div>
            <p className="event">{data.event.name}</p>
            {data.attendeeType === 'SELF' ? (
              <>
                <h2>ใบลงทะเบียน</h2>
                <h3>Registration Slip</h3>
              </>
            ) : (
              <>
                <h2>ใบลงทะเบียน - ผู้รับมอบฉันทะ</h2>
                <h3>Proxy Registration Slip</h3>
              </>
            )}
          </div>

          {data.attendeeType === 'SELF' ? (
            <div className="reg-info">
              <p><strong>ชื่อผู้ถือหุ้น :</strong> {shareholderFullName}</p>
              <p><strong>เลขทะเบียนผู้ถือหุ้น :</strong> {data.shareholder.registrationNo}</p>
              <p><strong>จำนวนหุ้นที่มีสิทธิออกเสียง :</strong> {fmt(displayShares)} หุ้น</p>
            </div>
          ) : (
            <div className="reg-info">
              <p><strong>ชื่อผู้รับมอบฉันทะ :</strong> {data.proxyName || '-'}</p>
              <p><strong>ประเภทหนังสือมอบฉันทะ :</strong> แบบ {data.proxyType || '-'}</p>
              <div className="reg-divider" />
              <p><strong>ผู้มอบฉันทะ (เจ้าของหุ้น) :</strong> {shareholderFullName}</p>
              <p><strong>เลขทะเบียนผู้ถือหุ้น :</strong> {data.shareholder.registrationNo}</p>
              <p><strong>จำนวนหุ้นที่มีสิทธิออกเสียง :</strong> {fmt(displayShares)} หุ้น</p>
              {data.consolidatedFrom && (
                <div style={{ margin: '8px 0', padding: '6px 12px', border: '1px solid #ccc', borderRadius: 4, fontSize: '9.5pt' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: 4 }}>📋 รวมหุ้นจาก {data.consolidatedFrom.length} ราย (มอบฉันทะ แบบ ก.):</p>
                  {data.consolidatedFrom.map((c, i) => (
                    <p key={i} style={{ margin: '2px 0 2px 12px' }}>- {c.name}: {fmt(c.shares)} หุ้น</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="reg-divider" />
          <div className="reg-consent">
            {data.attendeeType !== 'SELF' && data.proxyName && (
              <p style={{ marginBottom: '4px' }}><strong>มอบฉันทะให้</strong> {data.proxyName}</p>
            )}
            <p>ได้เข้าร่วมการประชุมสามัญผู้ถือหุ้นประจำปี {data.event.name}</p>
            {data.event.date && <p>{fmtThaiDate(data.event.date)}</p>}
            <p style={{ marginTop: '6px' }}>ข้าพเจ้ามาร่วมประชุมและรับบัตรลงคะแนนเสียงเรียบร้อยแล้ว</p>
            <p>และข้าพเจ้ารับทราบการประมวลผลข้อมูลส่วนบุคคลตามนโยบายความเป็นส่วนตัวของบริษัท</p>
          </div>
          <div className="reg-sign">
            <p>ลงชื่อ <span className="sig-line">&nbsp;</span></p>
            <p style={{ fontSize: '10pt', color: '#555', marginTop: 4 }}>
              ( {data.attendeeType === 'SELF' ? shareholderFullName : data.proxyName || '-'} )
            </p>
            <p style={{ fontSize: '9pt', color: '#888', marginTop: 2 }}>
              {data.attendeeType === 'SELF' ? 'ผู้ถือหุ้น' : 'ผู้รับมอบฉันทะ'}
            </p>
            <p style={{ fontSize: '10pt', marginTop: 8 }}>เวลาลงทะเบียน: {fmtTime(data.checkinAt)} น.</p>
          </div>
        </div>
      </div>

      {/* ═══════════ Pre-vote Summary Slip (Proxy B/C only) ═══════════ */}
      {hasPreVote && (
        <div className="print-page">
          <div className="pv-slip">
            <div className="pv-header">
              <p className="company">{data.company.nameTh}</p>
              <h2>ใบสรุปการลงคะแนนล่วงหน้า</h2>
              <h3>Pre-vote Summary Slip</h3>
            </div>
            <div className="pv-info">
              <p><strong>ผู้ถือหุ้น :</strong> {shareholderFullName}</p>
              <p><strong>เลขทะเบียน :</strong> {data.shareholder.registrationNo}</p>
              <p><strong>ประเภทมอบฉันทะ :</strong> แบบ {data.proxyType} | ผู้รับมอบ: {data.proxyName}</p>
            </div>
            <div className="reg-divider" />
            <table className="pv-table">
              <thead>
                <tr>
                  <th style={{ width: '12%', textAlign: 'center' }}>วาระที่</th>
                  <th>เรื่อง</th>
                  <th style={{ width: '22%', textAlign: 'center' }}>ผลโหวตล่วงหน้า</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>จำนวนเสียง</th>
                </tr>
              </thead>
              <tbody>
                {data.preVoteSummary!.map((pv, idx) => (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{pv.displayOrder}</td>
                    <td style={{ fontSize: '9pt' }}>{pv.titleTh}</td>
                    <td className="vote-cell">{voteLabel[pv.voteChoice] || pv.voteChoice}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(pv.shares)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pv-notice">
              <strong>📌 วาระข้างต้นได้ถูกบันทึกผลคะแนนล่วงหน้าเรียบร้อยแล้ว</strong><br />
              ท่านไม่ต้องส่งบัตรลงคะแนนสำหรับวาระเหล่านี้
            </div>
            {data.ballots.length > 0 && (
              <p style={{ fontSize: '9pt', color: '#555', textAlign: 'center', marginTop: 10 }}>
                ⚠️ ยังมี <strong>{data.ballots.length} วาระ</strong> ที่ยังไม่ได้ระบุผลโหวต — ท่านจะได้รับบัตร QR แยกเพื่อโหวตเอง
              </p>
            )}
            <div className="reg-sign" style={{ marginTop: 16 }}>
              <p>ลงชื่อ <span className="sig-line">&nbsp;</span></p>
              <p style={{ fontSize: '10pt', color: '#555', marginTop: 4 }}>( {shareholderFullName} )</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Ballot Cards: 6 per page ═══════════ */}
      {ballotPages.map((pageBallots, pageIdx) => (
        <div key={pageIdx} className="print-page">
          <div className="ballot-grid">
            {pageBallots.map((ballot, idx) => (
              <div key={idx} className="ballot-card">
                {/* Watermark — agenda number */}
                <div className="bc-watermark">{ballot.displayOrder}</div>
                <div className="bc-header">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2mm' }}>
                    {data.company.logoUrl && (
                      <img src={data.company.logoUrl} alt="logo" style={{ width: 'auto', height: '6mm', objectFit: 'contain', flexShrink: 0 }} />
                    )}
                    <span className="bc-company">{data.company.nameTh}</span>
                  </div>
                  {data.attendeeType === 'SELF' ? (
                    <>
                      <p className="bc-title">บัตรลงคะแนนเสียง</p>
                      <p className="bc-subtitle">Voting Ballot</p>
                    </>
                  ) : (
                    <>
                      <p className="bc-title">บัตรลงคะแนนเสียง - ผู้รับมอบฉันทะ</p>
                      <p className="bc-subtitle">Proxy Voting Ballot</p>
                    </>
                  )}
                </div>
                <div className="bc-body">
                  <div className="bc-qr-row">
                    <div>
                      {qrImages[ballot.qrData] ? (
                        <img src={qrImages[ballot.qrData]} alt="QR" />
                      ) : (
                        <div className="bc-qr-placeholder">QR</div>
                      )}
                      <p className="bc-ref">{ballot.refCode}</p>
                    </div>
                    <div>
                      <p className="bc-agenda-no">วาระที่ {ballot.displayOrder}</p>
                      <p className="bc-agenda-no-en">Agenda {ballot.displayOrder}</p>
                      <div className="bc-agenda-title">
                        {ballot.parentTitleTh ? (
                          <><p>{ballot.parentTitleTh}</p><p style={{ fontWeight: 'bold' }}>({ballot.titleTh})</p></>
                        ) : (
                          <p>{ballot.titleTh}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bc-divider" />
                  {/* Voter Details — differs by attendee type */}
                  {data.attendeeType === 'SELF' ? (
                    <div className="bc-info">
                      <p><strong>ชื่อผู้ถือหุ้น:</strong> {shareholderFullName}</p>
                      <p><strong>เลขทะเบียน:</strong> {data.shareholder.registrationNo} | <strong>จำนวนหุ้น:</strong> {fmt(displayShares)} หุ้น</p>
                    </div>
                  ) : (
                    <div className="bc-info">
                      <p><strong>ชื่อผู้รับมอบ:</strong> {data.proxyName || '-'}</p>
                      <div className="bc-divider" />
                      <p><strong>รับมอบจาก:</strong> {shareholderFullName}</p>
                      <p><strong>เลขทะเบียน:</strong> {data.shareholder.registrationNo} | <strong>จำนวนหุ้น:</strong> {fmt(displayShares)} หุ้น</p>
                    </div>
                  )}
                  <div className="bc-divider" />
                  <div className="bc-checkboxes">
                    <div className="bc-checkbox"><span className="bc-box" /><span>เห็นด้วย (Approve)</span></div>
                    <div className="bc-checkbox"><span className="bc-box" /><span>ไม่เห็นด้วย (Disapprove)</span></div>
                    <div className="bc-checkbox"><span className="bc-box" /><span>งดออกเสียง (Abstain)</span></div>
                  </div>
                  <div className="bc-note">
                    <p><strong>*เห็นด้วย ไม่ต้องส่งบัตร</strong> (If approve, no need to submit)</p>
                  </div>
                  <div className="bc-sign">
                    ลงชื่อ <span className="bc-sig-line">&nbsp;</span> {data.attendeeType === 'SELF' ? 'ผู้ถือหุ้น' : 'ผู้รับมอบฉันทะ'}
                  </div>
                </div>
              </div>
            ))}
            {pageBallots.length < 6 && Array.from({ length: 6 - pageBallots.length }).map((_, i) => (
              <div key={`empty-${i}`} style={{ border: '1px dashed #ddd', borderRadius: 3, opacity: 0.15 }} />
            ))}
          </div>
        </div>
      ))}

      {/* No ballots message for Proxy B/C with all pre-voted */}
      {data.ballots.length === 0 && !hasPreVote && (
        <div className="print-page">
          <div style={{ textAlign: 'center', paddingTop: '80mm', fontSize: '14pt' }}>
            <p>ไม่มีวาระที่ต้องพิมพ์บัตรลงคะแนน</p>
            <p style={{ fontSize: '11pt', color: '#666', marginTop: 8 }}>
              (วาระทั้งหมดอาจปิดแล้ว หรือผู้ถือหุ้นถูกตัดสิทธิ)
            </p>
          </div>
        </div>
      )}

      <div className="no-print-btn">
        <button
          onClick={() => window.print()}
          style={{
            padding: '14px 28px', fontSize: '14pt', fontWeight: 'bold',
            background: '#10b981', color: 'white', border: 'none',
            borderRadius: 12, cursor: 'pointer', boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
          }}
        >
          🖨️ พิมพ์ทั้งหมด ({totalPages} แผ่น)
        </button>
      </div>
    </>
  );
}
