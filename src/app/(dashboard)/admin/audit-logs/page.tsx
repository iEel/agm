'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  LogIn,
  UserPlus,
  UserMinus,
  Settings,
  Trash2,
  Play,
  Square,
  Megaphone,
  Database,
  AlertCircle,
  Loader2,
  Calendar,
  X,
  CheckSquare,
  LogOut,
  RotateCcw,
  FileSpreadsheet,
  Vote,
  FilePlus2,
  FileEdit,
  Download,
} from 'lucide-react';

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entity: string | null;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Action labels and styling
const ACTION_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  LOGIN:              { label: 'เข้าสู่ระบบ',        icon: LogIn,         color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  CREATE_USER:        { label: 'สร้างผู้ใช้',         icon: UserPlus,      color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  UPDATE_USER:        { label: 'แก้ไขผู้ใช้',         icon: Settings,      color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  DELETE_USER:        { label: 'ลบผู้ใช้',            icon: UserMinus,     color: 'text-red-400',     bg: 'bg-red-500/15' },
  UPDATE_EVENT:       { label: 'แก้ไขงานประชุม',      icon: Settings,      color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  DELETE_EVENT:       { label: 'ลบงานประชุม',         icon: Trash2,        color: 'text-red-400',     bg: 'bg-red-500/15' },
  SET_ACTIVE_EVENT:   { label: 'เปิดใช้งานประชุม',     icon: Play,          color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  AGENDA_OPEN:        { label: 'เปิดรับโหวต',         icon: Play,          color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  AGENDA_CLOSED:      { label: 'ปิดโหวต',            icon: Square,        color: 'text-blue-400',    bg: 'bg-blue-500/15' },
  AGENDA_ANNOUNCED:   { label: 'ประกาศผล',           icon: Megaphone,     color: 'text-violet-400',  bg: 'bg-violet-500/15' },
  CLEAR_SESSION_DATA: { label: 'ล้างรอบประชุม',       icon: Database,      color: 'text-orange-400',  bg: 'bg-orange-500/15' },
  CLEAR_ALL_DATA:     { label: 'ล้างข้อมูลทั้งหมด',    icon: Trash2,        color: 'text-red-400',     bg: 'bg-red-500/15' },
  CHECKIN:            { label: 'ลงทะเบียนเข้าร่วม',   icon: CheckSquare,   color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  CHECKOUT:           { label: 'ออกจากประชุม',        icon: LogOut,        color: 'text-orange-400',  bg: 'bg-orange-500/15' },
  RECHECKIN:          { label: 'กลับเข้าร่วมประชุม',   icon: RotateCcw,     color: 'text-cyan-400',    bg: 'bg-cyan-500/15' },
  CANCEL_REGISTRATION:{ label: 'ยกเลิกลงทะเบียน',     icon: UserMinus,     color: 'text-red-400',     bg: 'bg-red-500/15' },
  VOTE:               { label: 'ลงคะแนนเสียง',       icon: Vote,          color: 'text-indigo-400',  bg: 'bg-indigo-500/15' },
  CREATE_AGENDA:      { label: 'สร้างวาระ',           icon: FilePlus2,     color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  UPDATE_AGENDA:      { label: 'แก้ไขวาระ',           icon: FileEdit,      color: 'text-amber-400',   bg: 'bg-amber-500/15' },
  DELETE_AGENDA:      { label: 'ลบวาระ',             icon: Trash2,        color: 'text-red-400',     bg: 'bg-red-500/15' },
  IMPORT_SHAREHOLDERS:{ label: 'นำเข้าผู้ถือหุ้น',     icon: FileSpreadsheet,color: 'text-teal-400',   bg: 'bg-teal-500/15' },
};

const getActionConfig = (action: string) => ACTION_CONFIG[action] || {
  label: action,
  icon: Clock,
  color: 'text-gray-400',
  bg: 'bg-gray-500/15',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 30, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (filterAction) params.set('action', filterAction);
      if (filterUser) params.set('userId', filterUser);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      if (searchText) params.set('search', searchText);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setActions(data.actions || []);
        setPagination(data.pagination);
      } else {
        setError('ไม่สามารถดึงข้อมูลได้');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterUser, filterDateFrom, filterDateTo, searchText]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  const clearFilters = () => {
    setFilterAction('');
    setFilterUser('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchText('');
  };

  const hasFilters = filterAction || filterUser || filterDateFrom || filterDateTo || searchText;

  const formatDateTime = (d: string) => {
    const date = new Date(d);
    const thaiYear = date.getFullYear() + 543;
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const time = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `${date.getDate()} ${months[date.getMonth()]} ${thaiYear} ${time}`;
  };

  const parseDetails = (details: string | null) => {
    if (!details) return null;
    try { return JSON.parse(details); } catch { return details; }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ScrollText className="w-5 h-5 text-white" />
            </div>
            ประวัติกิจกรรม
          </h1>
          <p className="text-sm text-text-secondary mt-1">Audit Log — บันทึกกิจกรรมทั้งหมดในระบบ</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all ${
              showFilters || hasFilters
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover border border-border/50'
            }`}
          >
            <Filter className="w-4 h-4" />
            ตัวกรอง
            {hasFilters && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (filterAction) params.set('action', filterAction);
              if (filterDateFrom) params.set('dateFrom', filterDateFrom);
              if (filterDateTo) params.set('dateTo', filterDateTo);
              window.open(`/api/reports/audit-export?${params.toString()}`, '_blank');
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium cursor-pointer hover:bg-emerald-500/20 border border-emerald-500/20"
          >
            <Download className="w-4 h-4" />
            ส่งออก Excel
          </button>
          <button
            onClick={() => fetchLogs(pagination.page)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-tertiary text-text-secondary text-sm font-medium cursor-pointer hover:bg-bg-hover border border-border/50"
          >
            รีเฟรช
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="glass-card p-4 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
              <input
                type="text"
                placeholder="ค้นหา..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Action filter */}
            <select
              value={filterAction}
              onChange={e => setFilterAction(e.target.value)}
              className="px-3 py-2 bg-bg-primary border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
            >
              <option value="">ทุกกิจกรรม</option>
              {actions.map(a => (
                <option key={a} value={a}>{getActionConfig(a).label}</option>
              ))}
            </select>

            {/* Date from */}
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-text-muted pointer-events-none" />
              <input
                type="date"
                value={filterDateFrom}
                onChange={e => setFilterDateFrom(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="จากวันที่"
              />
            </div>

            {/* Date to */}
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-2.5 text-text-muted pointer-events-none" />
              <input
                type="date"
                value={filterDateTo}
                onChange={e => setFilterDateTo(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="ถึงวันที่"
              />
            </div>
          </div>

          {hasFilters && (
            <div className="mt-3 flex items-center gap-2">
              <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary cursor-pointer">
                <X className="w-3 h-3" /> ล้างตัวกรอง
              </button>
              <span className="text-xs text-text-muted">
                พบ {pagination.total} รายการ
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>ทั้งหมด {pagination.total.toLocaleString()} รายการ</span>
        <span>หน้า {pagination.page} / {pagination.totalPages || 1}</span>
      </div>

      {/* Log entries */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <ScrollText className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-text-primary mb-2">ไม่พบข้อมูล</h3>
          <p className="text-sm text-text-secondary">ไม่มีประวัติกิจกรรมที่ตรงกับเงื่อนไข</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="divide-y divide-border/30">
            {logs.map((log) => {
              const config = getActionConfig(log.action);
              const Icon = config.icon;
              const details = parseDetails(log.details);

              return (
                <div key={log.id} className="p-4 hover:bg-bg-hover/30 transition-colors">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
                        {log.entity && (
                          <span className="text-xs text-text-muted px-1.5 py-0.5 rounded bg-bg-tertiary/50">
                            {log.entity}
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      {details && (
                        <div className="mt-1 text-xs text-text-secondary">
                          {typeof details === 'string' ? (
                            <p>{details}</p>
                          ) : log.action === 'VOTE' && details['ผลโหวต'] ? (
                            /* ── Enhanced VOTE display ── */
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {details['วาระ'] && (
                                <span>
                                  <span className="text-text-muted">วาระ</span>{' '}
                                  <span className="font-semibold text-text-primary">{String(details['วาระ'])}</span>
                                </span>
                              )}
                              {details['ผู้ถือหุ้น'] && (
                                <span>
                                  <span className="text-text-muted">โดย</span>{' '}
                                  <span className="font-medium">{String(details['ผู้ถือหุ้น'])}</span>
                                </span>
                              )}
                              {details['ผลโหวต'] && (() => {
                                const vote = String(details['ผลโหวต']);
                                const voteColor = vote === 'เห็นด้วย' ? 'bg-emerald-500/15 text-emerald-400'
                                  : vote === 'ไม่เห็นด้วย' ? 'bg-red-500/15 text-red-400'
                                  : vote === 'งดออกเสียง' ? 'bg-amber-500/15 text-amber-400'
                                  : 'bg-gray-500/15 text-gray-400';
                                return (
                                  <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${voteColor}`}>
                                    {vote}
                                  </span>
                                );
                              })()}
                              {details['จำนวนหุ้น'] && (
                                <span className="text-text-muted">{String(details['จำนวนหุ้น'])} หุ้น</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                              {Object.entries(details)
                                .filter(([key]) => !['changedBy', 'username', 'displayName'].includes(key))
                                .map(([key, value]) => (
                                <span key={key}>
                                  <span className="text-text-muted">{key}:</span>{' '}
                                  <span className="font-medium">{String(value)}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(log.createdAt)}
                        </span>
                        {(() => {
                          // Extract readable username from details or userId
                          const d = details && typeof details === 'object' ? details : null;
                          const displayName = d?.changedBy || d?.username || d?.displayName || null;
                          if (displayName) {
                            return (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {String(displayName)}
                              </span>
                            );
                          }
                          return null;
                        })()}
                        {log.ipAddress && (
                          <span>IP: {log.ipAddress}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchLogs(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
            let pageNum: number;
            if (pagination.totalPages <= 7) {
              pageNum = i + 1;
            } else if (pagination.page <= 4) {
              pageNum = i + 1;
            } else if (pagination.page >= pagination.totalPages - 3) {
              pageNum = pagination.totalPages - 6 + i;
            } else {
              pageNum = pagination.page - 3 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => fetchLogs(pageNum)}
                className={`w-8 h-8 rounded-lg text-xs font-medium cursor-pointer ${
                  pageNum === pagination.page
                    ? 'bg-primary text-white'
                    : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
          <button
            onClick={() => fetchLogs(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="p-2 rounded-lg bg-bg-tertiary text-text-secondary hover:bg-bg-hover disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
