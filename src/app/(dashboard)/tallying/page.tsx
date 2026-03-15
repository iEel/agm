'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/lib/session-context';
import { useSSE } from '@/lib/use-sse';
import {
  ScanLine,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ThumbsUp,
  ThumbsDown,
  MinusCircle,
  Ban,
  BarChart3,
  Camera,
  CameraOff,
  Keyboard,
} from 'lucide-react';

interface Agenda {
  id: string;
  orderNo: number;
  titleTh: string;
  resolutionType: string;
  status: string;
}

interface VoteSummary {
  approve: { count: number; shares: string };
  disapprove: { count: number; shares: string };
  abstain: { count: number; shares: string };
  void: { count: number; shares: string };
  totalVoted: number;
}

const VOTE_CHOICES = [
  { value: 'DISAPPROVE', label: 'ไม่เห็นด้วย', icon: ThumbsDown, color: 'bg-red-500 hover:bg-red-600' },
  { value: 'ABSTAIN', label: 'งดออกเสียง', icon: MinusCircle, color: 'bg-amber-500 hover:bg-amber-600' },
  { value: 'VOID', label: 'บัตรเสีย', icon: Ban, color: 'bg-gray-500 hover:bg-gray-600' },
];

export default function TallyingPage() {
  const { activeEvent } = useSession();
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [selectedAgenda, setSelectedAgenda] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [qrInput, setQrInput] = useState('');
  const [voteSummary, setVoteSummary] = useState<VoteSummary | null>(null);
  const [lastResult, setLastResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scanMode, setScanMode] = useState<'keyboard' | 'camera'>('keyboard');
  const [cameraActive, setCameraActive] = useState(false);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<unknown>(null);

  const fetchAgendas = useCallback(async () => {
    try {
      const res = await fetch('/api/agendas');
      if (!res.ok) return;
      const data = await res.json();
      setAgendas(data.agendas || []);
      const openAgenda = data.agendas?.find((a: Agenda) => a.status === 'OPEN');
      if (openAgenda) setSelectedAgenda(openAgenda.id);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const fetchVoteSummary = useCallback(async () => {
    if (!selectedAgenda) return;
    try {
      const res = await fetch(`/api/votes?agendaId=${selectedAgenda}`);
      if (!res.ok) return;
      const data = await res.json();
      setVoteSummary(data.summary);
    } catch { /* ignore */ }
  }, [selectedAgenda]);

  useEffect(() => { fetchAgendas(); }, [fetchAgendas]);
  useEffect(() => { fetchVoteSummary(); }, [fetchVoteSummary]);

  // SSE real-time updates (falls back to polling every 5s)
  useSSE(fetchVoteSummary, 5000);

  // FR7.4: Mobile Camera QR Scanner
  const startCamera = useCallback(async () => {
    if (!scannerRef.current) return;

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText: string) => {
          // QR scanned successfully
          setQrInput(decodedText);
          setCameraActive(false);
          scanner.stop().catch(() => {});
        },
        () => { /* ignore scan errors */ }
      );

      setCameraActive(true);
    } catch (err) {
      console.warn('Camera not available:', err);
      setLastResult({ type: 'error', text: 'ไม่สามารถเปิดกล้องได้ — กรุณาอนุญาตการเข้าถึงกล้อง' });
    }
  }, []);

  const stopCamera = useCallback(async () => {
    try {
      const scanner = html5QrCodeRef.current as { stop: () => Promise<void> };
      if (scanner) await scanner.stop();
    } catch { /* ignore */ }
    setCameraActive(false);
  }, []);

  // Auto-start camera when switching to camera mode
  useEffect(() => {
    if (scanMode === 'camera') {
      // Small delay to ensure the #qr-reader div is rendered in the DOM
      const timer = setTimeout(() => { startCamera(); }, 300);
      return () => clearTimeout(timer);
    } else {
      stopCamera();
    }
    // Cleanup on unmount
    return () => { stopCamera(); };
  }, [scanMode, startCamera, stopCamera]);

  const handleVoteByQR = async (voteChoice: string) => {
    if (!qrInput.trim() || !selectedAgenda) return;
    setLastResult(null);

    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData: qrInput.trim(), voteChoice }),
      });
      const data = await res.json();

      if (!res.ok) {
        setLastResult({ type: 'error', text: data.error });
      } else {
        setLastResult({ type: 'success', text: `ลงคะแนน "${VOTE_CHOICES.find(v => v.value === voteChoice)?.label}" สำเร็จ` });
        setQrInput('');
        fetchVoteSummary();
      }
    } catch {
      setLastResult({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    }
  };

  const formatShares = (s: string) => BigInt(s).toLocaleString('th-TH');

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">ไม่มีงานประชุมที่ Active</h2>
      </div>
    );
  }

  const currentAgenda = agendas.find((a) => a.id === selectedAgenda);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
            <ScanLine className="w-5 h-5 text-white" />
          </div>
          นับคะแนน
        </h1>
        <p className="text-sm text-text-secondary mt-1">{activeEvent.companyName}</p>
        <p className="text-xs text-text-muted mt-0.5">
          ระบบนับแบบหักลบ — เก็บบัตร ไม่เห็นด้วย / งดฯ / เสีย (ทิ้งบัตรเห็นด้วย)
        </p>
      </div>

      {/* Agenda Selector */}
      <div className="glass-card p-4">
        <label className="block text-sm font-semibold text-text-secondary mb-2">เลือกวาระ</label>
        <select
          value={selectedAgenda}
          onChange={(e) => setSelectedAgenda(e.target.value)}
          className="input-field text-base"
        >
          <option value="">-- เลือกวาระ --</option>
          {agendas.filter(a => a.resolutionType !== 'INFO').map((a) => (
            <option key={a.id} value={a.id}>
              วาระที่ {a.orderNo}: {a.titleTh} [{a.status}]
            </option>
          ))}
        </select>
        {currentAgenda && currentAgenda.status !== 'OPEN' && (
          <p className="mt-2 text-sm text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            วาระนี้สถานะ &quot;{currentAgenda.status}&quot; — ต้องเปลี่ยนเป็น &quot;OPEN&quot; ก่อนลงคะแนน
          </p>
        )}
      </div>

      {selectedAgenda && (
        <>
          {/* Scan Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => { setScanMode('keyboard'); stopCamera(); }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                scanMode === 'keyboard'
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-bg-tertiary text-text-secondary border border-border hover:border-primary/30'
              }`}
            >
              <Keyboard className="w-4 h-4" />
              <span className="hidden sm:inline">USB Scanner / </span>กรอก
            </button>
            <button
              onClick={() => { setScanMode('camera'); }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                scanMode === 'camera'
                  ? 'bg-primary/15 text-primary border border-primary/30'
                  : 'bg-bg-tertiary text-text-secondary border border-border hover:border-primary/30'
              }`}
            >
              <Camera className="w-4 h-4" />
              กล้องมือถือ
            </button>
          </div>

          {/* QR Input */}
          <div className="glass-card p-4">
            {scanMode === 'camera' ? (
              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  สแกน QR Code ด้วยกล้อง
                </label>
                <div id="qr-reader" ref={scannerRef} className="rounded-xl overflow-hidden mb-3" style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }} />
                {cameraActive && (
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-danger/15 text-danger border border-danger/30 mx-auto cursor-pointer"
                  >
                    <CameraOff className="w-4 h-4" />
                    ปิดกล้อง
                  </button>
                )}
                {qrInput && (
                  <p className="mt-3 text-sm text-text-secondary">
                    QR Data: <span className="font-mono text-primary">{qrInput}</span>
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  สแกน QR Code (USB Barcode Scanner / กรอกข้อมูล)
                </label>
                <input
                  type="text"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  placeholder="สแกนหรือกรอก QR data ที่นี่..."
                  className="input-field text-lg font-mono mb-3"
                  autoFocus
                />
              </div>
            )}

            {/* Vote Buttons — "นับแบบหักลบ" (เก็บบัตรเฉพาะ ไม่เห็นด้วย/งดฯ/เสีย) */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {VOTE_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  onClick={() => handleVoteByQR(choice.value)}
                  disabled={!qrInput.trim()}
                  className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 p-3 sm:p-4 rounded-xl text-white font-medium transition-all duration-200 disabled:opacity-30 cursor-pointer ${choice.color}`}
                >
                  <choice.icon className="w-5 h-5 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-sm">{choice.label}</span>
                </button>
              ))}
            </div>

            <p className="text-xs text-text-muted mt-2 text-center">
              💡 หากไม่สแกนบัตรใด ระบบจะ Default เป็น &quot;เห็นด้วย&quot; อัตโนมัติเมื่อปิดโหวต
            </p>

            {/* Result feedback */}
            {lastResult && (
              <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 text-sm animate-fade-in ${
                lastResult.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-danger/10 text-danger'
              }`}>
                {lastResult.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {lastResult.text}
              </div>
            )}
          </div>

          {/* Vote Summary */}
          {voteSummary && (
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-text-secondary flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" /> ผลคะแนน (ทั้งหมด {voteSummary.totalVoted} เสียง)
                </p>
                <p className="text-xs text-text-muted">อัปเดตอัตโนมัติทุก 5 วินาที</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-xs text-emerald-400 mb-1">เห็นด้วย</p>
                  <p className="text-2xl font-bold text-emerald-400">{voteSummary.approve.count}</p>
                  <p className="text-xs text-text-muted mt-1">{formatShares(voteSummary.approve.shares)} หุ้น</p>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                  <p className="text-xs text-red-400 mb-1">ไม่เห็นด้วย</p>
                  <p className="text-2xl font-bold text-red-400">{voteSummary.disapprove.count}</p>
                  <p className="text-xs text-text-muted mt-1">{formatShares(voteSummary.disapprove.shares)} หุ้น</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="text-xs text-amber-400 mb-1">งดออกเสียง</p>
                  <p className="text-2xl font-bold text-amber-400">{voteSummary.abstain.count}</p>
                  <p className="text-xs text-text-muted mt-1">{formatShares(voteSummary.abstain.shares)} หุ้น</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-500/10 border border-gray-500/20 text-center">
                  <p className="text-xs text-gray-400 mb-1">บัตรเสีย</p>
                  <p className="text-2xl font-bold text-gray-400">{voteSummary.void.count}</p>
                  <p className="text-xs text-text-muted mt-1">{formatShares(voteSummary.void.shares)} หุ้น</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
