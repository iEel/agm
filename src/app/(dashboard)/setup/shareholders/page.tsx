'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/lib/session-context';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Upload,
  Edit3,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  X,
  Save,
  ChevronLeft,
  ChevronRight,
  Download,
  Users,
} from 'lucide-react';

interface Shareholder {
  id: string;
  registrationNo: string;
  titleTh: string | null;
  firstNameTh: string;
  lastNameTh: string;
  titleEn: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  idCard: string;
  shares: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ShareholderPage() {
  const { activeEvent } = useSession();
  const [shareholders, setShareholders] = useState<Shareholder[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingShareholder, setEditingShareholder] = useState<Shareholder | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    totalRows: number;
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    registrationNo: '',
    titleTh: '',
    firstNameTh: '',
    lastNameTh: '',
    titleEn: '',
    firstNameEn: '',
    lastNameEn: '',
    idCard: '',
    shares: '',
  });

  const fetchShareholders = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/shareholders?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setShareholders(data.shareholders || []);
      setPagination(data.pagination);
    } catch {
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchShareholders();
  }, [fetchShareholders]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchShareholders(1);
  };

  const clearSearch = () => {
    setSearch('');
  };

  const openCreateModal = () => {
    setEditingShareholder(null);
    setFormData({ registrationNo: '', titleTh: '', firstNameTh: '', lastNameTh: '', titleEn: '', firstNameEn: '', lastNameEn: '', idCard: '', shares: '' });
    setShowModal(true);
    setError('');
  };

  const openEditModal = (sh: Shareholder) => {
    setEditingShareholder(sh);
    setFormData({
      registrationNo: sh.registrationNo,
      titleTh: sh.titleTh || '',
      firstNameTh: sh.firstNameTh,
      lastNameTh: sh.lastNameTh,
      titleEn: sh.titleEn || '',
      firstNameEn: sh.firstNameEn || '',
      lastNameEn: sh.lastNameEn || '',
      idCard: sh.idCard,
      shares: String(sh.shares),
    });
    setShowModal(true);
    setError('');
  };

  const handleSave = async () => {
    if (!formData.registrationNo || !formData.firstNameTh || !formData.lastNameTh || !formData.shares) {
      setError('กรุณากรอกข้อมูลที่จำเป็น');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = editingShareholder ? `/api/shareholders/${editingShareholder.id}` : '/api/shareholders';
      const method = editingShareholder ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'เกิดข้อผิดพลาด');
        return;
      }
      setShowModal(false);
      fetchShareholders(pagination.page);
    } catch {
      setError('เกิดข้อผิดพลาด');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบผู้ถือหุ้นนี้?')) return;
    try {
      const res = await fetch(`/api/shareholders/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'ไม่สามารถลบได้');
        return;
      }
      fetchShareholders(pagination.page);
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handleFileImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/shareholders/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setImportResult({ success: false, totalRows: 0, created: 0, updated: 0, errors: [data.error || 'เกิดข้อผิดพลาด'] });
      } else {
        setImportResult(data);
        fetchShareholders(1);
      }
    } catch {
      setImportResult({ success: false, totalRows: 0, created: 0, updated: 0, errors: ['เกิดข้อผิดพลาดในการอัปโหลด'] });
    } finally {
      setImporting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileImport(file);
  };

  const formatShares = (n: string | number) => BigInt(n).toLocaleString('th-TH');
  const maskId = (id: string) => id ? `${id.slice(0, 4)}****${id.slice(-4)}` : '-';
  const fullNameTh = (sh: Shareholder) => `${sh.titleTh || ''} ${sh.firstNameTh} ${sh.lastNameTh}`.trim();
  const fullNameEn = (sh: Shareholder) => [sh.titleEn, sh.firstNameEn, sh.lastNameEn].filter(Boolean).join(' ');

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">ไม่มีงานประชุมที่ Active</h2>
        <p className="text-sm text-text-secondary">กรุณาเปิดใช้งานงานประชุมก่อน</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            ข้อมูลผู้ถือหุ้น
          </h1>
          <p className="text-sm text-text-secondary mt-1">จัดการข้อมูลผู้ถือหุ้นสำหรับ {activeEvent.name}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowImport(true); setImportResult(null); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-sm font-medium hover:bg-emerald-500/25 transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            นำเข้า Excel/CSV
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-primary/25 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            เพิ่มผู้ถือหุ้น
          </button>
        </div>
      </div>

      {/* Search + Stats */}
      <div className="glass-card p-4 space-y-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, นามสกุล, เลขทะเบียน, เลขประจำตัว..."
            className="w-full pl-12 pr-24 py-3 bg-bg-tertiary border border-border rounded-2xl text-text-primary text-sm placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                title="ล้างการค้นหา"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl gradient-primary text-white text-xs font-medium shadow-sm shadow-primary/20 cursor-pointer hover:shadow-md hover:shadow-primary/30 transition-all"
            >
              ค้นหา
            </button>
          </div>
        </form>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            <span>ทั้งหมด <strong className="text-text-primary text-sm">{pagination.total.toLocaleString('th-TH')}</strong> ราย</span>
          </div>
          {search && (
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
              กำลังค้นหา: &ldquo;{search}&rdquo;
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="glass-card p-12 text-center">
          <div className="animate-pulse-glow w-12 h-12 rounded-xl bg-bg-tertiary mx-auto mb-4" />
          <p className="text-text-muted text-sm">กำลังโหลด...</p>
        </div>
      ) : shareholders.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileSpreadsheet className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">ยังไม่มีข้อมูลผู้ถือหุ้น</h3>
          <p className="text-sm text-text-secondary">นำเข้าจากไฟล์ Excel/CSV หรือเพิ่มทีละรายการ</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3">ลำดับ</th>
                  <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3">ชื่อ-นามสกุล</th>
                  <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3">เลขประจำตัว</th>
                  <th className="text-right text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3">จำนวนหุ้น</th>
                  <th className="text-center text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3 w-24">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {shareholders.map((sh) => (
                  <tr key={sh.id} className="border-b border-border/50 hover:bg-bg-hover/50 transition-colors">
                    <td className="px-4 py-3"><span className="text-sm font-mono text-text-muted">{sh.registrationNo}</span></td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-text-primary">{fullNameTh(sh)}</p>
                      {fullNameEn(sh) && <p className="text-xs text-text-muted">{fullNameEn(sh)}</p>}
                    </td>
                    <td className="px-4 py-3"><span className="text-sm text-text-secondary font-mono">{maskId(sh.idCard)}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-sm font-semibold text-text-primary">{formatShares(sh.shares)}</span></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEditModal(sh)} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-primary transition-colors cursor-pointer">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(sh.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-text-muted">
                แสดง {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} จาก {pagination.total}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => fetchShareholders(pagination.page - 1)} disabled={pagination.page <= 1} className="p-2 rounded-lg hover:bg-bg-hover text-text-muted disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm text-text-secondary">{pagination.page} / {pagination.totalPages}</span>
                <button onClick={() => fetchShareholders(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="p-2 rounded-lg hover:bg-bg-hover text-text-muted disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowImport(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" /> นำเข้าข้อมูลผู้ถือหุ้น
              </h2>
              <button onClick={() => setShowImport(false)} className="p-2 rounded-lg hover:bg-bg-hover text-text-muted cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {!importResult && (
              <>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
                    ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}
                    ${importing ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleFileImport(f); e.target.value=''; }} className="hidden" />
                  {importing ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse-glow"><Upload className="w-6 h-6 text-primary" /></div>
                      <p className="text-sm text-text-secondary">กำลังนำเข้า...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center"><Download className="w-7 h-7 text-emerald-400" /></div>
                      <p className="text-sm font-medium text-text-primary">ลากไฟล์มาวาง หรือ <span className="text-primary">เลือกไฟล์</span></p>
                      <p className="text-xs text-text-muted">.xlsx, .xls, .csv</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-3">
                  {/* Template Download */}
                  <a
                    href="/api/shareholders/template"
                    download
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-sm font-medium hover:bg-emerald-500/25 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    ดาวน์โหลด Template (.xlsx)
                  </a>
                  <div className="p-3 rounded-lg bg-bg-tertiary/50">
                    <p className="text-xs font-semibold text-text-secondary mb-2">คอลัมน์ที่รองรับ:</p>
                    <div className="grid grid-cols-2 gap-1 text-xs text-text-muted">
                      <span>• เลขทะเบียน *</span>
                      <span>• คำนำหน้า</span>
                      <span>• ชื่อ *</span>
                      <span>• นามสกุล</span>
                      <span>• เลขประจำตัว (บัตร ปชช./ภาษี/พาสปอร์ต)</span>
                      <span>• จำนวนหุ้น *</span>
                      <span>• Title (EN)</span>
                      <span>• First/Last Name (EN)</span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-2">* = จำเป็น | เลขทะเบียนซ้ำ = อัปเดตข้อมูลเดิม</p>
                  </div>
                </div>
              </>
            )}

            {importResult && (
              <div className="space-y-4">
                <div className={`p-4 rounded-xl flex items-center gap-3 ${importResult.success ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-danger/10 border border-danger/20'}`}>
                  {importResult.success ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <XCircle className="w-6 h-6 text-danger" />}
                  <div>
                    <p className="text-sm font-medium text-text-primary">{importResult.success ? 'นำเข้าสำเร็จ' : 'เกิดข้อผิดพลาด'}</p>
                    {importResult.success && (
                      <p className="text-xs text-text-secondary mt-0.5">ทั้งหมด {importResult.totalRows} แถว — เพิ่ม {importResult.created}, อัปเดต {importResult.updated}{importResult.errors.length > 0 && `, ผิดพลาด ${importResult.errors.length}`}</p>
                    )}
                  </div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="max-h-40 overflow-y-auto p-3 rounded-lg bg-bg-tertiary/50 space-y-1">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-danger/80 flex items-start gap-1.5"><XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />{err}</p>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <button onClick={() => setImportResult(null)} className="px-4 py-2 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium cursor-pointer">นำเข้าอีกครั้ง</button>
                  <button onClick={() => setShowImport(false)} className="px-4 py-2 rounded-xl gradient-primary text-white text-sm font-medium cursor-pointer">ปิด</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-primary">{editingShareholder ? 'แก้ไขผู้ถือหุ้น' : 'เพิ่มผู้ถือหุ้นใหม่'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-bg-hover text-text-muted cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">เลขทะเบียน *</label>
                <input type="text" value={formData.registrationNo} onChange={(e) => setFormData((p) => ({ ...p, registrationNo: e.target.value }))} className="input-field" placeholder="001" />
              </div>

              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider pt-2">ภาษาไทย</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">คำนำหน้า</label>
                  <input type="text" value={formData.titleTh} onChange={(e) => setFormData((p) => ({ ...p, titleTh: e.target.value }))} className="input-field" placeholder="นาย" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">ชื่อ *</label>
                  <input type="text" value={formData.firstNameTh} onChange={(e) => setFormData((p) => ({ ...p, firstNameTh: e.target.value }))} className="input-field" placeholder="สมชาย" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">นามสกุล *</label>
                  <input type="text" value={formData.lastNameTh} onChange={(e) => setFormData((p) => ({ ...p, lastNameTh: e.target.value }))} className="input-field" placeholder="ใจดี" />
                </div>
              </div>

              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider pt-2">English</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">Title</label>
                  <input type="text" value={formData.titleEn} onChange={(e) => setFormData((p) => ({ ...p, titleEn: e.target.value }))} className="input-field" placeholder="Mr." />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">First Name</label>
                  <input type="text" value={formData.firstNameEn} onChange={(e) => setFormData((p) => ({ ...p, firstNameEn: e.target.value }))} className="input-field" placeholder="Somchai" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Last Name</label>
                  <input type="text" value={formData.lastNameEn} onChange={(e) => setFormData((p) => ({ ...p, lastNameEn: e.target.value }))} className="input-field" placeholder="Jaidee" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">เลขประจำตัว</label>
                  <input type="text" value={formData.idCard} onChange={(e) => setFormData((p) => ({ ...p, idCard: e.target.value }))} className="input-field" placeholder="บัตร ปชช. / เลขภาษี / พาสปอร์ต" maxLength={20} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">จำนวนหุ้น *</label>
                  <input type="number" value={formData.shares} onChange={(e) => setFormData((p) => ({ ...p, shares: e.target.value }))} className="input-field" placeholder="1000" min="1" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium cursor-pointer">ยกเลิก</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-primary/25 disabled:opacity-50 cursor-pointer">
                <Save className="w-4 h-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
