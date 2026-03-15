'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/lib/session-context';
import { useSSE } from '@/lib/use-sse';
import {
  UserCheck,
  Search,
  LogIn,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Users,
  BarChart3,
  Percent,
  XCircle,
  Clock,
  RefreshCw,
  Hash,
  Printer,
  FileSignature,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Shareholder {
  id: string;
  registrationNo: string;
  firstNameTh: string;
  lastNameTh: string;
  firstNameEn: string | null;
  lastNameEn: string | null;
  shares: string;
}

interface Registration {
  id: string;
  shareholderId: string;
  attendeeType: string;
  proxyName: string | null;
  checkinAt: string;
  checkoutAt: string | null;
  shares: string;
  registeredBy: string;
  shareholder: {
    registrationNo: string;
    firstNameTh: string;
    lastNameTh: string;
    firstNameEn: string | null;
    lastNameEn: string | null;
    shares: string;
  };
}

interface Quorum {
  attendees: number;
  shares: string;
  totalShares: string;
  percentage: string;
}

interface PendingProxy {
  id: string;
  shareholderId: string;
  proxyType: string;
  proxyName: string;
  proxyIdCard: string | null;
  shareholder: {
    registrationNo: string;
    firstNameTh: string;
    lastNameTh: string;
    shares: string;
  };
}



const PROXY_TYPES = [
  { value: 'FORM_A', label: 'แบบ ก.', color: 'bg-blue-500/15 text-blue-400', desc: 'ผู้รับมอบตัดสินใจเอง' },
  { value: 'FORM_B', label: 'แบบ ข.', color: 'bg-emerald-500/15 text-emerald-400', desc: 'ระบุผลโหวตล่วงหน้า' },
  { value: 'FORM_C', label: 'แบบ ค.', color: 'bg-purple-500/15 text-purple-400', desc: 'Custodian' },
];

export default function RegistrationPage() {
  const { activeEvent } = useSession();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [quorum, setQuorum] = useState<Quorum | null>(null);
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Search shareholders
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Shareholder[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [checkinMsg, setCheckinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Proxy modal
  const [proxyModalShareholder, setProxyModalShareholder] = useState<Shareholder | null>(null);
  const [proxyForm, setProxyForm] = useState({ proxyType: 'FORM_A', proxyName: '', proxyIdCard: '' });
  const [proxySaving, setProxySaving] = useState(false);
  const [proxyError, setProxyError] = useState('');
  const [proxyPreConfigured, setProxyPreConfigured] = useState(false);
  // Map shareholderId -> proxy record for search results
  const [proxyMap, setProxyMap] = useState<Record<string, { proxyType: string; proxyName: string; proxyIdCard: string }>>({});
  // Pending proxies (configured but not registered)
  const [pendingProxies, setPendingProxies] = useState<PendingProxy[]>([]);
  const [showPendingProxies, setShowPendingProxies] = useState(true);

  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await fetch('/api/registrations?limit=9999');
      if (!res.ok) return;
      const data = await res.json();
      setRegistrations(data.registrations || []);
      setQuorum(data.quorum);

      // Fetch pending proxies
      try {
        const proxyRes = await fetch('/api/proxies');
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          const registeredIds = new Set((data.registrations || []).map((r: Registration) => r.shareholderId));
          const pending = (proxyData.proxies || []).filter(
            (p: PendingProxy) => !registeredIds.has(p.shareholderId)
          );
          setPendingProxies(pending);
          // Also update proxyMap for search
          const map: Record<string, { proxyType: string; proxyName: string; proxyIdCard: string }> = {};
          for (const p of (proxyData.proxies || [])) {
            map[p.shareholderId] = { proxyType: p.proxyType, proxyName: p.proxyName || '', proxyIdCard: p.proxyIdCard || '' };
          }
          setProxyMap(map);
        }
      } catch { /* ignore */ }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // SSE real-time updates (falls back to polling every 10s)
  useSSE(fetchRegistrations, 10000);

  // Auto-clear success messages after 4 seconds
  useEffect(() => {
    if (checkinMsg?.type === 'success') {
      const timeout = setTimeout(() => setCheckinMsg(null), 4000);
      return () => clearTimeout(timeout);
    }
  }, [checkinMsg]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/shareholders?search=${encodeURIComponent(searchTerm)}&limit=10`);
      if (!res.ok) return;
      const data = await res.json();
      setSearchResults(data.shareholders || []);
      setShowSearch(true);

      // Fetch proxy records for display in search results
      try {
        const proxyRes = await fetch('/api/proxies');
        if (proxyRes.ok) {
          const proxyData = await proxyRes.json();
          const map: Record<string, { proxyType: string; proxyName: string; proxyIdCard: string }> = {};
          for (const p of (proxyData.proxies || [])) {
            map[p.shareholderId] = { proxyType: p.proxyType, proxyName: p.proxyName || '', proxyIdCard: p.proxyIdCard || '' };
          }
          setProxyMap(map);
        }
      } catch { /* ignore */ }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const handleCheckin = async (shareholder: Shareholder, attendeeType: 'SELF' | 'PROXY' = 'SELF', proxyData?: { proxyType: string; proxyName: string; proxyIdCard: string }) => {
    setCheckinMsg(null);
    try {
      // If PROXY and no pre-configured proxy, create proxy record first
      if (attendeeType === 'PROXY' && proxyData && !proxyPreConfigured) {
        const proxyRes = await fetch('/api/proxies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shareholderId: shareholder.id,
            proxyType: proxyData.proxyType,
            proxyName: proxyData.proxyName,
            proxyIdCard: proxyData.proxyIdCard || null,
          }),
        });
        if (!proxyRes.ok) {
          const proxyErr = await proxyRes.json();
          // P2002 = proxy already exists, that's OK
          if (!proxyErr.error?.includes('Unique constraint')) {
            setCheckinMsg({ type: 'error', text: proxyErr.error || 'สร้างหนังสือมอบฉันทะไม่สำเร็จ' });
            return;
          }
        }
      }

      // Check-in registration
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shareholderId: shareholder.id,
          attendeeType,
          proxyType: proxyData?.proxyType?.replace('FORM_', '') || undefined,
          proxyName: proxyData?.proxyName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckinMsg({ type: 'error', text: data.error });
        return;
      }
      const label = attendeeType === 'SELF' ? 'มาด้วยตนเอง' : `มอบฉันทะ → ${proxyData?.proxyName}`;
      setCheckinMsg({ type: 'success', text: `ลงทะเบียนสำเร็จ — ${shareholder.firstNameTh} ${shareholder.lastNameTh} (${label})` });
      setShowSearch(false);
      setSearchTerm('');
      setSearchResults([]);
      setProxyModalShareholder(null);
      fetchRegistrations();

      // Open ballot print page in new tab
      window.open(`/ballot-print?shareholderId=${shareholder.id}`, '_blank');
      // Re-focus search input for next check-in
      setTimeout(() => searchInputRef.current?.focus(), 300);
    } catch {
      setCheckinMsg({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    }
  };

  const openProxyModal = async (shareholder: Shareholder) => {
    setProxyModalShareholder(shareholder);
    setProxyForm({ proxyType: 'FORM_A', proxyName: '', proxyIdCard: '' });
    setProxyError('');
    setProxyPreConfigured(false);

    // Auto-detect existing proxy record
    try {
      const res = await fetch('/api/proxies');
      if (res.ok) {
        const data = await res.json();
        const existing = (data.proxies || []).find(
          (p: { shareholderId: string }) => p.shareholderId === shareholder.id
        );
        if (existing) {
          setProxyForm({
            proxyType: existing.proxyType,
            proxyName: existing.proxyName || '',
            proxyIdCard: existing.proxyIdCard || '',
          });
          setProxyPreConfigured(true);
        }
      }
    } catch { /* ignore */ }
  };

  const handleProxyCheckin = async () => {
    if (!proxyModalShareholder) return;
    if (!proxyForm.proxyName.trim()) {
      setProxyError('กรุณากรอกชื่อผู้รับมอบฉันทะ');
      return;
    }
    setProxySaving(true);
    setProxyError('');
    await handleCheckin(proxyModalShareholder, 'PROXY', proxyForm);
    setProxySaving(false);
  };

  const handleCheckout = async (registrationId: string) => {
    if (!confirm('ยืนยันการ Check-out ผู้ถือหุ้นคนนี้?')) return;
    try {
      await fetch(`/api/registrations/${registrationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout' }),
      });
      fetchRegistrations();
    } catch {
      // ignore
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setShowSearch(false);
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const formatShares = (n: string | number) => BigInt(n).toLocaleString('th-TH');
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const [regSearchTerm, setRegSearchTerm] = useState('');
  const [regPage, setRegPage] = useState(1);
  const REG_PER_PAGE = 20;

  const activeRegistrations = registrations.filter(r => !r.checkoutAt);
  const checkedOutRegistrations = registrations.filter(r => r.checkoutAt);

  // Filter registrations by search term
  const filteredRegistrations = regSearchTerm.trim()
    ? registrations.filter(r => {
        const q = regSearchTerm.toLowerCase();
        return (
          r.shareholder.registrationNo.toLowerCase().includes(q) ||
          r.shareholder.firstNameTh.toLowerCase().includes(q) ||
          r.shareholder.lastNameTh.toLowerCase().includes(q) ||
          (r.shareholder.firstNameEn || '').toLowerCase().includes(q) ||
          (r.shareholder.lastNameEn || '').toLowerCase().includes(q) ||
          (r.proxyName || '').toLowerCase().includes(q)
        );
      })
    : registrations;

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">ไม่มีงานประชุมที่ Active</h2>
        <p className="text-sm text-text-secondary">กรุณาเปิดใช้งานงานประชุมก่อน</p>
      </div>
    );
  }

  const quorumPct = quorum ? parseFloat(quorum.percentage) : 0;
  const quorumMet = quorumPct >= 33.33;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/20">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            ลงทะเบียนผู้ถือหุ้น
          </h1>
          <p className="text-sm text-text-secondary mt-1">{activeEvent.companyName}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: '3s' }} />
          <span className="text-xs text-emerald-400 font-medium">LIVE — อัปเดตทุก 10 วินาที</span>
        </div>
      </div>

      {/* ═══════════ Quorum Dashboard ═══════════ */}
      {quorum && (
        <div className="glass-card p-5">
          {/* Top: 3 stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {/* Attendees */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 flex-shrink-0">
                <Users className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-xs text-text-muted font-medium">ผู้เข้าร่วมประชุม</p>
                <p className="text-3xl font-black text-text-primary leading-tight">{quorum.attendees}</p>
                <p className="text-[11px] text-text-muted">ราย (เช็คอินแล้ว)</p>
              </div>
            </div>

            {/* Shares */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
                <BarChart3 className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-xs text-text-muted font-medium">จำนวนหุ้น</p>
                <p className="text-2xl font-black text-text-primary leading-tight">{formatShares(quorum.shares)}</p>
                <p className="text-[11px] text-text-muted">จาก {formatShares(quorum.totalShares)} หุ้น</p>
              </div>
            </div>

            {/* Quorum % */}
            <div className={`flex items-center gap-4 p-4 rounded-2xl border ${
              quorumMet
                ? 'bg-emerald-500/5 border-emerald-500/10'
                : 'bg-amber-500/5 border-amber-500/10'
            }`}>
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0 ${
                quorumMet
                  ? 'bg-gradient-to-br from-emerald-500 to-green-500 shadow-emerald-500/20'
                  : 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/20'
              }`}>
                <Percent className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="text-xs text-text-muted font-medium">องค์ประชุม</p>
                <p className={`text-3xl font-black leading-tight ${
                  quorumMet ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {quorum.percentage}%
                </p>
                <p className="text-[11px] text-text-muted">
                  {quorumMet ? '✅ ครบองค์ประชุม (≥1/3)' : '⏳ ยังไม่ครบ (ต้องการ ≥33.33%)'}
                </p>
              </div>
            </div>
          </div>

          {/* Quorum Progress Bar */}
          <div className="relative">
            <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
              <span>ความคืบหน้าองค์ประชุม</span>
              <span>{quorum.percentage}% จาก 33.33% ที่ต้องการ</span>
            </div>
            <div className="h-3 rounded-full bg-bg-tertiary overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  quorumMet
                    ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                    : 'bg-gradient-to-r from-amber-500 to-orange-400'
                }`}
                style={{ width: `${Math.min(quorumPct / 33.33 * 100, 100)}%` }}
              />
              {/* 33.33% threshold line */}
              {quorumPct < 100 && (
                <div className="absolute top-0 h-full w-0.5 bg-text-muted/30" style={{ left: '100%' }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Pending Proxies ═══════════ */}
      {pendingProxies.length > 0 && (
        <div className="glass-card overflow-hidden">
          <button
            onClick={() => setShowPendingProxies(!showPendingProxies)}
            className="w-full px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-bg-hover/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <FileSignature className="w-4 h-4 text-violet-400" />
              </div>
              <p className="text-sm font-bold text-text-primary">มอบฉันทะรอลงทะเบียน</p>
              <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 text-xs font-bold">
                {pendingProxies.length} ราย
              </span>
            </div>
            <span className="text-text-muted text-xs">{showPendingProxies ? '▲ ซ่อน' : '▼ แสดง'}</span>
          </button>
          {showPendingProxies && (
            <div className="border-t border-border">
              {pendingProxies.map((proxy) => {
                const proxyLabel: Record<string, string> = { FORM_A: 'ก.', FORM_B: 'ข.', FORM_C: 'ค.' };
                return (
                  <div
                    key={proxy.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border/30 last:border-b-0 hover:bg-bg-hover/20 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-bg-tertiary flex items-center justify-center text-xs font-mono text-text-muted flex-shrink-0">
                        <Hash className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-text-primary truncate">
                          {proxy.shareholder.firstNameTh} {proxy.shareholder.lastNameTh}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="text-[11px] text-text-muted font-mono">{proxy.shareholder.registrationNo}</span>
                          <span className="text-[11px] text-primary font-semibold">{formatShares(proxy.shareholder.shares)} หุ้น</span>
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                            proxy.proxyType === 'FORM_B' ? 'bg-emerald-500/10 text-emerald-400'
                            : proxy.proxyType === 'FORM_C' ? 'bg-purple-500/10 text-purple-400'
                            : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            แบบ {proxyLabel[proxy.proxyType] || proxy.proxyType}
                          </span>
                          <span className="text-[11px] text-text-muted">→ {proxy.proxyName}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setProxyPreConfigured(true);
                        handleCheckin(
                          { id: proxy.shareholderId, registrationNo: proxy.shareholder.registrationNo, firstNameTh: proxy.shareholder.firstNameTh, lastNameTh: proxy.shareholder.lastNameTh, firstNameEn: null, lastNameEn: null, shares: proxy.shareholder.shares },
                          'PROXY',
                          { proxyType: proxy.proxyType, proxyName: proxy.proxyName, proxyIdCard: proxy.proxyIdCard || '' }
                        );
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold shadow-lg shadow-violet-500/25 hover:shadow-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] self-end sm:self-auto flex-shrink-0"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      ลงทะเบียน
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ Search & Check-in ═══════════ */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            ค้นหาและลงทะเบียน
          </p>
          <p className="text-[11px] text-text-muted">พิมพ์แล้วกด Enter หรือปุ่มค้นหา</p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="เลขทะเบียน, ชื่อ, นามสกุล, เลขบัตรประชาชน..."
            className="w-full pl-12 pr-28 py-4 bg-bg-tertiary border border-border rounded-2xl text-text-primary text-base placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200"
            autoFocus
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {searchTerm && (
              <button
                type="button"
                onClick={clearSearch}
                className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                title="ล้างการค้นหา"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleSearch}
              disabled={searching || !searchTerm.trim()}
              className="px-5 py-2 rounded-xl gradient-primary text-white text-sm font-bold shadow-md shadow-primary/20 cursor-pointer hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {searching ? 'กำลังค้นหา...' : 'ค้นหา'}
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {checkinMsg && (
          <div className={`p-3.5 rounded-xl flex items-center gap-2.5 text-sm font-medium animate-fade-in ${
            checkinMsg.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-danger/10 text-danger border border-danger/20'
          }`}>
            {checkinMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <XCircle className="w-5 h-5 flex-shrink-0" />}
            {checkinMsg.text}
          </div>
        )}

        {/* Search Results */}
        {showSearch && searchResults.length > 0 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-text-muted px-1">พบ {searchResults.length} รายการ</p>
            {searchResults.map((sh) => {
              const reg = registrations.find((r) => r.shareholderId === sh.id);
              const isRegistered = !!reg;
              const isCheckedOut = reg?.checkoutAt;
              return (
                <div
                  key={sh.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition-all duration-200 ${
                    isRegistered && !isCheckedOut
                      ? 'bg-emerald-500/5 border-emerald-500/15'
                      : isCheckedOut
                        ? 'bg-bg-tertiary/30 border-border/30 opacity-60'
                        : 'bg-bg-tertiary/50 border-border/50 hover:border-primary/30 hover:bg-bg-hover/30'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      isRegistered && !isCheckedOut
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-bg-tertiary text-text-muted'
                    }`}>
                      <Hash className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-text-primary truncate">
                        {sh.firstNameTh} {sh.lastNameTh}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        <span className="text-xs text-text-muted font-mono">{sh.registrationNo}</span>
                        <span className="text-xs text-primary font-semibold">{formatShares(sh.shares)} หุ้น</span>
                      </div>
                    </div>
                  </div>
                  {isRegistered && !isCheckedOut ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold self-end sm:self-auto">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ลงทะเบียนแล้ว
                    </span>
                  ) : isCheckedOut ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-bold self-end sm:self-auto">
                      ออกแล้ว
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                      {(() => {
                        const existingProxy = proxyMap[sh.id];
                        const proxyLabel: Record<string, string> = { FORM_A: 'ก.', FORM_B: 'ข.', FORM_C: 'ค.' };
                        if (existingProxy) {
                          return (
                            <>
                              <button
                                onClick={() => {
                                  setProxyPreConfigured(true);
                                  handleCheckin(sh, 'PROXY', {
                                    proxyType: existingProxy.proxyType,
                                    proxyName: existingProxy.proxyName,
                                    proxyIdCard: existingProxy.proxyIdCard,
                                  });
                                }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold shadow-lg shadow-violet-500/25 hover:shadow-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <FileSignature className="w-3.5 h-3.5" />
                                📋 แบบ {proxyLabel[existingProxy.proxyType] || existingProxy.proxyType}
                              </button>
                              <button
                                onClick={() => handleCheckin(sh, 'SELF')}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bg-tertiary border border-border/50 text-text-secondary text-xs font-medium cursor-pointer hover:bg-bg-hover transition-all"
                              >
                                👤 มาเอง
                              </button>
                            </>
                          );
                        }
                        return (
                          <>
                            <button
                              onClick={() => handleCheckin(sh, 'SELF')}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold shadow-lg shadow-green-500/25 hover:shadow-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              👤 มาเอง
                            </button>
                            <button
                              onClick={() => openProxyModal(sh)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold shadow-lg shadow-violet-500/25 hover:shadow-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                            >
                              <FileSignature className="w-3.5 h-3.5" />
                              📋 มอบฉันทะ
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showSearch && searchResults.length === 0 && !searching && (
          <div className="text-center py-6">
            <Search className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-30" />
            <p className="text-sm text-text-muted">ไม่พบผู้ถือหุ้นที่ตรงกับ &quot;{searchTerm}&quot;</p>
          </div>
        )}
      </div>

      {/* ═══════════ Registration List ═══════════ */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold text-text-primary">
                รายการลงทะเบียน
              </p>
              <span className="px-2.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-bold">
                {activeRegistrations.length} คนในห้อง
              </span>
              {checkedOutRegistrations.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium">
                  {checkedOutRegistrations.length} ออกแล้ว
                </span>
              )}
            </div>
            <p className="text-[11px] text-text-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ทั้งหมด {registrations.length} รายการ
            </p>
          </div>
          {/* Search registered list */}
          {registrations.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={regSearchTerm}
                onChange={(e) => { setRegSearchTerm(e.target.value); setRegPage(1); }}
                placeholder="ค้นหาผู้ลงทะเบียนแล้ว... (ชื่อ, เลขทะเบียน, ผู้รับมอบ)"
                className="w-full pl-9 pr-8 py-2.5 bg-bg-primary border border-border rounded-xl text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
              />
              {regSearchTerm && (
                <button
                  onClick={() => setRegSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {regSearchTerm && (
            <p className="text-xs text-text-muted">พบ {filteredRegistrations.length} จาก {registrations.length} รายการ</p>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-text-muted">กำลังโหลดรายการลงทะเบียน...</p>
          </div>
        ) : registrations.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-20" />
            <p className="text-sm text-text-muted">ยังไม่มีผู้ลงทะเบียน</p>
            <p className="text-xs text-text-muted mt-1">ค้นหาผู้ถือหุ้นด้านบนเพื่อ Check-in</p>
          </div>
        ) : (
          <>
          {/* Desktop: Table view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-bg-tertiary/30">
                  <th className="text-left text-[11px] font-bold text-text-secondary px-5 py-3 uppercase tracking-wider">เลขทะเบียน</th>
                  <th className="text-left text-[11px] font-bold text-text-secondary px-5 py-3 uppercase tracking-wider">ชื่อ-นามสกุล</th>
                  <th className="text-center text-[11px] font-bold text-text-secondary px-5 py-3 uppercase tracking-wider">ประเภท</th>
                  <th className="text-right text-[11px] font-bold text-text-secondary px-5 py-3 uppercase tracking-wider">หุ้น</th>
                  <th className="text-center text-[11px] font-bold text-text-secondary px-5 py-3 uppercase tracking-wider">เวลา Check-in</th>
                  <th className="text-center text-[11px] font-bold text-text-secondary px-5 py-3 uppercase tracking-wider">สถานะ</th>
                  <th className="text-center text-[11px] font-bold text-text-secondary px-5 py-3 uppercase tracking-wider w-32">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrations
                  .slice((regPage - 1) * REG_PER_PAGE, regPage * REG_PER_PAGE)
                  .map((reg, idx) => (
                  <tr
                    key={reg.id}
                    className={`border-b border-border/30 transition-colors ${
                      reg.checkoutAt
                        ? 'bg-red-500/3 opacity-50'
                        : idx % 2 === 0
                          ? 'hover:bg-bg-hover/50'
                          : 'bg-bg-tertiary/10 hover:bg-bg-hover/50'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-mono font-bold text-primary">{reg.shareholder.registrationNo}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-semibold text-text-primary">
                        {reg.shareholder.firstNameTh} {reg.shareholder.lastNameTh}
                      </p>
                      {reg.proxyName && (
                        <p className="text-[11px] text-purple-400 mt-0.5">👤 ผู้รับมอบ: {reg.proxyName}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        reg.attendeeType === 'SELF'
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-purple-500/15 text-purple-400'
                      }`}>
                        {reg.attendeeType === 'SELF' ? '👤 ด้วยตนเอง' : '📋 มอบฉันทะ'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-bold text-text-primary">{formatShares(reg.shares)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-xs text-text-muted font-mono">{formatTime(reg.checkinAt)}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {reg.checkoutAt ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 text-[11px] font-bold">
                          <LogOut className="w-3 h-3" />
                          ออก {formatTime(reg.checkoutAt)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          อยู่ในห้อง
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => window.open(`/ballot-print?shareholderId=${reg.shareholderId}`, '_blank')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer"
                          title="พิมพ์บัตรลงคะแนนใหม่"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          พิมพ์
                        </button>
                        {!reg.checkoutAt && (
                          <button
                            onClick={() => handleCheckout(reg.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
                            title="Check-out"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            ออก
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: Card view */}
          <div className="md:hidden divide-y divide-border/30">
            {filteredRegistrations
              .slice((regPage - 1) * REG_PER_PAGE, regPage * REG_PER_PAGE)
              .map((reg) => (
              <div
                key={reg.id}
                className={`p-4 ${
                  reg.checkoutAt ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-text-primary truncate">
                      {reg.shareholder.firstNameTh} {reg.shareholder.lastNameTh}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      <span className="text-xs text-primary font-mono font-bold">{reg.shareholder.registrationNo}</span>
                      <span className="text-xs text-text-muted">{formatShares(reg.shares)} หุ้น</span>
                    </div>
                    {reg.proxyName && (
                      <p className="text-[11px] text-purple-400 mt-0.5">👤 {reg.proxyName}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      reg.attendeeType === 'SELF'
                        ? 'bg-blue-500/15 text-blue-400'
                        : 'bg-purple-500/15 text-purple-400'
                    }`}>
                      {reg.attendeeType === 'SELF' ? '👤 ตนเอง' : '📋 มอบฉันทะ'}
                    </span>
                    {reg.checkoutAt ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 text-[10px] font-bold">
                        ออก {formatTime(reg.checkoutAt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        {formatTime(reg.checkinAt)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => window.open(`/ballot-print?shareholderId=${reg.shareholderId}`, '_blank')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    พิมพ์
                  </button>
                  {!reg.checkoutAt && (
                    <button
                      onClick={() => handleCheckout(reg.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      ออก
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {/* Pagination Controls */}
          {filteredRegistrations.length > REG_PER_PAGE && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-text-muted">
                แสดง {(regPage - 1) * REG_PER_PAGE + 1}–{Math.min(regPage * REG_PER_PAGE, filteredRegistrations.length)} จาก {filteredRegistrations.length} รายการ
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRegPage(p => Math.max(1, p - 1))}
                  disabled={regPage <= 1}
                  className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.ceil(filteredRegistrations.length / REG_PER_PAGE) }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === Math.ceil(filteredRegistrations.length / REG_PER_PAGE) || Math.abs(p - regPage) <= 2)
                  .reduce<(number | string)[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    typeof p === 'string' ? (
                      <span key={`dot-${i}`} className="px-1 text-xs text-text-muted">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setRegPage(p)}
                        className={`min-w-[32px] h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          regPage === p
                            ? 'bg-primary text-white shadow-md shadow-primary/25'
                            : 'hover:bg-bg-hover text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setRegPage(p => Math.min(Math.ceil(filteredRegistrations.length / REG_PER_PAGE), p + 1))}
                  disabled={regPage >= Math.ceil(filteredRegistrations.length / REG_PER_PAGE)}
                  className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* ═══════════ Proxy Modal ═══════════ */}
      {proxyModalShareholder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setProxyModalShareholder(null)} />
          <div className="relative w-full max-w-lg glass-card p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-violet-400" />
                ลงทะเบียน + มอบฉันทะ
              </h2>
              <button onClick={() => setProxyModalShareholder(null)} className="p-2 rounded-lg hover:bg-bg-hover text-text-muted cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shareholder info */}
            <div className="mb-5 p-3.5 rounded-xl bg-bg-tertiary/50 border border-border/50">
              <p className="text-sm font-bold text-text-primary">
                {proxyModalShareholder.firstNameTh} {proxyModalShareholder.lastNameTh}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-text-muted font-mono">เลขทะเบียน: {proxyModalShareholder.registrationNo}</span>
                <span className="text-xs text-text-muted">•</span>
                <span className="text-xs text-primary font-semibold">{formatShares(proxyModalShareholder.shares)} หุ้น</span>
              </div>
            </div>

            {proxyPreConfigured && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">ตั้งค่ามอบฉันทะไว้แล้ว</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400/70">ข้อมูลถูกดึงจากหน้าตั้งค่ามอบฉันทะอัตโนมัติ</p>
                </div>
              </div>
            )}

            {proxyError && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {proxyError}
              </div>
            )}

            <div className="space-y-4">
              {/* Proxy Type */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">ประเภทหนังสือมอบฉันทะ *</label>
                <div className="grid grid-cols-3 gap-2">
                  {PROXY_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setProxyForm((p) => ({ ...p, proxyType: t.value }))}
                      className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                        proxyForm.proxyType === t.value
                          ? 'border-primary bg-primary/10'
                          : 'border-border/50 hover:border-border'
                      }`}
                    >
                      <p className={`text-sm font-bold ${proxyForm.proxyType === t.value ? 'text-primary' : 'text-text-primary'}`}>{t.label}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Proxy Name */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">ชื่อผู้รับมอบฉันทะ *</label>
                <input
                  type="text"
                  value={proxyForm.proxyName}
                  onChange={(e) => setProxyForm((p) => ({ ...p, proxyName: e.target.value }))}
                  className="input-field"
                  placeholder="ชื่อ-นามสกุล ผู้รับมอบฉันทะ"
                  autoFocus
                />
              </div>

              {/* Proxy ID Card */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">เลขบัตรประชาชนผู้รับมอบ</label>
                <input
                  type="text"
                  value={proxyForm.proxyIdCard}
                  onChange={(e) => setProxyForm((p) => ({ ...p, proxyIdCard: e.target.value }))}
                  className="input-field"
                  placeholder="(ไม่บังคับ)"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setProxyModalShareholder(null)}
                className="px-4 py-2.5 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium cursor-pointer hover:bg-bg-hover transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleProxyCheckin}
                disabled={proxySaving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-bold shadow-lg shadow-violet-500/25 disabled:opacity-50 cursor-pointer hover:shadow-xl transition-all"
              >
                <Save className="w-4 h-4" />
                {proxySaving ? 'กำลังบันทึก...' : 'ยืนยัน + Check-in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
