'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/lib/session-context';
import {
  FileSignature,
  Plus,
  AlertCircle,
  X,
  Save,
  Search,
} from 'lucide-react';

interface ProxyItem {
  id: string;
  proxyType: string;
  proxyName: string;
  proxyIdCard: string | null;
  shareholder: {
    registrationNo: string;
    firstNameTh: string;
    lastNameTh: string;
    shares: string;
  };
  splitVotes: Array<{ agendaId: string; voteChoice: string; shares: string }>;
}

interface ShareholderOption {
  id: string;
  registrationNo: string;
  firstNameTh: string;
  lastNameTh: string;
  shares: string;
}

const PROXY_TYPES = [
  { value: 'FORM_A', label: 'แบบ ก.', color: 'bg-blue-500/15 text-blue-400', icon: '🟦', desc: 'ผู้รับมอบตัดสินใจเอง' },
  { value: 'FORM_B', label: 'แบบ ข.', color: 'bg-emerald-500/15 text-emerald-400', icon: '🟩', desc: 'ระบุผลโหวตล่วงหน้า' },
  { value: 'FORM_C', label: 'แบบ ค.', color: 'bg-purple-500/15 text-purple-400', icon: '🟣', desc: 'Custodian' },
];

export default function ProxyPage() {
  const { activeEvent } = useSession();
  const [proxies, setProxies] = useState<ProxyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [shareholders, setShareholders] = useState<ShareholderOption[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    shareholderId: '',
    proxyType: 'FORM_A',
    proxyName: '',
    proxyIdCard: '',
  });

  const fetchProxies = useCallback(async () => {
    try {
      const res = await fetch('/api/proxies');
      if (!res.ok) return;
      const data = await res.json();
      setProxies(data.proxies || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProxies(); }, [fetchProxies]);

  const searchShareholders = async (term: string) => {
    setSearchTerm(term);
    if (!term.trim()) { setShareholders([]); return; }
    try {
      const res = await fetch(`/api/shareholders?search=${encodeURIComponent(term)}&limit=10`);
      if (!res.ok) return;
      const data = await res.json();
      setShareholders(data.shareholders || []);
    } catch { /* ignore */ }
  };

  const handleSave = async () => {
    if (!formData.shareholderId || !formData.proxyName) {
      setError('กรุณาเลือกผู้ถือหุ้นและกรอกชื่อผู้รับมอบ');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/proxies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'เกิดข้อผิดพลาด');
        return;
      }
      setShowModal(false);
      fetchProxies();
    } catch {
      setError('เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">ไม่มีงานประชุมที่ Active</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <FileSignature className="w-5 h-5 text-white" />
            </div>
            การมอบฉันทะ
          </h1>
          <p className="text-sm text-text-secondary mt-1">{activeEvent.companyName}</p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            setFormData({ shareholderId: '', proxyType: 'FORM_A', proxyName: '', proxyIdCard: '' });
            setShareholders([]);
            setSearchTerm('');
            setError('');
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-primary/25 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          เพิ่มหนังสือมอบฉันทะ
        </button>
      </div>

      {/* Proxy Type Legend */}
      <div className="glass-card-light p-4 flex items-center gap-4 flex-wrap">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">ประเภท:</p>
        {PROXY_TYPES.map((t) => (
          <span key={t.value} className={`badge ${t.color} text-xs`}>{t.label}</span>
        ))}
      </div>

      {/* Proxies List */}
      {loading ? (
        <div className="glass-card p-12 text-center text-text-muted text-sm">กำลังโหลด...</div>
      ) : proxies.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileSignature className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">ยังไม่มีหนังสือมอบฉันทะ</h3>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-semibold text-text-secondary px-4 py-3">ผู้ถือหุ้น</th>
                  <th className="text-center text-xs font-semibold text-text-secondary px-4 py-3">แบบ</th>
                  <th className="text-left text-xs font-semibold text-text-secondary px-4 py-3">ผู้รับมอบฉันทะ</th>
                  <th className="text-right text-xs font-semibold text-text-secondary px-4 py-3">หุ้น</th>
                </tr>
              </thead>
              <tbody>
                {proxies.map((p) => {
                  const typeConfig = PROXY_TYPES.find((t) => t.value === p.proxyType);
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-bg-hover/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-text-primary">
                          {p.shareholder.firstNameTh} {p.shareholder.lastNameTh}
                        </p>
                        <p className="text-xs text-text-muted">{p.shareholder.registrationNo}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`badge text-xs ${typeConfig?.color || ''}`}>
                          {typeConfig?.label || p.proxyType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-text-primary">{p.proxyName}</p>
                        {p.proxyIdCard && <p className="text-xs text-text-muted">{p.proxyIdCard}</p>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-text-primary">
                        {BigInt(p.shareholder.shares).toLocaleString('th-TH')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <FileSignature className="w-5 h-5 text-violet-400" />
                เพิ่มหนังสือมอบฉันทะ
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-bg-hover text-text-muted cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <div className="space-y-5">
              {/* Search Shareholder */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">ผู้ถือหุ้น (ผู้มอบฉันทะ) *</label>
                <div className="relative group">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                    <Search className="w-4 h-4 text-violet-400" />
                  </div>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => searchShareholders(e.target.value)}
                    className="input-field py-3.5 text-sm rounded-2xl border-2 border-border/50 focus:border-violet-400/50 transition-colors"
                    style={{ paddingLeft: '4rem' }}
                    placeholder="พิมพ์ชื่อ, เลขทะเบียน หรือเลขบัตรประชาชน..."
                    autoFocus
                  />
                </div>
                {shareholders.length > 0 && (
                  <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-border/50 bg-bg-tertiary/30">
                    {shareholders.map((sh) => (
                      <button
                        key={sh.id}
                        onClick={() => {
                          setFormData((p) => ({ ...p, shareholderId: sh.id }));
                          setSearchTerm(`${sh.firstNameTh} ${sh.lastNameTh}`);
                          setShareholders([]);
                        }}
                        className={`w-full text-left p-3 flex items-center justify-between hover:bg-bg-hover/80 transition-colors cursor-pointer border-b border-border/20 last:border-0 ${
                          formData.shareholderId === sh.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            formData.shareholderId === sh.id ? 'bg-primary/20 text-primary' : 'bg-bg-tertiary text-text-muted'
                          }`}>
                            {formData.shareholderId === sh.id ? '✓' : '#'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-text-primary">{sh.firstNameTh} {sh.lastNameTh}</p>
                            <p className="text-xs text-text-muted">เลขทะเบียน: {sh.registrationNo}</p>
                          </div>
                        </div>
                        <span className="text-xs text-primary font-semibold">{BigInt(sh.shares).toLocaleString('th-TH')} หุ้น</span>
                      </button>
                    ))}
                  </div>
                )}
                {/* Selected shareholder card */}
                {formData.shareholderId && shareholders.length === 0 && searchTerm && (
                  <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                      <span className="text-primary text-sm font-bold">✓</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{searchTerm}</p>
                      <p className="text-xs text-primary">เลือกแล้ว</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Proxy Type — Card selector */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">ประเภทหนังสือมอบฉันทะ *</label>
                <div className="grid grid-cols-3 gap-2">
                  {PROXY_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setFormData((p) => ({ ...p, proxyType: t.value }))}
                      className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
                        formData.proxyType === t.value
                          ? 'border-primary bg-primary/10 shadow-sm shadow-primary/10'
                          : 'border-border/50 hover:border-border hover:bg-bg-hover/30'
                      }`}
                    >
                      <p className="text-base mb-0.5">{t.icon}</p>
                      <p className={`text-sm font-bold ${
                        formData.proxyType === t.value ? 'text-primary' : 'text-text-primary'
                      }`}>{t.label}</p>
                      <p className="text-[10px] text-text-muted mt-0.5 leading-tight">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Proxy Name */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">ชื่อผู้รับมอบฉันทะ *</label>
                <input
                  type="text"
                  value={formData.proxyName}
                  onChange={(e) => setFormData((p) => ({ ...p, proxyName: e.target.value }))}
                  className="input-field"
                  placeholder="ชื่อ-นามสกุล ผู้รับมอบฉันทะ"
                />
              </div>

              {/* Proxy ID Card */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">เลขบัตรประชาชนผู้รับมอบ</label>
                <input
                  type="text"
                  value={formData.proxyIdCard}
                  onChange={(e) => setFormData((p) => ({ ...p, proxyIdCard: e.target.value }))}
                  className="input-field"
                  placeholder="(ไม่บังคับ)"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium cursor-pointer hover:bg-bg-hover transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white text-sm font-bold shadow-lg shadow-violet-500/25 disabled:opacity-50 cursor-pointer hover:shadow-xl transition-all"
              >
                <Save className="w-4 h-4" />
                {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
