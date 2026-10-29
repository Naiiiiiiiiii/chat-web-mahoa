'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth.context';
import { Shield, Lock, Download, CheckCircle, AlertTriangle, ArrowRight, UserPlus, Key } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    gender: 'other' as 'male' | 'female' | 'other',
    date_of_birth: '',
    bio: '',
  });

  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    userId: number;
    username: string;
    downloadJson: string;
    storedInBrowser: boolean;
  } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const downloadBackupFile = () => {
    if (!successInfo) return;
    const blob = new Blob([successInfo.downloadJson], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${successInfo.username}_private.enc.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validation
    const trimmedUsername = formData.username.trim();
    if (trimmedUsername.length < 3) {
      setErrorMsg('Tên đăng nhập phải có ít nhất 3 ký tự');
      return;
    }
    if (formData.password.length < 6) {
      setErrorMsg('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp');
      return;
    }

    try {
      setLoadingStep('Đang khởi tạo mã hóa và bảo mật tài khoản...');
      const result = await register({
        username: trimmedUsername,
        password: formData.password,
        full_name: formData.full_name.trim() || undefined,
        gender: formData.gender,
        date_of_birth: formData.date_of_birth || undefined,
        bio: formData.bio.trim() || undefined,
      });

      setSuccessInfo({
        userId: result.user_id,
        username: trimmedUsername,
        downloadJson: result.downloadJson,
        storedInBrowser: result.storedInBrowser,
      });

      // Automatically trigger download for safety
      setTimeout(() => {
        const blob = new Blob([result.downloadJson], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${trimmedUsername}_private.enc.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.msg || err.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoadingStep(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto text-blue-400">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Tạo Tài Khoản Mới</h1>
          <p className="text-xs text-slate-400">
            Mọi cuộc trò chuyện được bảo vệ bằng mã hóa đầu-cuối
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-3 text-red-300 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successInfo ? (
          /* SUCCESS & KEY BACKUP SCREEN */
          <div className="space-y-6">
            <div className="p-4 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl space-y-3">
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle className="w-6 h-6 flex-shrink-0" />
                <h3 className="font-semibold text-sm">Đăng ký tài khoản thành công!</h3>
              </div>
              <p className="text-xs text-slate-300">
                Tài khoản <span className="font-bold text-emerald-300">{successInfo.username}</span> và dữ liệu bảo mật đã được khởi tạo an toàn.
              </p>
            </div>

            {!successInfo.storedInBrowser && (
              <div className="p-3 bg-amber-950/60 border border-amber-800/80 rounded-xl flex items-center gap-3 text-amber-300 text-xs">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>
                  Lưu ý: Không thể lưu khóa vào bộ nhớ trình duyệt (do chế độ ẩn danh hoặc hạn chế lưu trữ). Bạn cần lưu file sao lưu để đăng nhập!
                </span>
              </div>
            )}

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
                <Key className="w-4 h-4" />
                <span>Lưu trữ file khóa bảo mật</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                File khóa bảo mật của bạn (<code className="text-slate-300 font-mono">{successInfo.username}_private.enc.json</code>) đã được mã hóa an toàn bằng mật khẩu của bạn. Vui lòng tải xuống và cất giữ cẩn thận để sử dụng khi đăng nhập trên thiết bị hoặc trình duyệt khác.
              </p>

              <button
                type="button"
                onClick={downloadBackupFile}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                Tải xuống file sao lưu (.json)
              </button>
            </div>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm transition flex items-center justify-center gap-2"
            >
              <span>Đăng nhập ngay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* REGISTRATION FORM */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Tên đăng nhập <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Nhập tên đăng nhập (tối thiểu 3 ký tự)..."
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Mật khẩu <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Tối thiểu 6 ký tự..."
                  required
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Xác nhận mật khẩu <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Nhập lại mật khẩu..."
                  required
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Họ và tên (Tùy chọn)
              </label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                placeholder="Họ và tên hiển thị..."
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Giới tính
                </label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                >
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  name="date_of_birth"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Giới thiệu (Bio)
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows={2}
                placeholder="Vài dòng mô tả về bạn..."
                className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loadingStep !== null}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-medium rounded-xl text-sm transition flex items-center justify-center gap-2 mt-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {loadingStep ? loadingStep : 'Đăng Ký Tài Khoản'}
              </span>
            </button>

            <div className="text-center text-xs text-slate-400 pt-2">
              Đã có tài khoản?{' '}
              <Link href="/login" className="text-blue-400 hover:underline font-semibold">
                Đăng nhập tại đây
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
