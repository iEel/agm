'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/lib/session-context';
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

  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await fetch('/api/registrations');
      if (!res.ok) return;
      const data = await res.json();
      setRegistrations(data.registrations || []);
      setQuorum(data.quorum);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistrations();
    const interval = setInterval(fetchRegistrations, 10000);
    return () => clearInterval(interval);
  }, [fetchRegistrations]);

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
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const handleCheckin = async (shareholder: Shareholder) => {
    setCheckinMsg(null);
    try {
      const res = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareholderId: shareholder.id, attendeeType: 'SELF' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckinMsg({ type: 'error', text: data.error });
        return;
      }
      setCheckinMsg({ type: 'success', text: `ลงทะเบียนสำเร็จ — ${shareholder.firstNameTh} ${shareholder.lastNameTh}` });
      setShowSearch(false);
      setSearchTerm('');
      setSearchResults([]);
      fetchRegistrations();

      // Open ballot print page in new tab
      window.open(`/ballot-print?shareholderId=${shareholder.id}`, '_blank');
      // Re-focus search input for next check-in
      setTimeout(() => searchInputRef.current?.focus(), 300);
    } catch {
      setCheckinMsg({ type: 'error', text: 'เกิดข้อผิดพลาด' });
    }
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

  const activeRegistrations = registrations.filter(r => !r.checkoutAt);
  const checkedOutRegistrations = registrations.filter(r => r.checkoutAt);

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
          <p className="text-sm text-text-secondary mt-1">{activeEvent.name}</p>
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
                  className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                    isRegistered && !isCheckedOut
                      ? 'bg-emerald-500/5 border-emerald-500/15'
                      : isCheckedOut
                        ? 'bg-bg-tertiary/30 border-border/30 opacity-60'
                        : 'bg-bg-tertiary/50 border-border/50 hover:border-primary/30 hover:bg-bg-hover/30'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                      isRegistered && !isCheckedOut
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-bg-tertiary text-text-muted'
                    }`}>
                      <Hash className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-text-primary">
                        {sh.firstNameTh} {sh.lastNameTh}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-text-muted font-mono">เลขทะเบียน: {sh.registrationNo}</span>
                        <span className="text-xs text-text-muted">•</span>
                        <span className="text-xs text-primary font-semibold">{formatShares(sh.shares)} หุ้น</span>
                      </div>
                    </div>
                  </div>
                  {isRegistered && !isCheckedOut ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ลงทะเบียนแล้ว
                    </span>
                  ) : isCheckedOut ? (
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-bold">
                      ออกแล้ว
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCheckin(sh)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-bold shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/35 cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <LogIn className="w-4 h-4" />
                      Check-in
                    </button>
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
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
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
          <div className="overflow-x-auto">
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
                {registrations.map((reg, idx) => (
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
        )}
      </div>
    </div>
  );
}
