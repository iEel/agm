'use client';

import { useEffect, useState, useRef } from 'react';

/**
 * Ballot Print Page — /ballot-print?shareholderId=xxx
 * Print-optimized page for registration slip + per-agenda ballot cards.
 * Opens in new tab from registration page after check-in.
 */

interface BallotData {
  company: { name: string; nameTh: string; logoUrl: string | null };
  event: { name: string; type: string };
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
  proxyName: string | null;
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
}

export default function BallotPrintPage() {
  const [data, setData] = useState<BallotData | null>(null);
  const [error, setError] = useState('');
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const printTriggered = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareholderId = params.get('shareholderId');
    if (!shareholderId) {
      setError('ไม่ได้ระบุ shareholderId');
      return;
    }

    fetch('/api/ballots/auto-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareholderId }),
    })
      .then(res => res.json())
      .then(d => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError('เกิดข้อผิดพลาด'));
  }, []);

  // Generate QR code images dynamically
  useEffect(() => {
    if (!data) return;
    const loadQR = async () => {
      try {
        const QRCode = (await import('qrcode')).default;
        const imgs: Record<string, string> = {};
        for (const b of data.ballots) {
          imgs[b.qrData] = await QRCode.toDataURL(b.qrData, {
            width: 120,
            margin: 1,
            color: { dark: '#000000', light: '#ffffff' },
          });
        }
        setQrImages(imgs);
      } catch {
        // QR generation failed — print without QR images
      }
    };
    loadQR();
  }, [data]);

  // Auto-print when QR images are ready
  useEffect(() => {
    if (data && Object.keys(qrImages).length === data.ballots.length && !printTriggered.current) {
      printTriggered.current = true;
      setTimeout(() => window.print(), 500);
    }
  }, [data, qrImages]);

  const fmt = (n: string | number) => BigInt(n).toLocaleString('th-TH');
  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const shareholderFullName = data
    ? `${data.shareholder.titleTh || ''}${data.shareholder.firstNameTh} ${data.shareholder.lastNameTh}`
    : '';

  const attendeeLabel = data?.attendeeType === 'SELF'
    ? 'มาประชุมด้วยตนเอง'
    : `ผู้รับมอบฉันทะ: ${data?.proxyName || ''}`;

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <p style={{ color: 'red', fontSize: 18 }}>❌ {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
        <p>กำลังโหลดข้อมูลบัตรลงคะแนน...</p>
      </div>
    );
  }

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media screen {
          body { background: #f5f5f5; }
          .ballot-page { max-width: 210mm; margin: 10px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
          .no-print-btn { position: fixed; bottom: 20px; right: 20px; z-index: 99; }
        }
        @media print {
          @page { size: A4; margin: 10mm 15mm; }
          .no-print-btn { display: none !important; }
          .ballot-page { page-break-after: always; }
          .ballot-page:last-child { page-break-after: auto; }
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: 'IBM Plex Sans Thai', 'Sarabun', sans-serif; }
        .ballot-page {
          background: white;
          padding: 20mm 18mm;
          min-height: auto;
          color: #000;
          font-size: 11pt;
          line-height: 1.6;
        }
        .ballot-border {
          border: 2px solid #333;
          padding: 16px 20px;
          border-radius: 4px;
        }
        .ballot-header {
          text-align: center;
          border-bottom: 2px solid #333;
          padding-bottom: 12px;
          margin-bottom: 14px;
        }
        .ballot-header h2 { margin: 4px 0; font-size: 14pt; }
        .ballot-header h3 { margin: 2px 0; font-size: 11pt; font-weight: normal; }
        .ballot-header .company { font-size: 13pt; font-weight: bold; }
        .ballot-header .event { font-size: 11pt; color: #333; }
        .ballot-section { margin: 10px 0; }
        .ballot-section p { margin: 3px 0; }
        .ballot-divider { border-top: 1px dashed #999; margin: 12px 0; }
        .ballot-checkbox-group { margin: 10px 0 10px 10px; }
        .ballot-checkbox {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 8px 0;
          font-size: 12pt;
        }
        .ballot-box {
          width: 22px;
          height: 22px;
          border: 2px solid #333;
          display: inline-block;
          flex-shrink: 0;
        }
        .ballot-note {
          font-size: 9pt;
          color: #555;
          margin-top: 12px;
        }
        .ballot-note strong { color: #000; }
        .ballot-signature {
          margin-top: 20px;
          text-align: center;
        }
        .signature-line {
          display: inline-block;
          width: 250px;
          border-bottom: 1px dotted #333;
          margin-bottom: 4px;
        }
        .qr-section {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        .qr-section .qr-img { flex-shrink: 0; }
        .qr-section .qr-info { flex: 1; }
        .ref-code { font-family: monospace; font-size: 9pt; color: #666; }
      `}</style>

      {/* ═══════════ Page 1: Registration Slip ═══════════ */}
      <div className="ballot-page">
        <div className="ballot-border">
          <div className="ballot-header">
            <p className="company">{data.company.nameTh}</p>
            <p className="event">{data.event.name}</p>
            <div style={{ margin: '10px 0' }}>
              <h2>ใบลงทะเบียน</h2>
              <h3>Registration Slip</h3>
            </div>
          </div>

          <div className="ballot-section">
            <p><strong>ชื่อ-สกุล :</strong> {shareholderFullName} ({attendeeLabel})</p>
            <p><strong>เลขทะเบียนผู้ถือหุ้น :</strong> {data.shareholder.registrationNo}</p>
            <p><strong>จำนวนหุ้นที่มีสิทธิออกเสียง :</strong> {fmt(data.shareholder.shares)} หุ้น</p>
          </div>

          <div className="ballot-divider" />

          <div className="ballot-section" style={{ textAlign: 'center', padding: '8px 20px' }}>
            <p>ข้าพเจ้ามาร่วมประชุมและรับบัตรลงคะแนนเสียงเรียบร้อยแล้ว</p>
            <p>และข้าพเจ้ารับทราบการประมวลผลข้อมูลส่วนบุคคล</p>
            <p>ตามนโยบายความเป็นส่วนตัวของบริษัท</p>
          </div>

          <div className="ballot-signature">
            <p>ลงชื่อ <span className="signature-line">&nbsp;</span></p>
            <p style={{ fontSize: '10pt', color: '#555' }}>( {shareholderFullName} )</p>
            <p style={{ fontSize: '10pt', marginTop: 8 }}>
              เวลาลงทะเบียน: {fmtTime(data.checkinAt)} น.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════ Per-Agenda Ballot Cards ═══════════ */}
      {data.ballots.map((ballot, idx) => (
        <div key={idx} className="ballot-page">
          <div className="ballot-border">
            {/* Header */}
            <div className="ballot-header">
              <p className="company">{data.company.nameTh}</p>
              <div style={{ margin: '8px 0' }}>
                <h2>บัตรลงคะแนนเสียง</h2>
                <h3>Voting Ballot</h3>
              </div>
            </div>

            {/* QR + Agenda Info */}
            <div className="qr-section">
              <div className="qr-img">
                {qrImages[ballot.qrData] ? (
                  <img
                    src={qrImages[ballot.qrData]}
                    alt="QR Code"
                    style={{ width: 100, height: 100 }}
                  />
                ) : (
                  <div style={{ width: 100, height: 100, border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9pt', color: '#999' }}>
                    QR Code
                  </div>
                )}
                <p className="ref-code" style={{ textAlign: 'center', marginTop: 4 }}>({ballot.refCode})</p>
              </div>
              <div className="qr-info">
                <p style={{ fontSize: '14pt', fontWeight: 'bold', margin: '0 0 2px 0' }}>
                  วาระที่ : {ballot.displayOrder}
                </p>
                <p style={{ fontSize: '11pt', color: '#555', margin: '0 0 8px 0' }}>
                  Agenda : {ballot.displayOrder}
                </p>
              </div>
            </div>

            {/* Agenda Title */}
            <div className="ballot-section">
              {ballot.parentTitleTh && (
                <p style={{ fontSize: '10pt', color: '#555' }}>
                  <strong>เรื่อง:</strong> {ballot.parentTitleTh}
                </p>
              )}
              <p>
                <strong>{ballot.parentTitleTh ? '' : 'เรื่อง: '}</strong>
                {ballot.parentTitleTh && <span style={{ marginLeft: 24 }}>({ballot.titleTh})</span>}
                {!ballot.parentTitleTh && ballot.titleTh}
              </p>
              {ballot.parentTitle && (
                <p style={{ fontSize: '10pt', color: '#555' }}>
                  <strong>Subject:</strong> {ballot.parentTitle}
                </p>
              )}
              {!ballot.parentTitle && (
                <p style={{ fontSize: '10pt', color: '#555' }}>
                  <strong>Subject:</strong> {ballot.title}
                </p>
              )}
              {ballot.parentTitle && (
                <p style={{ fontSize: '10pt', color: '#555', marginLeft: 24 }}>
                  ({ballot.title})
                </p>
              )}
            </div>

            <div className="ballot-divider" />

            {/* Shareholder Info */}
            <div className="ballot-section">
              <p><strong>ชื่อผู้ถือหุ้น :</strong> {shareholderFullName}</p>
              <p><strong>เลขทะเบียน :</strong> {data.shareholder.registrationNo}</p>
              <p><strong>จำนวนเสียง (หุ้น) :</strong> {fmt(data.shareholder.shares)} เสียง</p>
            </div>

            <div className="ballot-divider" />

            {/* Voting Checkboxes */}
            <p style={{ fontSize: '10pt', marginBottom: 4 }}>
              กรุณาทำเครื่องหมาย (X) ลงในช่องว่างเพียงช่องเดียว
            </p>
            <p style={{ fontSize: '9pt', color: '#555', marginBottom: 8 }}>
              Please mark (X) in only one box.
            </p>

            <div className="ballot-checkbox-group">
              <div className="ballot-checkbox">
                <span className="ballot-box" />
                <span>เห็นด้วย (Approve)</span>
              </div>
              <div className="ballot-checkbox">
                <span className="ballot-box" />
                <span>ไม่เห็นด้วย (Disapprove)</span>
              </div>
              <div className="ballot-checkbox">
                <span className="ballot-box" />
                <span>งดออกเสียง (Abstain)</span>
              </div>
            </div>

            <div className="ballot-divider" />

            {/* Note */}
            <p className="ballot-note">
              <strong>*หมายเหตุ: กรณีเห็นด้วย ไม่ต้องส่งบัตรลงคะแนนให้เจ้าหน้าที่</strong>
              <br />
              (If you approve, no need to submit this ballot.)
            </p>

            {/* Signature */}
            <div className="ballot-signature">
              <p>ลงชื่อ <span className="signature-line">&nbsp;</span> ผู้โหวต</p>
              <p style={{ fontSize: '10pt', color: '#555' }}>
                ( {shareholderFullName} )
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Print Button (screen only) */}
      <div className="no-print-btn">
        <button
          onClick={() => window.print()}
          style={{
            padding: '14px 28px',
            fontSize: '14pt',
            fontWeight: 'bold',
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: 12,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
          }}
        >
          🖨️ พิมพ์ทั้งหมด ({(data?.ballots.length || 0) + 1} แผ่น)
        </button>
      </div>
    </>
  );
}
