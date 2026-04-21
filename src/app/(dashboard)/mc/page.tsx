'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/lib/session-context';
import { useSSE } from '@/lib/use-sse';
import {
  Mic,
  Users,
  PieChart,
  Play,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  Square,
  Megaphone,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Maximize2,
  Bell,
  X,
  UserPlus,
  Loader2,
  Info,
  Save,
  Edit3,
} from 'lucide-react';

interface SubAgenda {
  id: string;
  orderNo: number;
  titleTh: string;
  title: string;
}

interface Agenda {
  id: string;
  orderNo: number;
  titleTh: string;
  title: string;
  resolutionType: string;
  status: string;
  mcScript?: string | null;
  subAgendas?: SubAgenda[];
}

interface Quorum {
  attendees: number;
  shares: string;
  totalShares: string;
  percentage: string;
  selfCount: number;
  selfShares: string;
  proxyCount: number;
  proxyShares: string;
}

interface VoteResults {
  approve: string; disapprove: string; abstain: string; voided: string;
  approvePercent: string; disapprovePercent: string;
  passed: boolean; result: string; thresholdLabel: string;
}

interface SubAgendaResult {
  orderNo: number; titleTh: string; title: string;
  approve: string; disapprove: string; abstain: string; voided: string;
  approvePercent: string; disapprovePercent: string;
  passed: boolean; result: string; thresholdLabel: string;
}

interface AgendaQuorum {
  additionalCount: number;
  additionalShares: string;
  attendeeCount: number;
  attendeeShares: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock; bg: string }> = {
  PENDING:   { label: 'รอดำเนินการ', color: 'text-amber-400',  icon: Clock,         bg: 'bg-amber-500/15 border-amber-500/25' },
  OPEN:      { label: 'กำลังโหวต',   color: 'text-emerald-400', icon: Play,          bg: 'bg-emerald-500/15 border-emerald-500/25' },
  CLOSED:    { label: 'ปิดโหวตแล้ว', color: 'text-blue-400',    icon: Square,        bg: 'bg-blue-500/15 border-blue-500/25' },
  ANNOUNCED: { label: 'ประกาศผลแล้ว', color: 'text-violet-400', icon: CheckCircle2,  bg: 'bg-violet-500/15 border-violet-500/25' },
};

const RESOLUTION_LABELS: Record<string, string> = {
  INFO: 'แจ้งเพื่อทราบ',
  MAJORITY: 'มติทั่วไป (>50%)',
  TWO_THIRDS: 'มติ 2 ใน 3 (≥66.66%)',
  SPECIAL: 'มติพิเศษ (≥75%)',
  ELECTION: 'เลือกตั้งกรรมการ',
};

