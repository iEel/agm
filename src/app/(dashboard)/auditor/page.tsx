'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/lib/session-context';
import {
  Shield,
  Users,
  BarChart3,
  Percent,
  AlertCircle,
  Activity,
  ListOrdered,
} from 'lucide-react';

interface Agenda {
  id: string;
  orderNo: number;
  titleTh: string;
  resolutionType: string;
  status: string;
}

interface Quorum {
  attendees: number;
  shares: string;
  totalShares: string;
  percentage: string;
}

export default function AuditorPage() {
  const { activeEvent } = useSession();
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [quorum, setQuorum] = useState<Quorum | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [regRes, agendaRes] = await Promise.all([
        fetch('/api/registrations?limit=1'),
        fetch('/api/agendas'),
      ]);
      if (regRes.ok) {
        const data = await regRes.json();
        setQuorum(data.quorum);
      }
      if (agendaRes.ok) {
        const data = await agendaRes.json();
        setAgendas(data.agendas || []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
    return <div className="flex items-center justify-center py-20"><div className="animate-pulse-glow w-16 h-16 rounded-2xl bg-bg-tertiary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            ผู้ตรวจสอบ (Read-only)
          </h1>
          <p className="text-sm text-text-secondary mt-1">{activeEvent.name}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20">
          <Activity className="w-3.5 h-3.5 text-teal-400 animate-pulse" />
          <span className="text-xs text-teal-400 font-medium">MONITORING</span>
        </div>
      </div>

      {/* Quorum */}
      {quorum && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5 text-center">
            <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-text-primary">{quorum.attendees}</p>
            <p className="text-xs text-text-muted mt-1">ผู้เข้าร่วม</p>
          </div>
          <div className="glass-card p-5 text-center">
            <BarChart3 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-3xl font-bold text-text-primary">{formatShares(quorum.shares)}</p>
            <p className="text-xs text-text-muted mt-1">หุ้น (จาก {formatShares(quorum.totalShares)})</p>
          </div>
          <div className="glass-card p-5 text-center">
            <Percent className="w-6 h-6 text-amber-400 mx-auto mb-2" />
            <p className={`text-3xl font-bold ${parseFloat(quorum.percentage) >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {quorum.percentage}%
            </p>
            <p className="text-xs text-text-muted mt-1">องค์ประชุม</p>
          </div>
        </div>
      )}

      {/* Agenda List */}
      <div className="glass-card p-4">
        <p className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-3">
          <ListOrdered className="w-4 h-4" /> สถานะวาระ ({agendas.length})
        </p>
        <div className="space-y-2">
          {agendas.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-tertiary/50">
              <span className="text-sm font-bold text-text-muted w-8">{a.orderNo}</span>
              <span className="text-sm text-text-primary flex-1 truncate">{a.titleTh}</span>
              <span className={`badge text-xs ${
                a.status === 'OPEN' ? 'bg-emerald-500/15 text-emerald-400' :
                a.status === 'CLOSED' ? 'bg-red-500/15 text-red-400' :
                'bg-gray-500/15 text-gray-400'
              }`}>{a.status}</span>
            </div>
          ))}
          {agendas.length === 0 && <p className="text-sm text-text-muted text-center py-4">ไม่มีวาระ</p>}
        </div>
      </div>
    </div>
  );
}
