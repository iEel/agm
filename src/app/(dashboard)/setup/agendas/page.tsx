'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from '@/lib/session-context';
import {
  ListOrdered,
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  GripVertical,
  X,
  Save,
  Layers,
  Play,
  Square,
  Megaphone,
} from 'lucide-react';

// Resolution type config — must match types/index.ts
const RESOLUTION_TYPES = [
  { value: 'INFO', label: 'แจ้งเพื่อทราบ', labelEn: 'Acknowledgement', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  { value: 'MAJORITY', label: 'มติทั่วไป (>50%)', labelEn: 'Majority', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  { value: 'TWO_THIRDS', label: 'มติ 2 ใน 3 (≥66.66%)', labelEn: 'Two-Thirds', color: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  { value: 'SPECIAL', label: 'มติพิเศษ (≥75%)', labelEn: 'Special (3/4)', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  { value: 'ELECTION', label: 'เลือกตั้งกรรมการ', labelEn: 'Election', color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'รอดำเนินการ', color: 'bg-gray-500/15 text-gray-400' },
  OPEN: { label: 'เปิดลงคะแนน', color: 'bg-emerald-500/15 text-emerald-400' },
  CLOSED: { label: 'ปิดลงคะแนน', color: 'bg-red-500/15 text-red-400' },
  ANNOUNCED: { label: 'ประกาศผลแล้ว', color: 'bg-blue-500/15 text-blue-400' },
};

interface SubAgenda {
  id: string;
  orderNo: number;
  title: string;
  titleTh: string;
}

interface Agenda {
  id: string;
  orderNo: number;
  title: string;
  titleTh: string;
  description: string | null;
  resolutionType: string;
  status: string;
  subAgendas: SubAgenda[];
}

export default function AgendaSetupPage() {
  const { activeEvent } = useSession();
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAgenda, setEditingAgenda] = useState<Agenda | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    titleTh: '',
    description: '',
    resolutionType: 'MAJORITY',
  });

  // Sub-agenda form
  const [showSubForm, setShowSubForm] = useState<string | null>(null);
  const [subFormData, setSubFormData] = useState({ title: '', titleTh: '' });

  const fetchAgendas = useCallback(async () => {
    try {
      const res = await fetch('/api/agendas');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAgendas(data.agendas || []);
    } catch {
      setError('ไม่สามารถโหลดข้อมูลวาระได้');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgendas();
  }, [fetchAgendas]);

  const openCreateModal = () => {
    setEditingAgenda(null);
    setFormData({ title: '', titleTh: '', description: '', resolutionType: 'MAJORITY' });
    setShowModal(true);
    setError('');
  };

  const openEditModal = (agenda: Agenda) => {
    setEditingAgenda(agenda);
    setFormData({
      title: agenda.title,
      titleTh: agenda.titleTh,
      description: agenda.description || '',
      resolutionType: agenda.resolutionType,
    });
    setShowModal(true);
    setError('');
  };

  const handleSave = async () => {
    if (!formData.title || !formData.titleTh || !formData.resolutionType) {
      setError('กรุณากรอกข้อมูลที่จำเป็น');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = editingAgenda ? `/api/agendas/${editingAgenda.id}` : '/api/agendas';
      const method = editingAgenda ? 'PUT' : 'POST';

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
      fetchAgendas();
    } catch {
      setError('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('ยืนยันการลบวาระนี้?')) return;

    try {
      const res = await fetch(`/api/agendas/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'ไม่สามารถลบได้');
        return;
      }
      fetchAgendas();
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handleAddSubAgenda = async (agendaId: string) => {
    if (!subFormData.title || !subFormData.titleTh) return;

    try {
      const res = await fetch(`/api/agendas/${agendaId}/sub-agendas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subFormData),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'เกิดข้อผิดพลาด');
        return;
      }

      setShowSubForm(null);
      setSubFormData({ title: '', titleTh: '' });
      fetchAgendas();
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const handleStatusChange = async (agendaId: string, newStatus: string, agendaTitle: string) => {
    const labels: Record<string, string> = {
      OPEN: 'เปิดลงคะแนน',
      CLOSED: 'ปิดลงคะแนน',
      ANNOUNCED: 'ประกาศผล',
    };
    const warnings: Record<string, string> = {
      OPEN: '\n\n⚠️ ระบบจะ:\n• ปลดล็อคสแกนเนอร์\n• แช่แข็งจอองค์ประชุม\n• บันทึกเวลาเปิดวาระ',
      CLOSED: '\n\n⚠️ ระบบจะ:\n• ล็อคสแกนเนอร์\n• ล็อคฐานตัวหาร (Snapshot)\n• รวมคะแนนล่วงหน้า (Pre-vote)\n• คำนวณผลแบบหักลบ\n• ปลดล็อคจอองค์ประชุม',
      ANNOUNCED: '',
    };
    if (!confirm(`ยืนยัน "${labels[newStatus]}" วาระ: ${agendaTitle}?${warnings[newStatus] || ''}`)) return;

    try {
      const res = await fetch(`/api/agendas/${agendaId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'ไม่สามารถเปลี่ยนสถานะได้');
        return;
      }
      fetchAgendas();
    } catch {
      alert('เกิดข้อผิดพลาด');
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getResolutionBadge = (type: string) => {
    const config = RESOLUTION_TYPES.find((t) => t.value === type);
    if (!config) return null;
    return (
      <span className={`badge border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  if (!activeEvent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle className="w-12 h-12 text-text-muted mb-4" />
        <h2 className="text-lg font-semibold text-text-primary mb-2">ไม่มีงานประชุมที่ Active</h2>
        <p className="text-sm text-text-secondary">กรุณาไปที่หน้า &quot;จัดการงานประชุม&quot; เพื่อเปิดใช้งานก่อน</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ListOrdered className="w-5 h-5 text-white" />
            </div>
            ตั้งค่าวาระประชุม
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            จัดการวาระสำหรับ {activeEvent.name}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          เพิ่มวาระ
        </button>
      </div>

      {/* Resolution Type Legend */}
      <div className="glass-card-light p-4">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">ประเภทมติ</p>
        <div className="flex flex-wrap gap-2">
          {RESOLUTION_TYPES.map((t) => (
            <span key={t.value} className={`badge border ${t.color} text-xs`}>
              {t.label} ({t.labelEn})
            </span>
          ))}
        </div>
      </div>

      {/* Agendas List */}
      {loading ? (
        <div className="glass-card p-12 text-center">
          <div className="animate-pulse-glow w-12 h-12 rounded-xl bg-bg-tertiary mx-auto mb-4" />
          <p className="text-text-muted text-sm">กำลังโหลด...</p>
        </div>
      ) : agendas.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <ListOrdered className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">ยังไม่มีวาระ</h3>
          <p className="text-sm text-text-secondary">กดปุ่ม &quot;เพิ่มวาระ&quot; เพื่อเริ่มสร้างวาระประชุม</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agendas.map((agenda, index) => (
            <div
              key={agenda.id}
              className={`glass-card overflow-hidden animate-fade-in stagger-${Math.min(index + 1, 5)}`}
            >
              {/* Agenda Row */}
              <div className="flex items-center gap-4 p-4">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <GripVertical className="w-4 h-4 text-text-muted/40" />
                  <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center">
                    <span className="text-sm font-bold text-text-secondary">{agenda.orderNo}</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-sm font-semibold text-text-primary truncate">
                      {agenda.titleTh}
                    </h3>
                    {getResolutionBadge(agenda.resolutionType)}
                    <span className={`badge text-[10px] ${STATUS_LABELS[agenda.status]?.color || ''}`}>
                      {STATUS_LABELS[agenda.status]?.label || agenda.status}
                    </span>
                  </div>
                  <p className="text-xs text-text-muted truncate">{agenda.title}</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {agenda.resolutionType === 'ELECTION' && (
                    <button
                      onClick={() => toggleExpand(agenda.id)}
                      className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-secondary transition-colors cursor-pointer"
                      title="วาระย่อย"
                    >
                      {expandedIds.has(agenda.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span className="sr-only">Sub-agendas</span>
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(agenda)}
                    className="p-2 rounded-lg hover:bg-bg-hover text-text-muted hover:text-primary transition-colors cursor-pointer"
                    title="แก้ไข"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {agenda.status === 'PENDING' && (
                    <button
                      onClick={() => handleDelete(agenda.id)}
                      className="p-2 rounded-lg hover:bg-danger/10 text-text-muted hover:text-danger transition-colors cursor-pointer"
                      title="ลบ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Status Transition Buttons */}
                  {agenda.status === 'PENDING' && agenda.resolutionType !== 'INFO' && (
                    <button
                      onClick={() => handleStatusChange(agenda.id, 'OPEN', agenda.titleTh)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors cursor-pointer"
                      title="เปิดลงคะแนน"
                    >
                      <Play className="w-3 h-3" />
                      เปิดโหวต
                    </button>
                  )}
                  {agenda.status === 'OPEN' && (
                    <button
                      onClick={() => handleStatusChange(agenda.id, 'CLOSED', agenda.titleTh)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
                      title="ปิดลงคะแนน"
                    >
                      <Square className="w-3 h-3" />
                      ปิดโหวต
                    </button>
                  )}
                  {agenda.status === 'CLOSED' && (
                    <button
                      onClick={() => handleStatusChange(agenda.id, 'ANNOUNCED', agenda.titleTh)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors cursor-pointer"
                      title="ประกาศผล"
                    >
                      <Megaphone className="w-3 h-3" />
                      ประกาศผล
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-agendas (for ELECTION) */}
              {agenda.resolutionType === 'ELECTION' && expandedIds.has(agenda.id) && (
                <div className="border-t border-border bg-bg-tertiary/30 px-4 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-text-secondary flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5" />
                      วาระย่อย ({agenda.subAgendas.length} รายการ)
                    </p>
                    <button
                      onClick={() => {
                        setShowSubForm(agenda.id);
                        setSubFormData({ title: '', titleTh: '' });
                      }}
                      className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer"
                    >
                      + เพิ่มวาระย่อย
                    </button>
                  </div>

                  {agenda.subAgendas.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {agenda.subAgendas.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-secondary/50">
                          <span className="text-xs font-mono text-text-muted w-8">{agenda.orderNo}.{sub.orderNo}</span>
                          <span className="text-sm text-text-primary flex-1 truncate">{sub.titleTh}</span>
                          <span className="text-xs text-text-muted truncate">{sub.title}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add sub-agenda form */}
                  {showSubForm === agenda.id && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="ชื่อวาระย่อย (TH)"
                        value={subFormData.titleTh}
                        onChange={(e) => setSubFormData((p) => ({ ...p, titleTh: e.target.value }))}
                        className="input-field text-sm flex-1"
                      />
                      <input
                        type="text"
                        placeholder="Title (EN)"
                        value={subFormData.title}
                        onChange={(e) => setSubFormData((p) => ({ ...p, title: e.target.value }))}
                        className="input-field text-sm flex-1"
                      />
                      <button
                        onClick={() => handleAddSubAgenda(agenda.id)}
                        className="px-3 py-2 rounded-lg gradient-primary text-white text-sm cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowSubForm(null)}
                        className="px-3 py-2 rounded-lg bg-bg-tertiary text-text-muted text-sm cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg glass-card p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-text-primary">
                {editingAgenda ? 'แก้ไขวาระ' : 'เพิ่มวาระใหม่'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-bg-hover text-text-muted cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">ชื่อวาระ (ภาษาไทย) *</label>
                <input
                  type="text"
                  value={formData.titleTh}
                  onChange={(e) => setFormData((p) => ({ ...p, titleTh: e.target.value }))}
                  className="input-field"
                  placeholder="เช่น พิจารณาอนุมัติงบการเงิน"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">Title (English) *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  className="input-field"
                  placeholder="e.g. Approval of Financial Statements"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">ประเภทมติ *</label>
                <select
                  value={formData.resolutionType}
                  onChange={(e) => setFormData((p) => ({ ...p, resolutionType: e.target.value }))}
                  className="input-field"
                >
                  {RESOLUTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} ({t.labelEn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">รายละเอียด</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  className="input-field min-h-[80px] resize-y"
                  rows={3}
                  placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2.5 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium hover:bg-bg-hover transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl gradient-primary text-white text-sm font-medium shadow-lg shadow-primary/25 disabled:opacity-50 cursor-pointer"
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
