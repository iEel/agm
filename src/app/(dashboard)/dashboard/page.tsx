'use client';

import { useSession } from '@/lib/session-context';
import {
  Building2,
  Calendar,
  Users,
  FileSpreadsheet,
  ListOrdered,
  TrendingUp,
  Activity,
  QrCode,
} from 'lucide-react';

export default function DashboardPage() {
  const { user, activeEvent } = useSession();

  const stats = [
    {
      label: 'บริษัทลูกค้า',
      value: '—',
      icon: Building2,
      color: 'from-indigo-500 to-purple-500',
      shadowColor: 'shadow-indigo-500/20',
    },
    {
      label: 'งานประชุมทั้งหมด',
      value: '—',
      icon: Calendar,
      color: 'from-cyan-500 to-blue-500',
      shadowColor: 'shadow-cyan-500/20',
    },
    {
      label: 'ผู้ถือหุ้นลงทะเบียน',
      value: '—',
      icon: Users,
      color: 'from-emerald-500 to-green-500',
      shadowColor: 'shadow-emerald-500/20',
    },
    {
      label: 'วาระทั้งหมด',
      value: '—',
      icon: ListOrdered,
      color: 'from-amber-500 to-orange-500',
      shadowColor: 'shadow-amber-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          แดชบอร์ด
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          สวัสดี, {user?.displayName} — ภาพรวมระบบ e-AGM
        </p>
      </div>

      {/* Active Event Card */}
      {activeEvent ? (
        <div className="glass-card p-6 animate-fade-in">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
                <QrCode className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge bg-success/15 text-success border border-success/20">
                    <Activity className="w-3 h-3" />
                    Active
                  </span>
                </div>
                <h2 className="text-lg font-bold text-text-primary">
                  {activeEvent.name}
                </h2>
                <p className="text-sm text-text-secondary">
                  {activeEvent.companyName}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors cursor-pointer">
                ดูรายละเอียด
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card p-8 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-text-muted" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            ยังไม่มีงานประชุมที่ Active
          </h3>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            กรุณาไปที่หน้า &quot;จัดการงานประชุม&quot; เพื่อสร้างและเปิดใช้งานงานประชุม
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`glass-card-light p-5 animate-fade-in stagger-${i + 1}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                {stat.label}
              </span>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md ${stat.shadowColor}`}>
                <stat.icon className="w-4.5 h-4.5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="w-3.5 h-3.5 text-success" />
              <span className="text-xs text-text-muted">อัปเดตอัตโนมัติ</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
          การดำเนินการด่วน
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'นำเข้าผู้ถือหุ้น', icon: FileSpreadsheet, href: '/setup/shareholders' },
            { label: 'ตั้งค่าวาระ', icon: ListOrdered, href: '/setup/agendas' },
            { label: 'เปิดลงทะเบียน', icon: Users, href: '/registration' },
          ].map((action) => (
            <a
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 p-4 rounded-xl bg-bg-tertiary/50 hover:bg-bg-tertiary border border-border/50 hover:border-primary/30 transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <action.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-text-primary group-hover:text-primary transition-colors">
                {action.label}
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
