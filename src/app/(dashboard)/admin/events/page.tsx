'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Search,
  Zap,
  ZapOff,
  Building2,
  Users,
  ListOrdered,
  X,
  Save,
  Loader2,
  AlertCircle,
  Clock,
  MapPin,
  Edit3,
  Trash2,
  ChevronRight,
  Play,
  Vote,
  Square,
  RotateCcw,
  Bomb,
  ShieldAlert,
} from 'lucide-react';

interface Event {
  id: string;
  companyId: string;
  name: string;
  type: string;
  date: string;
  venue?: string;
  isActive: boolean;
  status: string;
  totalShares: string;
  company: { name: string; nameTh: string; logoUrl?: string };
  _count: { shareholders: number; agendas: number; registrations: number };
}

interface Company {
  id: string;
  name: string;
  nameTh: string;
}

interface EventForm {
  companyId: string;
  name: string;
  type: string;
  date: string;
  venue: string;
  totalShares: string;
}

const emptyForm: EventForm = {
  companyId: '',
  name: '',
  type: 'AGM',
  date: '',
  venue: '',
  totalShares: '',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  REGISTRATION: 'bg-info/15 text-info border-info/20',
  VOTING: 'bg-warning/15 text-warning border-warning/20',
  CLOSED: 'bg-success/15 text-success border-success/20',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'ร่าง',
  REGISTRATION: 'เปิดลงทะเบียน',
  VOTING: 'กำลังลงคะแนน',
  CLOSED: 'ปิดการประชุม',
};

