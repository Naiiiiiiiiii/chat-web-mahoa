'use client';

import React, { useState } from 'react';
import { useAuth } from '../context/auth.context';
import { ShieldAlert, KeyRound, Upload, CheckCircle2, AlertTriangle, Download, Lock } from 'lucide-react';

interface KeyVaultModalProps {
  onSuccess?: () => void;
}

export function KeyVaultModal({ onSuccess }: KeyVaultModalProps) {
  const {
    user,
    status,
    hasStoredVault,
    unlockStoredKey,
    importKeyFile,
    exportKeyFile,
    logout,
  } = useAuth();

  const [passphrase, setPassphrase] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualImport, setShowManualImport] = useState(false);

  // If user is ready with E2EE or unauthenticated, modal doesn't need to show
  if (status === 'ready_e2ee' || status === 'unauthenticated' || !user) {
    return null;
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      setErrorMsg('Vui lòng chọn file sao lưu có định dạng .json');
      return;
    }

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file);
  };

  const handleUnlockStored = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) {
      setErrorMsg('Vui lòng nhập mật khẩu mở khóa');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await unlockStoredKey(passphrase);
      setPassphrase('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Mật khẩu mở khóa không chính xác');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileContent) {
      setErrorMsg('Vui lòng chọn file sao lưu .json');
      return;
    }
    if (!passphrase) {
      setErrorMsg('Vui lòng nhập mật khẩu bảo vệ file khóa');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await importKeyFile(fileContent, passphrase);
      setPassphrase('');
      setFileContent(null);
      setFileName(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Nhập file khóa thất bại. Kiểm tra file hoặc mật khẩu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isUnlockMode = hasStoredVault && !showManualImport;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">
              {isUnlockMode ? 'Mở Khóa Dữ Liệu Bảo Mật' : 'Khôi Phục Dữ Liệu Bảo Mật'}
            </h2>
            <p className="text-xs text-slate-400">
              Tài khoản: <span className="text-blue-400 font-semibold">{user.username}</span>
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-3 text-red-300 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isUnlockMode ? (
          /* UNLOCK STORED KEY IN INDEXEDDB */
          <form onSubmit={handleUnlockStored} className="space-y-4">
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1">
              <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Đã tìm thấy dữ liệu bảo mật trên thiết bị này
              </p>
              <p className="text-slate-400">
                Nhập mật khẩu tài khoản của bạn để bắt đầu gửi và nhận tin nhắn an toàn.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Mật khẩu mở khóa
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Nhập mật khẩu tài khoản..."
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isProcessing}
                className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-medium rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {isProcessing ? 'Đang mở khóa...' : 'Mở Khóa'}
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
              <button
                type="button"
                onClick={() => setShowManualImport(true)}
                className="text-slate-400 hover:text-slate-200 underline"
              >
                Nhập file sao lưu khác (.json)
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="text-red-400 hover:text-red-300"
              >
                Đăng xuất
              </button>
            </div>
          </form>
        ) : (
          /* IMPORT BACKUP FILE */
          <form onSubmit={handleImportFile} className="space-y-4">
            <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-xs text-amber-300 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Thiết bị này chưa có dữ liệu bảo mật
              </p>
              <p className="text-amber-200/80">
                Để đọc tin nhắn an toàn của bạn, vui lòng tải lên file sao lưu (.json) đã lưu khi tạo tài khoản.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Chọn file sao lưu (.json)
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/60 rounded-xl p-4 cursor-pointer transition">
                <Upload className="w-6 h-6 text-slate-400 mb-2" />
                <span className="text-xs text-slate-300">
                  {fileName ? (
                    <span className="text-emerald-400 font-semibold">{fileName}</span>
                  ) : (
                    'Bấm vào đây để chọn file sao lưu (.json)'
                  )}
                </span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Mật khẩu file sao lưu
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Nhập mật khẩu đã dùng khi tạo file sao lưu..."
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isProcessing || !fileContent}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium rounded-xl text-sm transition flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {isProcessing ? 'Đang khôi phục...' : 'Khôi Phục Dữ Liệu'}
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
              {hasStoredVault && (
                <button
                  type="button"
                  onClick={() => setShowManualImport(false)}
                  className="text-slate-400 hover:text-slate-200 underline"
                >
                  Quay lại khóa có sẵn
                </button>
              )}
              <button
                type="button"
                onClick={() => logout()}
                className="text-red-400 hover:text-red-300 ml-auto"
              >
                Đăng xuất
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
