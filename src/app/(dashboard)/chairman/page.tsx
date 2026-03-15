'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/lib/session-context';
import {
  Monitor,
  Users,
  BarChart3,
  Percent,
  AlertCircle,
  Activity,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Ban,
  Maximize2,
  Layers,
  ThumbsUp,
  ThumbsDown,
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
  subAgendas?: SubAgenda[];
}

interface Quorum {
  attendees: number;
  shares: string;
  totalShares: string;
  percentage: string;
}

interface VoteSummary {
  approve: { count: number; shares: string };
  disapprove: { count: number; shares: string };
  abstain: { count: number; shares: string };
  void: { count: number; shares: string };
  totalVoted: number;
}

interface SubAgendaResult {
  orderNo: number; titleTh: string; title: string;
  approve: string; disapprove: string; abstain: string; voided: string;
  approvePercent: string; disapprovePercent: string;
  passed: boolean; result: string; thresholdLabel: string;
}

export default function ChairmanPage() {
  const { activeEvent } = useSession();
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [quorum, setQuorum] = useState<Quorum | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgenda, setSelectedAgenda] = useState<string>('');
  const [voteSummary, setVoteSummary] = useState<VoteSummary | null>(null);
  const [subAgendaResults, setSubAgendaResults] = useState<SubAgendaResult[] | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [regRes, agendaRes] = await Promise.all([
        fetch('/api/registrations?limit=1'),
        fetch('/api/agendas'),
      ]);
      if (regRes.ok) {
        const regData = await regRes.json();
        setQuorum(regData.quorum);
      }
      if (agendaRes.ok) {
        const agendaData = await agendaRes.json();
        setAgendas(agendaData.agendas || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const fetchVotes = useCallback(async () => {
    if (!selectedAgenda) { setVoteSummary(null); setSubAgendaResults(null); return; }
    const agenda = agendas.find(a => a.id === selectedAgenda);
    try {
      const res = await fetch(`/api/votes?agendaId=${selectedAgenda}`);
      if (!res.ok) return;
      const data = await res.json();
      setVoteSummary(data.summary);

      // For election agendas, also fetch per-candidate results
      if (agenda?.resolutionType === 'ELECTION') {
        try {
          const subRes = await fetch(`/api/public/vote-results?agendaOrder=${agenda.orderNo}`);
          if (subRes.ok) {
            const subData = await subRes.json();
            setSubAgendaResults(subData.subAgendaResults || null);
          }
        } catch { /* ignore */ }
      } else {
        setSubAgendaResults(null);
      }
    } catch { /* ignore */ }
  }, [selectedAgenda, agendas]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchVotes(); }, [fetchVotes]);

  // Auto-refresh every 5s
  useEffect(() => {
    const interval = setInterval(() => { fetchData(); fetchVotes(); }, 5000);
    return () => clearInterval(interval);
  }, [fetchData, fetchVotes]);

  const formatShares = (s: string) => BigInt(s).toLocaleString('th-TH');

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-lg font-semibold text-text-primary">ไม่มีงานประชุมที่ Active</h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse-glow w-16 h-16 rounded-2xl bg-bg-tertiary" />
      </div>
    );
  }

  const currentAgenda = agendas.find((a) => a.id === selectedAgenda);

  // Calculate vote percentages
  const getTotalVoteShares = () => {
    if (!voteSummary) return BigInt(0);
    return BigInt(voteSummary.approve.shares) +
      BigInt(voteSummary.disapprove.shares) +
      BigInt(voteSummary.abstain.shares) +
      BigInt(voteSummary.void.shares);
  };

  const getPercentage = (shares: string) => {
    const total = getTotalVoteShares();
    if (total === BigInt(0)) return '0';
    return ((Number(BigInt(shares)) / Number(total)) * 100).toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Monitor className="w-5 h-5 text-white" />
            </div>
            หน้าจอประธาน
          </h1>
          <p className="text-sm text-text-secondary mt-1">{activeEvent.companyName}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href="/quorum-display"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            จอองค์ประชุม
          </a>
          <a
            href="/vote-results"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium hover:bg-indigo-500/20 transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            จอผลลงคะแนน
          </a>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">LIVE</span>
          </div>
        </div>
      </div>

      {/* Large Quorum Display */}
      {quorum && (
        <div className="glass-card p-6">
          <div className="text-center mb-4">
            <p className="text-sm font-semibold text-text-secondary uppercase tracking-wider">องค์ประชุม</p>
          </div>
          <div className="flex items-center justify-center gap-12 flex-wrap">
            <div className="text-center">
              <p className="text-5xl font-bold text-text-primary">{quorum.attendees}</p>
              <p className="text-sm text-text-muted mt-1 flex items-center justify-center gap-1">
                <Users className="w-4 h-4" /> ผู้เข้าร่วม
              </p>
            </div>
            <div className="w-px h-16 bg-border hidden sm:block" />
            <div className="text-center">
              <p className="text-5xl font-bold text-text-primary">{formatShares(quorum.shares)}</p>
              <p className="text-sm text-text-muted mt-1 flex items-center justify-center gap-1">
                <BarChart3 className="w-4 h-4" /> หุ้น (จาก {formatShares(quorum.totalShares)})
              </p>
            </div>
            <div className="w-px h-16 bg-border hidden sm:block" />
            <div className="text-center">
              <p className={`text-5xl font-bold ${
                parseFloat(quorum.percentage) >= 50 ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {quorum.percentage}%
              </p>
              <p className="text-sm text-text-muted mt-1 flex items-center justify-center gap-1">
                <Percent className="w-4 h-4" /> 
                {parseFloat(quorum.percentage) >= 50 ? '✓ ครบองค์ประชุม' : '⚠ ไม่ครบ'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Agenda Selector */}
      <div className="glass-card p-4">
        <label className="block text-sm font-semibold text-text-secondary mb-2">เลือกวาระดูผลคะแนน</label>
        <select
          value={selectedAgenda}
          onChange={(e) => setSelectedAgenda(e.target.value)}
          className="input-field text-base"
        >
          <option value="">-- เลือกวาระ --</option>
          {agendas.map((a) => (
            a.resolutionType === 'ELECTION' && a.subAgendas && a.subAgendas.length > 0 ? (
              // Election agenda: show sub-agendas as separate options
              a.subAgendas.map((sub) => (
                <option key={`${a.id}-${sub.id}`} value={a.id}>
                  วาระที่ {a.orderNo}.{sub.orderNo}: {a.titleTh} : {sub.titleTh} [{a.status}]
                </option>
              ))
            ) : (
              <option key={a.id} value={a.id}>
                วาระที่ {a.orderNo}: {a.titleTh} [{a.status}]
              </option>
            )
          ))}
        </select>
      </div>

      {/* Vote Results */}
      {selectedAgenda && voteSummary && (
        <div className="glass-card p-6">
          <div className="text-center mb-6">
            <p className="text-lg font-bold text-text-primary">
              วาระที่ {currentAgenda?.orderNo}: {currentAgenda?.titleTh}
            </p>
            <p className="text-sm text-text-muted mt-1">ลงคะแนนทั้งหมด {voteSummary.totalVoted} เสียง</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: 'approve', label: 'เห็นด้วย', icon: CheckCircle2, color: 'emerald', data: voteSummary.approve },
              { key: 'disapprove', label: 'ไม่เห็นด้วย', icon: XCircle, color: 'red', data: voteSummary.disapprove },
              { key: 'abstain', label: 'งดออกเสียง', icon: MinusCircle, color: 'amber', data: voteSummary.abstain },
              { key: 'void', label: 'บัตรเสีย', icon: Ban, color: 'gray', data: voteSummary.void },
            ].map(({ key, label, icon: Icon, color, data }) => (
              <div key={key} className={`p-6 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 text-center`}>
                <Icon className={`w-8 h-8 text-${color}-400 mx-auto mb-2`} />
                <p className={`text-3xl font-bold text-${color}-400`}>{data.count}</p>
                <p className="text-xs text-text-muted mt-1">{formatShares(data.shares)} หุ้น</p>
                <p className={`text-lg font-semibold text-${color}-400 mt-1`}>{getPercentage(data.shares)}%</p>
                <p className="text-xs text-text-secondary">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-candidate Election Results */}
      {currentAgenda?.resolutionType === 'ELECTION' && subAgendaResults && subAgendaResults.length > 0 && (
        <div className="glass-card p-6">
          <p className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            ผลการลงคะแนนรายบุคคล
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {subAgendaResults.map((sub) => {
              const items = [
                { label: 'เห็นด้วย', shares: sub.approve, color: 'text-emerald-400', barColor: 'bg-emerald-500' },
                { label: 'ไม่เห็นด้วย', shares: sub.disapprove, color: 'text-red-400', barColor: 'bg-red-500' },
                { label: 'งดออกเสียง', shares: sub.abstain, color: 'text-amber-400', barColor: 'bg-amber-500' },
              ];
              const totalShares = items.reduce((s, i) => s + Number(i.shares), 0);
              const pct = (v: string) => totalShares > 0 ? ((Number(v) / totalShares) * 100).toFixed(1) : '0.0';

              return (
                <div key={sub.orderNo} className="p-5 rounded-2xl bg-bg-tertiary/50 border border-border/30">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-text-primary">
                      <span className="text-text-muted mr-1.5">{currentAgenda.orderNo}.{sub.orderNo}</span>
                      {sub.titleTh}
                    </p>
                    <span className={`badge border text-xs font-bold ${
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
                          <span className={`text-xs font-semibold ${item.color}`}>{item.label}</span>
                          <span className="text-xs text-text-primary font-bold">{formatShares(item.shares)} หุ้น ({pct(item.shares)}%)</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-bg-primary overflow-hidden">
                          <div className={`h-full rounded-full ${item.barColor} transition-all duration-500`} style={{ width: `${pct(item.shares)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agenda Status Overview */}
      <div className="glass-card p-4">
        <p className="text-sm font-semibold text-text-secondary mb-3">สถานะวาระทั้งหมด</p>
        <div className="space-y-2">
          {agendas.map((a) => (
            <div key={a.id}>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50">
                <span className="text-sm font-bold text-text-muted w-8">{a.orderNo}</span>
                <span className="text-sm text-text-primary flex-1 truncate">{a.titleTh}</span>
                {a.resolutionType === 'ELECTION' && a.subAgendas && a.subAgendas.length > 0 && (
                  <span className="text-[10px] text-text-muted flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {a.subAgendas.length} รายการ
                  </span>
                )}
                <span className={`badge text-xs ${
                  a.status === 'OPEN' ? 'bg-emerald-500/15 text-emerald-400' :
                  a.status === 'CLOSED' ? 'bg-red-500/15 text-red-400' :
                  a.status === 'ANNOUNCED' ? 'bg-blue-500/15 text-blue-400' :
                  'bg-gray-500/15 text-gray-400'
                }`}>
                  {a.status}
                </span>
              </div>
              {/* Sub-agendas for ELECTION */}
              {a.resolutionType === 'ELECTION' && a.subAgendas && a.subAgendas.length > 0 && (
                <div className="ml-11 mt-1 mb-2 space-y-1">
                  {a.subAgendas.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-secondary/30">
                      <span className="text-xs font-mono text-text-muted">{a.orderNo}.{sub.orderNo}</span>
                      <span className="text-xs text-text-primary truncate">{sub.titleTh}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
