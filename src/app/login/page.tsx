'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Vote,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        return;
      }

      // Redirect based on role
      const roleRedirects: Record<string, string> = {
        SUPER_ADMIN: '/admin/companies',
        SYSTEM_ADMIN: '/setup/agendas',
        REGISTRATION_STAFF: '/registration',
        TALLYING_STAFF: '/tallying',
        CHAIRMAN: '/chairman',
        AUDITOR: '/auditor',
      };

      router.push(roleRedirects[data.user.role] || '/dashboard');
      router.refresh();
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#0f172a', color: '#f1f5f9' }}>
      {/* Decorative floating elements */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-accent/5 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-md mx-4 animate-fade-in relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl gradient-primary shadow-lg shadow-primary/25 mb-6">
            <Vote className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#f1f5f9' }}>
            e-AGM System
          </h1>
          <p className="text-sm" style={{ color: '#94a3b8' }}>
            ระบบบริหารจัดการการประชุมผู้ถือหุ้นและลงคะแนนเสียง
          </p>
        </div>

        {/* Login Card */}
        <div className="p-8 rounded-2xl backdrop-blur-xl" style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(148, 163, 184, 0.1)' }}>
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error Alert */}
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger animate-fade-in">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#94a3b8' }}>
                ชื่อผู้ใช้
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#64748b' }} />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                  style={{ background: '#334155', border: '1px solid #475569', color: '#f1f5f9' }}
                  placeholder="กรอกชื่อผู้ใช้"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#94a3b8' }}>
                รหัสผ่าน
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#64748b' }} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                  style={{ background: '#334155', border: '1px solid #475569', color: '#f1f5f9' }}
                  placeholder="กรอกรหัสผ่าน"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors cursor-pointer"
                  style={{ color: '#64748b' }}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-button"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-white gradient-primary hover:opacity-90 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98] cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  กำลังเข้าสู่ระบบ...
                </span>
              ) : (
                'เข้าสู่ระบบ'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: '#64748b' }}>
          AGM Organizer Platform v1.0
        </p>
      </div>
    </div>
  );
}