// Status flow: DRAFT → REGISTRATION → VOTING → CLOSED
const STATUS_FLOW: Record<string, { next: string; label: string; confirm: string; color: string; icon: typeof Play }> = {
  DRAFT: {
    next: 'REGISTRATION',
    label: 'เปิดลงทะเบียน',
    confirm: 'ยืนยันเปิดลงทะเบียน?',
    color: 'bg-info/15 text-info border-info/30 hover:bg-info/25',
    icon: Play,
  },
  REGISTRATION: {
    next: 'VOTING',
    label: 'เริ่มลงคะแนน',
    confirm: 'ยืนยันเริ่มลงคะแนนเสียง? (ผู้ถือหุ้นยังสามารถลงทะเบียนเพิ่มได้ระหว่างประชุม)',
    color: 'bg-warning/15 text-warning border-warning/30 hover:bg-warning/25',
    icon: Vote,
  },
  VOTING: {
    next: 'CLOSED',
    label: 'ปิดการประชุม',
    confirm: 'ยืนยันปิดการประชุม? (ไม่สามารถกลับมาเปิดได้)',
    color: 'bg-danger/15 text-danger border-danger/30 hover:bg-danger/25',
    icon: Square,
  },
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activating, setActivating] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);

  // Clear data state
  const [clearModal, setClearModal] = useState<{ eventId: string; eventName: string; level: 'session' | 'all' } | null>(null);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [eventsRes, companiesRes] = await Promise.all([
        fetch('/api/events'),
        fetch('/api/companies'),
      ]);
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (companiesRes.ok) setCompanies(await companiesRes.json());
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (event: Event) => {
    setEditingId(event.id);
    setForm({
      companyId: event.companyId,
      name: event.name,
      type: event.type,
      date: new Date(new Date(event.date).getTime() - new Date(event.date).getTimezoneOffset() * 60000).toISOString().slice(0, 16),
      venue: event.venue || '',
      totalShares: event.totalShares,
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const url = editingId ? `/api/events/${editingId}` : '/api/events';
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
      fetchData();
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: Event) => {
    if (event.isActive) {
      alert('ไม่สามารถลบงานที่ Active ได้');
      return;
    }
    if (!confirm(`ยืนยันการลบ "${event.name}"?`)) return;

    try {
      const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'ไม่สามารถลบได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handleActivate = async (eventId: string) => {
    setActivating(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/activate`, { method: 'POST' });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch {
      alert('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setActivating(null);
    }
  };

  const handleStatusChange = async (event: Event) => {
    const flow = STATUS_FLOW[event.status];
    if (!flow) return;
    if (!confirm(flow.confirm)) return;

    setChangingStatus(event.id);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: flow.next }),
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'ไม่สามารถเปลี่ยนสถานะได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setChangingStatus(null);
    }
  };

  const openClearModal = (event: Event, level: 'session' | 'all') => {
    setClearModal({ eventId: event.id, eventName: event.name, level });
    setClearConfirmText('');
  };

  const handleClear = async () => {
    if (!clearModal) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/events/${clearModal.eventId}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: clearModal.level }),
      });
      const data = await res.json();
      if (res.ok) {
        setClearModal(null);
        fetchData();
        alert(data.message);
      } else {
        alert(data.error || 'ไม่สามารถล้างข้อมูลได้');
      }
    } catch {
      alert('เกิดข้อผิดพลาด');
    } finally {
      setClearing(false);
    }
  };

  const filtered = events.filter(
    (ev) =>
      ev.name.toLowerCase().includes(search.toLowerCase()) ||
      ev.company.nameTh.includes(search) ||
      ev.company.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const timePart = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    return `${datePart}  เวลา ${timePart} น.`;
  };

  const formatShares = (shares: string) => {
    return Number(shares).toLocaleString('th-TH');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            จัดการงานประชุม
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            สร้างรอบการประชุม (AGM/EGM) และตั้งค่า Active Event
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white gradient-primary hover:opacity-90 shadow-lg shadow-primary/20 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          สร้างงานประชุม
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
          placeholder="ค้นหางานประชุม..."
        />
      </div>

      {/* Events List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Calendar className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            {search ? 'ไม่พบงานประชุมที่ค้นหา' : 'ยังไม่มีงานประชุม'}
          </h3>
          <p className="text-sm text-text-secondary">
            {search ? 'ลองค้นหาด้วยคำอื่น' : 'กดปุ่ม "สร้างงานประชุม" เพื่อเริ่มต้น'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((event, i) => (
            <div
              key={event.id}
              className={`glass-card-light p-5 transition-all duration-200 animate-fade-in stagger-${(i % 5) + 1} ${
                event.isActive
                  ? 'border-primary/40 shadow-lg shadow-primary/10'
                  : 'hover:border-border'
              }`}
            >
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    event.isActive ? 'gradient-primary shadow-md shadow-primary/25' : 'bg-bg-tertiary'
                  }`}>
                    <Calendar className={`w-6 h-6 ${event.isActive ? 'text-white' : 'text-text-muted'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-text-primary">{event.name}</h3>
                      <span className={`badge border ${STATUS_COLORS[event.status] || STATUS_COLORS.DRAFT}`}>
                        {STATUS_LABELS[event.status] || event.status}
                      </span>
                      {event.isActive && (
                        <span className="badge bg-primary/15 text-primary border border-primary/25">
                          <Zap className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-text-secondary mb-2">
                      <Building2 className="w-3.5 h-3.5" />
                      {event.company.nameTh}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(event.date)}
                      </span>
                      {event.venue && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {event.venue}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-3 text-xs text-text-secondary mr-2">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {event._count.shareholders}
                    </span>
                    <span className="flex items-center gap-1">
                      <ListOrdered className="w-3.5 h-3.5" />
                      {event._count.agendas}
                    </span>
                    {event.totalShares !== '0' && (
                      <span className="text-text-muted">
                        {formatShares(event.totalShares)} หุ้น
                      </span>
                    )}
                  </div>

                  {/* Edit */}
                  <button
                    onClick={() => openEditModal(event)}
                    className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-primary transition-colors cursor-pointer"
                    title="แก้ไข"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(event)}
                    disabled={event.isActive}
                    className="p-2 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    title={event.isActive ? 'ไม่สามารถลบงาน Active ได้' : 'ลบ'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  {/* Status Transition */}
                  {STATUS_FLOW[event.status] && event.isActive && (
                    <button
                      onClick={() => handleStatusChange(event)}
                      disabled={changingStatus === event.id}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer disabled:opacity-50 ${STATUS_FLOW[event.status].color}`}
                    >
                      {changingStatus === event.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>{(() => { const Icon = STATUS_FLOW[event.status].icon; return <Icon className="w-4 h-4" />; })()}</>
                      )}
                      {STATUS_FLOW[event.status].label}
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}

                  {/* Activate */}
                  <button
                    onClick={() => handleActivate(event.id)}
                    disabled={event.isActive || activating === event.id}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed ${
                      event.isActive
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-bg-tertiary text-text-secondary hover:bg-primary/10 hover:text-primary border border-border hover:border-primary/30'
                    }`}
                  >
                    {activating === event.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : event.isActive ? (
                      <Zap className="w-4 h-4" />
                    ) : (
                      <ZapOff className="w-4 h-4" />
                    )}
                    {event.isActive ? 'Active' : 'Set Active'}
                  </button>
                </div>

              {/* Danger Zone — only for active events */}
              {event.isActive && (
                <div className="mt-3 pt-3 border-t border-border/30">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">โซนอันตราย</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                      <button
                        onClick={() => openClearModal(event, 'session')}
                        className="flex items-center gap-1.5 text-amber-400 text-xs font-bold cursor-pointer hover:text-amber-300 transition-colors mb-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        ล้างข้อมูลรอบประชุม
                      </button>
                      <p className="text-[10px] text-text-muted leading-relaxed">
                        ลบลงทะเบียน, โหวต, บัตร, มอบฉันทะ — เก็บวาระ + ผู้ถือหุ้นไว้ (เหมาะสำหรับเริ่มประชุมใหม่)
                      </p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-danger/5 border border-danger/15">
                      <button
                        onClick={() => openClearModal(event, 'all')}
                        className="flex items-center gap-1.5 text-danger text-xs font-bold cursor-pointer hover:text-red-300 transition-colors mb-1"
                      >
                        <Bomb className="w-3.5 h-3.5" />
                        ล้างทั้งหมด
                      </button>
                      <p className="text-[10px] text-text-muted leading-relaxed">
                        ลบทุกอย่างรวมวาระ + ผู้ถือหุ้น — เหลือแค่ Users + Companies (เหมาะสำหรับตั้งค่าระบบใหม่)
                      </p>
                    </div>
                  </div>
                </div>
              )}
              </div>
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
                {editingId ? 'แก้ไขงานประชุม' : 'สร้างงานประชุมใหม่'}
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
                  บริษัท <span className="text-danger">*</span>
                </label>
                <select
                  value={form.companyId}
                  onChange={(e) => setForm({ ...form, companyId: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary text-sm transition-all"
                  required
                  disabled={!!editingId}
                >
                  <option value="">— เลือกบริษัท —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameTh}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    ชื่อรอบประชุม <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted text-sm transition-all"
                    placeholder="เช่น AGM 2569"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">
                    ประเภท <span className="text-danger">*</span>
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary text-sm transition-all"
                  >
                    <option value="AGM">AGM — ประชุมสามัญ</option>
                    <option value="EGM">EGM — ประชุมวิสามัญ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  วันเวลาจัดงาน <span className="text-danger">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary text-sm transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  สถานที่
                </label>
                <input
                  type="text"
                  value={form.venue}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted text-sm transition-all"
                  placeholder="เช่น ห้องประชุม Grand Ballroom"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  จำนวนหุ้นทั้งหมด
                </label>
                <input
                  type="number"
                  value={form.totalShares}
                  onChange={(e) => setForm({ ...form, totalShares: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-tertiary border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-text-primary placeholder-text-muted text-sm transition-all"
                  placeholder="จำนวนหุ้นทั้งหมดที่จดทะเบียน"
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
                  {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'สร้างงานประชุม'}
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
      {/* Clear Data Confirm Modal */}
      {clearModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md animate-fade-in">
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${clearModal.level === 'all' ? 'bg-danger/15' : 'bg-amber-500/15'}`}>
                  <ShieldAlert className={`w-5 h-5 ${clearModal.level === 'all' ? 'text-danger' : 'text-amber-400'}`} />
                </div>
                <h2 className="text-lg font-bold text-text-primary">
                  {clearModal.level === 'all' ? 'ล้างข้อมูลทั้งหมด' : 'ล้างข้อมูลรอบประชุม'}
                </h2>
              </div>
              <p className="text-sm text-text-secondary">
                {clearModal.eventName}
              </p>
            </div>
            <div className="p-6 space-y-4">
              {clearModal.level === 'session' ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">ข้อมูลที่จะถูกลบ:</p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    <li>การลงทะเบียนทั้งหมด</li>
                    <li>ผลโหวต + บัตรลงคะแนน + Snapshot</li>
                    <li>การมอบฉันทะทั้งหมด</li>
                    <li>Audit Log</li>
                  </ul>
                  <p className="mt-2 font-bold text-emerald-700 dark:text-emerald-300">✅ เก็บไว้: วาระ + ข้อมูลผู้ถือหุ้น</p>
                  <p>สถานะจะ reset เป็น DRAFT</p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-xs text-red-800 dark:text-red-200 space-y-1">
                  <p className="font-bold">ข้อมูลที่จะถูกลบทั้งหมด:</p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    <li>การลงทะเบียน + ผลโหวต + บัตร</li>
                    <li>การมอบฉันทะ</li>
                    <li><strong>วาระทั้งหมด + วาระย่อย</strong></li>
                    <li><strong>ข้อมูลผู้ถือหุ้นทั้งหมด</strong></li>
                    <li>Audit Log</li>
                  </ul>
                  <p className="mt-2 font-bold text-emerald-700 dark:text-emerald-300">✅ เก็บไว้: Users + Companies เท่านั้น</p>
                </div>
              )}

              <div>
                <label className="block text-xs text-text-muted mb-1.5">
                  พิมพ์ <span className="font-bold text-text-primary">ยืนยัน</span> เพื่อดำเนินการ
                </label>
                <input
                  type="text"
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-bg-primary border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-danger/50"
                  placeholder="พิมพ์ ยืนยัน ที่นี่"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setClearModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium cursor-pointer hover:bg-bg-hover transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleClear}
                  disabled={clearConfirmText !== 'ยืนยัน' || clearing}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all ${
                    clearModal.level === 'all'
                      ? 'bg-gradient-to-r from-red-600 to-red-500 shadow-lg shadow-red-500/25'
                      : 'bg-gradient-to-r from-amber-600 to-amber-500 shadow-lg shadow-amber-500/25'
                  }`}
                >
                  {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : clearModal.level === 'all' ? <Bomb className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                  {clearing ? 'กำลังลบ...' : 'ยืนยันลบข้อมูล'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
