'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Calendar,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  nameTh: string;
  logoUrl?: string;
  directors?: string;
  address?: string;
  taxId?: string;
  createdAt: string;
  _count?: { events: number };
}

interface CompanyForm {
  name: string;
  nameTh: string;
  logoUrl: string;
  address: string;
  taxId: string;
}

const emptyForm: CompanyForm = {
  name: '',
  nameTh: '',
  logoUrl: '',
  address: '',
  taxId: '',
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const url = editingId ? `/api/companies/${editingId}` : '/api/companies';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'เกิดข้อผิดพลาด');
        return;
      }

      setShowModal(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchCompanies();
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (company: Company) => {
    setEditingId(company.id);
    setForm({
      name: company.name,
      nameTh: company.nameTh,
      logoUrl: company.logoUrl || '',
      address: company.address || '',
      taxId: company.taxId || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/companies/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'ไม่สามารถลบได้');
        return;
      }
      setDeleteConfirm(null);
      fetchCompanies();
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const openNewModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.nameTh.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <Building2 className="w-7 h-7 text-primary" />
            จัดการบริษัทลูกค้า
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            เพิ่ม แก้ไข หรือลบข้อมูลบริษัทลูกค้า (Tenant)
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white gradient-primary hover:opacity-90 shadow-lg shadow-primary/20 transition-all duration-200 active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          เพิ่มบริษัท
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-bg-secondary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted transition-all"
          placeholder="ค้นหาบริษัท..."
        />
      </div>

      {/* Company Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Building2 className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            {search ? 'ไม่พบบริษัทที่ค้นหา' : 'ยังไม่มีบริษัทลูกค้า'}
          </h3>
          <p className="text-sm text-text-secondary">
            {search ? 'ลองค้นหาด้วยคำอื่น' : 'กดปุ่ม "เพิ่มบริษัท" เพื่อเริ่มต้น'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((company, i) => (
            <div
              key={company.id}
              className={`glass-card-light p-5 hover:border-primary/30 transition-all duration-200 animate-fade-in stagger-${(i % 5) + 1}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {company.logoUrl ? (
                      <img
                        src={company.logoUrl}
                        alt={company.name}
                        className="w-7 h-7 rounded-lg object-contain"
                      />
                    ) : (
                      <Building2 className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-text-primary text-sm truncate">
                      {company.nameTh}
                    </h3>
                    <p className="text-xs text-text-muted truncate">{company.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(company)}
                    className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-primary transition-colors cursor-pointer"
                    title="แก้ไข"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(company.id)}
                    className="p-2 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors cursor-pointer"
                    title="ลบ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {company._count?.events || 0} งานประชุม
                </span>
                {company.taxId && (
                  <span className="truncate">Tax: {company.taxId}</span>
                )}
              </div>

              {/* Delete Confirmation */}
              {deleteConfirm === company.id && (
                <div className="mt-4 p-3 rounded-xl bg-danger/10 border border-danger/20 animate-fade-in">
                  <p className="text-xs text-danger mb-3">
                    ยืนยันการลบ &quot;{company.nameTh}&quot; ?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(company.id)}
                      className="px-3 py-1.5 rounded-lg bg-danger text-white text-xs font-medium hover:bg-danger/90 transition-colors cursor-pointer"
                    >
                      ยืนยันลบ
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 rounded-lg bg-bg-tertiary text-text-secondary text-xs hover:bg-bg-hover transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">
                {editingId ? 'แก้ไขบริษัท' : 'เพิ่มบริษัทใหม่'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg hover:bg-bg-hover text-text-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  ชื่อบริษัท (ภาษาไทย) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={form.nameTh}
                  onChange={(e) => setForm({ ...form, nameTh: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted text-sm transition-all"
                  placeholder="เช่น บริษัท สมาร์ท เทค จำกัด (มหาชน)"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  ชื่อบริษัท (English) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted text-sm transition-all"
                  placeholder="e.g., Smart Tech Public Company Limited"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  เลขประจำตัวผู้เสียภาษี
                </label>
                <input
                  type="text"
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted text-sm transition-all"
                  placeholder="เลข 13 หลัก"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  ที่อยู่
                </label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted text-sm transition-all resize-none"
                  rows={3}
                  placeholder="ที่อยู่จดทะเบียนบริษัท"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  URL โลโก้
                </label>
                <input
                  type="url"
                  value={form.logoUrl}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted text-sm transition-all"
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-white gradient-primary hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 rounded-xl font-medium text-text-secondary bg-bg-tertiary hover:bg-bg-hover border border-border transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
