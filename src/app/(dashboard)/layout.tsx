'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Calendar,
  Users,
  ListOrdered,
  FileSpreadsheet,
  FileSignature,
  UserCheck,
  ScanLine,
  Monitor,
  Shield,
  LogOut,
  ChevronLeft,
  QrCode,
  Menu,
  X,
  Zap,
  FileText,
  Sun,
  Moon,
  PieChart,
  Mic,
} from 'lucide-react';
import { type NavItem, type NavSection, NAV_ITEMS } from '@/types';
import { SessionContext, type SessionUser, type SessionContextType } from '@/lib/session-context';
import { useTheme } from '@/lib/theme-context';
export { useSession } from '@/lib/session-context';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Building2,
  Calendar,
  Users,
  ListOrdered,
  FileSpreadsheet,
  FileSignature,
  UserCheck,
  ScanLine,
  Monitor,
  Shield,
  FileText,
  PieChart,
  Mic,
};

// Session types imported from @/lib/session-context

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [activeEvent, setActiveEvent] = useState<SessionContextType['activeEvent']>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    fetchSession();
  }, []);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      if (!res.ok) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setUser(data.user);
      setActiveEvent(data.activeEvent);
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center animate-pulse-glow">
            <QrCode className="w-8 h-8 text-white" />
          </div>
          <p className="text-text-secondary text-sm">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const navSections: NavSection[] = NAV_ITEMS[user.role] || [];

  return (
    <SessionContext.Provider value={{ user, loading, activeEvent }}>
      <div className="min-h-screen bg-bg-primary flex">
        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-0 left-0 h-screen z-50 transition-all duration-300 ease-in-out flex flex-col
            ${sidebarOpen ? 'w-64' : 'w-20'}
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            bg-bg-secondary border-r border-border
          `}
        >
          {/* Logo area */}
          <div className="p-4 flex items-center gap-3 border-b border-border min-h-[64px]">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && (
              <div className="animate-fade-in overflow-hidden">
                <h1 className="font-bold text-text-primary text-sm leading-tight">e-AGM</h1>
                <p className="text-[10px] text-text-muted truncate">Sonic Organizer</p>
              </div>
            )}
          </div>

          {/* Active Event Banner */}
          {activeEvent && sidebarOpen && (
            <div className="mx-3 mt-3 p-3 rounded-xl bg-primary/10 border border-primary/20 animate-fade-in">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">Active Event</span>
              </div>
              <p className="text-xs font-semibold text-text-primary truncate">{activeEvent.name}</p>
              <p className="text-[10px] text-text-secondary truncate">{activeEvent.companyName}</p>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {navSections.map((section, sIdx) => (
              <div key={sIdx}>
                {/* Section heading */}
                {section.heading && (
                  sidebarOpen ? (
                    <p className={`text-[10px] font-semibold text-text-muted uppercase tracking-wider px-3 ${sIdx > 0 ? 'mt-4' : ''} mb-2`}>
                      {section.heading}
                    </p>
                  ) : (
                    <div className={`${sIdx > 0 ? 'mt-3 mb-2' : ''} mx-3 border-t border-border/50`} />
                  )
                )}
                {/* Section items */}
                {section.items.map((item) => {
                  const Icon = iconMap[item.icon] || LayoutDashboard;
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
                        ${isActive
                          ? 'bg-primary/15 text-primary shadow-sm'
                          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                        }
                        ${!sidebarOpen ? 'justify-center' : ''}
                      `}
                      title={!sidebarOpen ? item.label : undefined}
                    >
                      <Icon className={`w-5 h-5 flex-shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-text-muted group-hover:text-text-secondary'}`} />
                      {sidebarOpen && (
                        <span className="truncate animate-fade-in">{item.label}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* User & collapse */}
          <div className="border-t border-border p-3 space-y-2">
            {sidebarOpen && (
              <div className="px-3 py-2 animate-fade-in">
                <p className="text-sm font-semibold text-text-primary truncate">{user.displayName}</p>
                <p className="text-[10px] text-text-muted truncate">{user.role.replace(/_/g, ' ')}</p>
              </div>
            )}
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all duration-200 cursor-pointer ${!sidebarOpen ? 'justify-center' : ''}`}
              title={theme === 'light' ? 'เปลี่ยนเป็น Dark Mode' : 'เปลี่ยนเป็น Light Mode'}
            >
              {theme === 'light' ? (
                <Moon className="w-5 h-5 flex-shrink-0" />
              ) : (
                <Sun className="w-5 h-5 flex-shrink-0" />
              )}
              {sidebarOpen && <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
            </button>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-danger/80 hover:bg-danger/10 hover:text-danger transition-all duration-200 cursor-pointer ${!sidebarOpen ? 'justify-center' : ''}`}
              title="ออกจากระบบ"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>ออกจากระบบ</span>}
            </button>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex items-center justify-center w-full py-2 rounded-xl text-text-muted hover:bg-bg-hover hover:text-text-secondary transition-all duration-200 cursor-pointer"
              title={sidebarOpen ? 'ย่อเมนู' : 'ขยายเมนู'}
            >
              <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${!sidebarOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
          {/* Top bar (mobile) */}
          <header className="lg:hidden sticky top-0 z-30 bg-bg-secondary/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center justify-between">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl hover:bg-bg-hover text-text-secondary transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <QrCode className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm text-text-primary">e-AGM</span>
            </div>
            <div className="w-9" /> {/* Spacer */}
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionContext.Provider>
  );
}