export default function MCPage() {
  const { activeEvent } = useSession();
  const dp = activeEvent?.decimalPrecision ?? 4;
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [quorum, setQuorum] = useState<Quorum | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState('');
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null);
  const [subAgendaResults, setSubAgendaResults] = useState<SubAgendaResult[] | null>(null);
  const [agendaQuorum, setAgendaQuorum] = useState<AgendaQuorum | null>(null);

  // Script editing
  const [editingScript, setEditingScript] = useState(false);
  const [scriptDraft, setScriptDraft] = useState('');
  const [savingScript, setSavingScript] = useState(false);

  // Late arrival tracking
  const prevAttendees = useRef<number>(0);
  const prevShares = useRef<bigint>(BigInt(0));
  const [newArrivals, setNewArrivals] = useState(0);
  const [newShares, setNewShares] = useState<bigint>(BigInt(0));
  const [showArrivalAlert, setShowArrivalAlert] = useState(false);
  const initialized = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      const [regRes, agendaRes] = await Promise.all([
        fetch('/api/registrations?limit=1'),
        fetch('/api/agendas'),
      ]);
      if (regRes.ok) {
        const regData = await regRes.json();
        const q = regData.quorum as Quorum;
        setQuorum(q);

        // Late arrival detection
        if (initialized.current) {
          const diff = q.attendees - prevAttendees.current;
          const sharesDiff = BigInt(q.shares) - prevShares.current;
          if (diff > 0) {
            setNewArrivals(prev => prev + diff);
            setNewShares(prev => prev + sharesDiff);
            setShowArrivalAlert(true);
          }
        }
        prevAttendees.current = q.attendees;
        prevShares.current = BigInt(q.shares);
        initialized.current = true;
      }
      if (agendaRes.ok) {
        const data = await agendaRes.json();
        setAgendas(data.agendas || []);
      }
    } catch (err) {
      console.error('MC fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SSE real-time updates (falls back to polling every 5s)
  useSSE(fetchData, 5000);

  // Auto select current OPEN or first PENDING
  useEffect(() => {
    if (!selectedId && agendas.length > 0) {
      const openAgenda = agendas.find(a => a.status === 'OPEN');
      const pendingAgenda = agendas.find(a => a.status === 'PENDING' && a.resolutionType !== 'INFO');
      setSelectedId(openAgenda?.id || pendingAgenda?.id || agendas[0].id);
    }
  }, [agendas, selectedId]);

  // Fetch vote results + quorum for selected agenda
  useEffect(() => {
    if (!selectedId) { setVoteResults(null); setSubAgendaResults(null); setAgendaQuorum(null); return; }
    const agenda = agendas.find(a => a.id === selectedId);
    if (!agenda || agenda.resolutionType === 'INFO') {
      setVoteResults(null); setSubAgendaResults(null); setAgendaQuorum(null);
      return;
    }
    const fetchVotes = async () => {
      try {
        const res = await fetch(`/api/public/vote-results?agendaOrder=${agenda.orderNo}`);
        if (res.ok) {
          const data = await res.json();
          setAgendaQuorum(data.quorum);
          if (['CLOSED', 'ANNOUNCED'].includes(agenda.status)) {
            setVoteResults(data.results);
            setSubAgendaResults(data.subAgendaResults || null);
          } else {
            setVoteResults(null);
            setSubAgendaResults(null);
          }
        }
      } catch { /* ignore */ }
    };
    fetchVotes();
  }, [selectedId, agendas]);

  const selectedAgenda = agendas.find(a => a.id === selectedId);

  const handleStatusChange = async (agendaId: string, newStatus: string) => {
    setChanging(true);
    setError('');
    try {
      const res = await fetch(`/api/agendas/${agendaId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchData();
        setError('');
      } else {
        const data = await res.json();
        setError(data.error || 'ไม่สามารถเปลี่ยนสถานะได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setChanging(false);
    }
  };

  const dismissArrivalAlert = () => {
    setShowArrivalAlert(false);
    setNewArrivals(0);
    setNewShares(BigInt(0));
  };

  const getDefaultScript = (agenda: Agenda) => {
    switch (agenda.status) {
      case 'PENDING':
        return `ขอเชิญพิจารณาวาระที่ ${agenda.orderNo} เรื่อง ${agenda.titleTh} — เป็น${RESOLUTION_LABELS[agenda.resolutionType]} ขอเปิดให้ลงคะแนนเสียงครับ/ค่ะ`;
      case 'OPEN':
        return `ขณะนี้วาระที่ ${agenda.orderNo} กำลังเปิดรับลงคะแนนเสียง กรุณาสแกน QR Code บนบัตรลงคะแนนเพื่อลงคะแนน หากท่านไม่มีข้อคัดค้าน ถือว่าเห็นด้วย`;
      case 'CLOSED':
        return `ปิดการลงคะแนนวาระที่ ${agenda.orderNo} เรียบร้อยแล้ว ขอประกาศผลการลงคะแนนครับ/ค่ะ`;
      default:
        return '';
    }
  };

  const startEditScript = (agenda: Agenda) => {
    setScriptDraft(agenda.mcScript || getDefaultScript(agenda));
    setEditingScript(true);
  };

  const saveScript = async (agendaId: string) => {
    setSavingScript(true);
    try {
      const res = await fetch(`/api/agendas/${agendaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mcScript: scriptDraft }),
      });
      if (res.ok) {
        setEditingScript(false);
        await fetchData();
      } else {
        const data = await res.json();
        setError(data.error || 'ไม่สามารถบันทึก Script ได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาด');
    } finally {
      setSavingScript(false);
    }
  };

  const getNextAction = (agenda: Agenda) => {
    if (agenda.resolutionType === 'INFO') return null;
    switch (agenda.status) {
      case 'PENDING':   return { label: 'เปิดรับโหวต', status: 'OPEN',      color: 'from-emerald-500 to-green-500', shadow: 'shadow-emerald-500/25' };
      case 'OPEN':      return { label: 'ปิดโหวต',     status: 'CLOSED',    color: 'from-blue-500 to-indigo-500',   shadow: 'shadow-blue-500/25' };
      case 'CLOSED':    return { label: 'ประกาศผล',    status: 'ANNOUNCED', color: 'from-violet-500 to-purple-500', shadow: 'shadow-violet-500/25' };
      default: return null;
    }
  };

  const fmtShares = (n: string | bigint) => BigInt(n).toLocaleString('th-TH');
  const quorumPct = quorum ? parseFloat(quorum.percentage) : 0;

  const stats = {
    total: agendas.length,
    info: agendas.filter(a => a.resolutionType === 'INFO').length,
    pending: agendas.filter(a => a.status === 'PENDING' && a.resolutionType !== 'INFO').length,
    open: agendas.filter(a => a.status === 'OPEN').length,
    closed: agendas.filter(a => a.status === 'CLOSED').length,
    announced: agendas.filter(a => a.status === 'ANNOUNCED').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Mic className="w-5 h-5 text-white" />
            </div>
            หน้าจอพิธีกร
          </h1>
          <p className="text-sm text-text-secondary mt-1">{activeEvent?.companyName}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Late arrival badge */}
          {newArrivals > 0 && (
            <button
              onClick={() => setShowArrivalAlert(true)}
              className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-sm font-bold cursor-pointer animate-pulse-glow"
            >
              <Bell className="w-4 h-4" />
              ผู้เข้าร่วมใหม่
              <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold animate-bounce">
                {newArrivals}
              </span>
            </button>
          )}
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="p-2.5 rounded-xl bg-bg-tertiary hover:bg-bg-hover text-text-muted cursor-pointer transition-colors"
            title="เต็มจอ"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Quorum Bar */}
      {quorum && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> องค์ประชุม
            </p>
            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <span>{quorum.attendees} ราย</span>
              <span>{fmtShares(quorum.shares)} หุ้น</span>
              <span className={`font-bold text-sm ${quorumPct >= 33.33 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {quorum.percentage}%
              </span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                quorumPct >= 33.33
                  ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                  : 'bg-gradient-to-r from-amber-500 to-orange-400'
              }`}
              style={{ width: `${Math.min(quorumPct, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-text-muted">0%</p>
            <p className="text-[10px] text-text-muted">
              {quorumPct >= 33.33 ? '✅ ครบองค์ประชุม' : '⏳ ยังไม่ครบองค์ประชุม (ต้องการ ≥33.33%)'}
            </p>
            <p className="text-[10px] text-text-muted">100%</p>
          </div>

          {/* Breakdown: SELF vs PROXY */}
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-500/8">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] text-text-muted">มาด้วยตนเอง</p>
                <p className="text-sm font-bold text-text-primary">
                  {quorum.selfCount} <span className="text-[10px] font-normal text-text-muted">ราย</span>
                  <span className="text-text-muted mx-1">/</span>
                  {fmtShares(quorum.selfShares)} <span className="text-[10px] font-normal text-text-muted">หุ้น</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-violet-500/8">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-[10px] text-text-muted">รับมอบฉันทะ</p>
                <p className="text-sm font-bold text-text-primary">
                  {quorum.proxyCount} <span className="text-[10px] font-normal text-text-muted">ราย</span>
                  <span className="text-text-muted mx-1">/</span>
                  {fmtShares(quorum.proxyShares)} <span className="text-[10px] font-normal text-text-muted">หุ้น</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Late Arrival Alert Modal */}
      {showArrivalAlert && newArrivals > 0 && quorum && (
        <div className="glass-card p-5 border-2 border-amber-500/40 animate-fade-in">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary">🔔 แจ้งผู้เข้าร่วมใหม่ระหว่างวาระ</h3>
                <p className="text-xs text-text-secondary">มีผู้ลงทะเบียนเพิ่มเติมตั้งแต่ท่านรับทราบครั้งล่าสุด</p>
              </div>
            </div>
            <button onClick={dismissArrivalAlert} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-center">
              <p className="text-2xl font-bold text-amber-400">+{newArrivals}</p>
              <p className="text-[10px] text-text-muted">รายใหม่</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 text-center">
              <p className="text-2xl font-bold text-blue-400">+{fmtShares(newShares)}</p>
              <p className="text-[10px] text-text-muted">หุ้นเพิ่ม</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-center">
              <p className="text-2xl font-bold text-emerald-400">{quorum.percentage}%</p>
              <p className="text-[10px] text-text-muted">องค์ประชุมล่าสุด</p>
            </div>
          </div>

          {/* MC Script */}
          <div className="p-4 rounded-xl bg-bg-tertiary border border-border/50 mb-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-semibold">📜 Script สำหรับพิธีกร</p>
            <p className="text-sm text-text-primary leading-relaxed">
              &ldquo;ขอแจ้งให้ที่ประชุมทราบว่า มีผู้ถือหุ้นเข้าร่วมประชุมเพิ่มเติมจำนวน <strong className="text-amber-400">{newArrivals}</strong> ราย
              ถือหุ้นรวมเพิ่ม <strong className="text-blue-400">{fmtShares(newShares)}</strong> หุ้น
              ขณะนี้มีผู้เข้าร่วมประชุมทั้งสิ้น <strong className="text-text-primary">{quorum.attendees}</strong> ราย
              ถือหุ้นรวม <strong className="text-text-primary">{fmtShares(quorum.shares)}</strong> หุ้น
              คิดเป็นร้อยละ <strong className="text-emerald-400">{quorum.percentage}</strong>
              ของจำนวนหุ้นทั้งหมด&rdquo;
            </p>
          </div>

          <button
            onClick={dismissArrivalAlert}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold shadow-lg shadow-amber-500/25 cursor-pointer hover:shadow-xl transition-all"
          >
            ✅ รับทราบแล้ว
          </button>
        </div>
      )}

      {/* Progress Summary */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'แจ้งเพื่อทราบ', count: stats.info, color: 'text-gray-400', bg: 'bg-gray-500/10' },
          { label: 'รอดำเนินการ', count: stats.pending, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'กำลังโหวต', count: stats.open, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'ปิดโหวตแล้ว', count: stats.closed, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'ประกาศผลแล้ว', count: stats.announced, color: 'text-violet-400', bg: 'bg-violet-500/10' },
        ].map(s => (
          <div key={s.label} className={`p-3 rounded-xl ${s.bg} text-center`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-[10px] text-text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Main content: 2 column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Agenda Timeline */}
        <div className="lg:col-span-1 glass-card p-4 space-y-1 max-h-[500px] overflow-y-auto">
          <p className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" /> วาระทั้งหมด ({agendas.length})
          </p>
          {agendas.map((agenda) => {
            const cfg = STATUS_CONFIG[agenda.status] || STATUS_CONFIG.PENDING;
            const isInfo = agenda.resolutionType === 'INFO';
            const isSelected = agenda.id === selectedId;

            return (
              <button
                key={agenda.id}
                onClick={() => setSelectedId(agenda.id)}
                className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-primary/10 border-primary/30 shadow-sm'
                    : 'border-transparent hover:bg-bg-hover/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-text-muted'}`}>
                      {agenda.orderNo}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                        {agenda.titleTh}
                      </p>
                      <p className="text-[10px] text-text-muted">{RESOLUTION_LABELS[agenda.resolutionType]}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`badge border text-[10px] ${isInfo ? 'bg-gray-500/15 text-gray-400 border-gray-500/20' : cfg.bg}`}>
                      {isInfo ? 'ทราบ' : cfg.label}
                    </span>
                    {isSelected && <ChevronRight className="w-3.5 h-3.5 text-primary" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Current Agenda Detail */}
        <div className="lg:col-span-2">
          {selectedAgenda ? (
            <div className="glass-card p-6 space-y-5">
              {/* Agenda Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl font-black text-primary">วาระที่ {selectedAgenda.orderNo}</span>
                    <span className={`badge border ${
                      selectedAgenda.resolutionType === 'INFO'
                        ? 'bg-gray-500/15 text-gray-400 border-gray-500/20'
                        : (STATUS_CONFIG[selectedAgenda.status]?.bg || '')
                    }`}>
                      {selectedAgenda.resolutionType === 'INFO'
                        ? 'แจ้งเพื่อทราบ'
                        : STATUS_CONFIG[selectedAgenda.status]?.label}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-text-primary">{selectedAgenda.titleTh}</h2>
                  <p className="text-sm text-text-secondary mt-1">{selectedAgenda.title}</p>
                  <p className="text-xs text-text-muted mt-2">
                    ประเภทมติ: {RESOLUTION_LABELS[selectedAgenda.resolutionType]}
                  </p>
                </div>
              </div>

              {/* Per-agenda Quorum Info */}
              {agendaQuorum && selectedAgenda.resolutionType !== 'INFO' && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/15">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                        <UserPlus className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-text-muted uppercase tracking-wider">เข้าร่วมเพิ่มในวาระนี้</p>
                        <p className="text-sm font-bold text-text-primary">
                          {agendaQuorum.additionalCount} ราย / {fmtShares(agendaQuorum.additionalShares)} หุ้น
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] text-text-muted uppercase tracking-wider">ผู้ถือหุ้นเข้าร่วมทั้งสิ้น</p>
                        <p className="text-sm font-bold text-text-primary">
                          {agendaQuorum.attendeeCount} ราย / {fmtShares(agendaQuorum.attendeeShares)} หุ้น
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-agendas */}
              {selectedAgenda.subAgendas && selectedAgenda.subAgendas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-2">
                    วาระย่อย ({selectedAgenda.subAgendas.length} รายการ)
                    {selectedAgenda.status !== 'PENDING' && (
                      <span className={`badge text-[10px] ${(STATUS_CONFIG[selectedAgenda.status]?.bg || '')}`}>
                        {STATUS_CONFIG[selectedAgenda.status]?.label}
                      </span>
                    )}
                  </p>
                  {selectedAgenda.subAgendas.map(sub => (
                    <div key={sub.id} className="p-3 rounded-xl bg-bg-tertiary/50 border border-border/30">
                      <p className="text-sm text-text-primary">
                        <span className="text-text-muted mr-2">{selectedAgenda.orderNo}.{sub.orderNo}</span>
                        {sub.titleTh}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Per-candidate Election Results — show when CLOSED or ANNOUNCED */}
              {selectedAgenda.resolutionType === 'ELECTION' && ['CLOSED', 'ANNOUNCED'].includes(selectedAgenda.status) && subAgendaResults && subAgendaResults.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    ผลการลงคะแนนรายบุคคล
                  </p>
                  {subAgendaResults.map((sub) => {
                    const items = [
                      { label: 'เห็นด้วย', shares: sub.approve, color: 'text-emerald-400', barColor: 'bg-emerald-500' },
                      { label: 'ไม่เห็นด้วย', shares: sub.disapprove, color: 'text-red-400', barColor: 'bg-red-500' },
                      { label: 'งดออกเสียง', shares: sub.abstain, color: 'text-amber-400', barColor: 'bg-amber-500' },
                    ];
                    const totalShares = items.reduce((s, i) => s + Number(i.shares), 0);
                    const pct = (v: string) => totalShares > 0 ? ((Number(v) / totalShares) * 100).toFixed(dp) : (0).toFixed(dp);

                    return (
                      <div key={sub.orderNo} className="p-4 rounded-xl bg-gradient-to-br from-bg-tertiary/80 to-bg-tertiary/30 border border-border/50">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold text-text-primary">
                            <span className="text-text-muted mr-1">{selectedAgenda.orderNo}.{sub.orderNo}</span>
                            {sub.titleTh}
                          </p>
                          <span className={`badge border text-[10px] font-bold ${
                            sub.passed
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                              : 'bg-red-500/15 text-red-400 border-red-500/25'
                          }`}>
                            {sub.passed ? <><ThumbsUp className="w-3 h-3 mr-1" /> {sub.result}</> : <><ThumbsDown className="w-3 h-3 mr-1" /> {sub.result}</>}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {items.map(item => (
                            <div key={item.label}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className={`text-[11px] font-semibold ${item.color}`}>{item.label}</span>
                                <span className="text-[11px] text-text-primary font-bold">{fmtShares(item.shares)} ({pct(item.shares)}%)</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-bg-primary overflow-hidden">
                                <div className={`h-full rounded-full ${item.barColor} transition-all duration-500`} style={{ width: `${pct(item.shares)}%` }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Info agenda notice */}
              {selectedAgenda.resolutionType === 'INFO' && (
                <div className="p-4 rounded-xl bg-gray-500/10 border border-gray-500/20 flex items-center gap-3">
                  <Info className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <p className="text-sm text-text-secondary">วาระแจ้งเพื่อทราบ — ไม่มีการลงคะแนนเสียง</p>
                </div>
              )}

              {/* Vote Results — show when CLOSED or ANNOUNCED */}
              {['CLOSED', 'ANNOUNCED'].includes(selectedAgenda.status) && voteResults && (() => {
                const items = [
                  { label: 'เห็นด้วย', shares: voteResults.approve, color: 'text-emerald-400', barColor: 'bg-emerald-500' },
                  { label: 'ไม่เห็นด้วย', shares: voteResults.disapprove, color: 'text-red-400', barColor: 'bg-red-500' },
                  { label: 'งดออกเสียง', shares: voteResults.abstain, color: 'text-amber-400', barColor: 'bg-amber-500' },
                  { label: 'บัตรเสีย', shares: voteResults.voided, color: 'text-gray-400', barColor: 'bg-gray-500' },
                ];
                const totalShares = items.reduce((s, i) => s + Number(i.shares), 0);
                const pct = (v: string) => totalShares > 0 ? ((Number(v) / totalShares) * 100).toFixed(dp) : (0).toFixed(dp);

                return (
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-bg-tertiary/80 to-bg-tertiary/30 border border-border/50">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-bold text-text-primary flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary" />
                        ผลการลงคะแนนเสียง
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-text-muted">{voteResults.thresholdLabel}</span>
                        <span className={`badge border text-xs font-bold ${
                          voteResults.passed
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                            : 'bg-red-500/15 text-red-400 border-red-500/25'
                        }`}>
                          {voteResults.passed ? <><ThumbsUp className="w-3 h-3 mr-1" /> {voteResults.result}</> : <><ThumbsDown className="w-3 h-3 mr-1" /> {voteResults.result}</>}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {items.map(item => (
                        <div key={item.label}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-semibold ${item.color}`}>{item.label}</span>
                            <span className="text-xs text-text-primary font-bold">{fmtShares(item.shares)} หุ้น ({pct(item.shares)}%)</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-bg-primary overflow-hidden">
                            <div className={`h-full rounded-full ${item.barColor} transition-all duration-500`} style={{ width: `${pct(item.shares)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between text-xs text-text-muted">
                      <span>เห็นด้วย: {parseFloat(voteResults.approvePercent).toFixed(dp)}%</span>
                      <span>หุ้นรวม: {fmtShares(String(totalShares))} หุ้น</span>
                    </div>
                  </div>
                );
              })()}

              {/* Action Button */}
              {(() => {
                const action = getNextAction(selectedAgenda);
                if (!action) return null;
                return (
                  <button
                    onClick={() => handleStatusChange(selectedAgenda.id, action.status)}
                    disabled={changing}
                    className={`w-full py-4 rounded-2xl bg-gradient-to-r ${action.color} text-white text-lg font-bold shadow-lg ${action.shadow} cursor-pointer hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-3`}
                  >
                    {changing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : action.status === 'OPEN' ? (
                      <Play className="w-5 h-5" />
                    ) : action.status === 'CLOSED' ? (
                      <Square className="w-5 h-5" />
                    ) : (
                      <Megaphone className="w-5 h-5" />
                    )}
                    {changing ? 'กำลังดำเนินการ...' : action.label}
                  </button>
                );
              })()}

              {/* MC Script — editable */}
              {selectedAgenda.resolutionType !== 'INFO' && ['PENDING','OPEN','CLOSED'].includes(selectedAgenda.status) && (
                <div className="p-4 rounded-xl bg-bg-tertiary border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
                      📜 Script {selectedAgenda.mcScript ? '' : '(ค่าเริ่มต้น)'}
                    </p>
                    {!editingScript ? (
                      <button
                        onClick={() => startEditScript(selectedAgenda)}
                        className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/70 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" /> แก้ไข
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingScript(false)}
                          className="text-[10px] text-text-muted hover:text-text-secondary cursor-pointer"
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={() => saveScript(selectedAgenda.id)}
                          disabled={savingScript}
                          className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 cursor-pointer disabled:opacity-50"
                        >
                          {savingScript ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          บันทึก
                        </button>
                      </div>
                    )}
                  </div>
                  {editingScript ? (
                    <textarea
                      value={scriptDraft}
                      onChange={(e) => setScriptDraft(e.target.value)}
                      rows={4}
                      className="w-full bg-bg-primary border border-border rounded-xl px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-y"
                      placeholder="พิมพ์ Script สำหรับพิธีกร..."
                    />
                  ) : (
                    <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                      &ldquo;{selectedAgenda.mcScript || getDefaultScript(selectedAgenda)}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-12 text-center">
              <Mic className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-text-primary mb-2">เลือกวาระเพื่อดำเนินการ</h3>
              <p className="text-sm text-text-secondary">กดที่วาระทางซ้ายเพื่อเริ่มต้น</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
