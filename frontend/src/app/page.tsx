'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/auth.context';
import { ChatProvider } from '../context/chat.context';
import { ChatSidebar } from '../components/chat/ChatSidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import { KeyVaultModal } from '../components/KeyVaultModal';
import {
  Shield,
  Lock,
  LogIn,
  UserPlus,
  ShieldCheck,
} from 'lucide-react';

export default function Home() {
  const { user, status, isLoading } = useAuth();
  const [isKeyModalForced, setIsKeyModalForced] = useState(false);

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 bg-slate-950 text-slate-100">
        <div className="flex items-center gap-3 text-slate-400 text-sm">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Đang tải thông tin phiên làm việc...</span>
        </div>
      </main>
    );
  }

  // LOGGED IN USER: FULL REALTIME E2EE CHAT INTERFACE
  if (user) {
    return (
      <ChatProvider>
        <div className="flex h-screen w-full overflow-hidden bg-slate-950 text-slate-100">
          <KeyVaultModal />
          <ChatSidebar onOpenKeyModal={() => setIsKeyModalForced(true)} />
          <ChatWindow onOpenKeyModal={() => setIsKeyModalForced(true)} />
        </div>
      </ChatProvider>
    );
  }

  // GUEST / UNAUTHENTICATED HERO PAGE
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-slate-950 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center mx-auto text-blue-400">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Secure Chat</h1>
          <p className="text-xs text-slate-400">
            Hệ thống trò chuyện bảo mật và riêng tư
          </p>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-xs text-slate-400 leading-relaxed space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
              <Lock className="w-4 h-4" />
              <span>Bảo vệ quyền riêng tư tuyệt đối</span>
            </div>
            <p>
              Mọi tin nhắn của bạn được bảo vệ bằng mã hóa đầu-cuối trực tiếp ngay trên thiết bị. Không ai khác, kể cả máy chủ, có thể đọc được nội dung cuộc trò chuyện của bạn.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Link
              href="/login"
              className="py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm transition flex items-center justify-center gap-2 text-center"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập</span>
            </Link>
            <Link
              href="/register"
              className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl text-sm transition flex items-center justify-center gap-2 text-center"
            >
              <UserPlus className="w-4 h-4" />
              <span>Đăng ký</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
