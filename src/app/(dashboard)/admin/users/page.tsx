'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  X,
  Save,
  Loader2,
  AlertCircle,
  Shield,
  UserCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  companyId: string | null;
  company?: { nameTh: string } | null;
  createdAt: string;
}

interface Company {
  id: string;
  nameTh: string;
}

interface UserForm {
  username: string;
  password: string;
  displayName: string;
  role: string;
  companyId: string;
  isActive: boolean;
}

const emptyForm: UserForm = {
  username: '',
  password: '',
  displayName: '',
  role: 'REGISTRATION_STAFF',
  companyId: '',
  isActive: true,
};

const ROLES = [
  { value: 'SUPER_ADMIN', label: 'ผู้ดูแลระบบสูงสุด', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  { value: 'SYSTEM_ADMIN', label: 'ผู้จัดการระบบ', color: 'bg-violet-500/15 text-violet-400 border-violet-500/20' },
  { value: 'REGISTRATION_STAFF', label: 'เจ้าหน้าที่ลงทะเบียน', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { value: 'TALLYING_STAFF', label: 'เจ้าหน้าที่นับคะแนน', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  { value: 'CHAIRMAN', label: 'ประธาน / พิธีกร', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  { value: 'AUDITOR', label: 'ผู้ตรวจสอบ', color: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
];

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, companiesRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/companies'),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (companiesRes.ok) setCompanies(await companiesRes.json());
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowPassword(false);
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: '', // empty = don't change
      displayName: user.displayName,
      role: user.role,
      companyId: user.companyId || '',
      isActive: user.isActive,
    });
    setError('');
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const url = editingId ? `/api/users/${editingId}` : '/api/users';
      const method = editingId ? 'PUT' : 'POST';

      const payload: Record<string, unknown> = {
        displayName: form.displayName,
        role: form.role,
        companyId: form.companyId || null,
        isActive: form.isActive,
      };

      if (!editingId) {
        payload.username = form.username;
        payload.password = form.password;
      } else if (form.password) {
        payload.password = form.password;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'เกิดข้อผิดพลาด');
        return;
      }

      setShowModal(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchData();
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'ไม่สามารถลบได้');
        return;
      }
      setDeleteConfirm(null);
      fetchData();
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const getRoleInfo = (role: string) => ROLES.find(r => r.value === role) || ROLES[0];

  const filtered = users.filter(
    (u) =>
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      getRoleInfo(u.role).label.includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Users className="w-5 h-5 text-white" />
            </div>
            จัดการผู้ใช้งาน
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            เพิ่ม แก้ไข หรือจัดการสิทธิ์ผู้ใช้ระบบ (6 Roles)
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white gradient-primary hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          เพิ่มผู้ใช้
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
          placeholder="ค้นหาผู้ใช้..."
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-card-light p-3 text-center">
          <p className="text-2xl font-bold text-primary">{users.length}</p>
          <p className="text-xs text-text-muted">ผู้ใช้ทั้งหมด</p>
        </div>
        <div className="glass-card-light p-3 text-center">
          <p className="text-2xl font-bold text-emerald-400">{users.filter(u => u.isActive).length}</p>
          <p className="text-xs text-text-muted">Active</p>
        </div>
        <div className="glass-card-light p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{users.filter(u => !u.isActive).length}</p>
          <p className="text-xs text-text-muted">Inactive</p>
        </div>
        <div className="glass-card-light p-3 text-center">
          <p className="text-2xl font-bold text-violet-400">{new Set(users.map(u => u.role)).size}</p>
          <p className="text-xs text-text-muted">Roles ที่ใช้</p>
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Users className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            {search ? 'ไม่พบผู้ใช้ที่ค้นหา' : 'ยังไม่มีผู้ใช้'}
          </h3>
          <p className="text-sm text-text-secondary">
            {search ? 'ลองค้นหาด้วยคำอื่น' : 'กดปุ่ม "เพิ่มผู้ใช้" เพื่อเริ่มต้น'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((user, i) => {
            const roleInfo = getRoleInfo(user.role);
            return (
              <div
                key={user.id}
                className={`glass-card-light p-4 transition-all duration-200 animate-fade-in stagger-${(i % 5) + 1} ${
                  !user.isActive ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      user.isActive ? 'bg-primary/10' : 'bg-bg-tertiary'
                    }`}>
                      <Shield className={`w-5 h-5 ${user.isActive ? 'text-primary' : 'text-text-muted'}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h3 className="font-semibold text-text-primary">{user.displayName}</h3>
                        <span className={`badge border text-xs ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                        {!user.isActive && (
                          <span className="badge bg-danger/15 text-danger border border-danger/20 text-xs">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-muted">
                        <span>@{user.username}</span>
                        {user.company && <span>• {user.company.nameTh}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Toggle Active */}
                    <button
                      onClick={() => handleToggleActive(user)}
                      className={`p-2 rounded-lg transition-colors cursor-pointer ${
                        user.isActive
                          ? 'hover:bg-warning/10 text-text-muted hover:text-warning'
                          : 'hover:bg-success/10 text-text-muted hover:text-success'
                      }`}
                      title={user.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    >
                      <UserCheck className="w-4 h-4" />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-primary transition-colors cursor-pointer"
                      title="แก้ไข"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => setDeleteConfirm(user.id)}
                      className="p-2 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors cursor-pointer"
                      title="ลบ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation */}
                {deleteConfirm === user.id && (
                  <div className="mt-3 p-3 rounded-xl bg-danger/10 border border-danger/20 animate-fade-in">
                    <p className="text-xs text-danger mb-3">
                      ยืนยันการลบ &quot;{user.displayName}&quot; (@{user.username}) ?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(user.id)}
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
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">
                {editingId ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
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

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  ชื่อผู้ใช้ (Username) <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted text-sm transition-all"
                  placeholder="เช่น staff01"
                  required={!editingId}
                  disabled={!!editingId}
                />
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  ชื่อที่แสดง <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted text-sm transition-all"
                  placeholder="เช่น คุณสมศรี"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  รหัสผ่าน {editingId ? '(เว้นว่างถ้าไม่ต้องการเปลี่ยน)' : <span className="text-danger">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-4 py-2.5 pr-12 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted text-sm transition-all"
                    placeholder={editingId ? 'เว้นว่างถ้าไม่เปลี่ยน' : 'ตั้งรหัสผ่าน'}
                    required={!editingId}
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  สิทธิ์การใช้งาน (Role) <span className="text-danger">*</span>
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary text-sm transition-all"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              {/* Company (optional) */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  บริษัท (ไม่บังคับ)
                </label>
                <select
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary text-sm transition-all"
                >
                  <option value="">— ไม่ระบุ —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.nameTh}</option>
                  ))}
                </select>
              </div>

              {/* isActive */}
              {editingId && (
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-bg-tertiary peer-focus:ring-2 peer-focus:ring-primary/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                  <span className="text-sm text-text-secondary">{form.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                </div>
              )}

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
                  {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'สร้างผู้ใช้'}
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
