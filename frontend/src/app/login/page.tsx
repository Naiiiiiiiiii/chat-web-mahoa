'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth.context';
import { KeyVaultModal } from '../../components/KeyVaultModal';
import { Shield, Lock, LogIn, AlertTriangle, KeyRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, status, error, login, clearError } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already logged in and E2EE ready, redirect to home
  useEffect(() => {
    if (status === 'ready_e2ee') {
      router.push('/');
    }
  }, [status, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    const trimmedUsername = formData.username.trim();
    if (!trimmedUsername) {
      setLocalError('Vui lòng nhập tên đăng nhập');
      return;
    }
    if (!formData.password) {
      setLocalError('Vui lòng nhập mật khẩu');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({
        username: trimmedUsername,
        password: formData.password,
      });
      // Note: If ready_e2ee, useEffect will redirect.
      // If authenticated_no_key or unlocking, KeyVaultModal will automatically render to prompt user.
    } catch (err: any) {
      setLocalError(err.msg || err.message || 'Đăng nhập không thành công');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100">
      {/* Modal for unlocking or importing key if authenticated but key not ready */}
      <KeyVaultModal onSuccess={() => router.push('/')} />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto text-blue-400">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Đăng Nhập Secure Chat</h1>
          <p className="text-xs text-slate-400">
            Ứng dụng nhắn tin bảo mật và riêng tư
          </p>
        </div>

        {displayError && (
          <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-3 text-red-300 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Tên đăng nhập
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Nhập tên đăng nhập..."
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Mật khẩu tài khoản
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Nhập mật khẩu..."
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-medium rounded-xl text-sm transition flex items-center justify-center gap-2 mt-2"
          >
            <LogIn className="w-4 h-4" />
            <span>{isSubmitting ? 'Đang xác thực...' : 'Đăng Nhập'}</span>
          </button>

          <div className="text-center text-xs text-slate-400 pt-2">
            Chưa có tài khoản?{' '}
            <Link href="/register" className="text-blue-400 hover:underline font-semibold">
              Đăng ký tài khoản mới
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
