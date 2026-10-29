'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/auth.context';
import { useChat } from '../../context/chat.context';
import {
  Send,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  User,
  Users,
  MessageSquare,
  WifiOff,
  Clock,
  CheckCheck,
} from 'lucide-react';

interface ChatWindowProps {
  onOpenKeyModal?: () => void;
}

export function ChatWindow({ onOpenKeyModal }: ChatWindowProps) {
  const { user, status } = useAuth();
  const {
    activeChat,
    messages,
    isLoadingMessages,
    isSending,
    sendMessage,
    socketConnected,
    onlineUserIds,
  } = useChat();

  const [inputText, setInputText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoadingMessages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setSendError(null);
    try {
      await sendMessage(inputText);
      setInputText('');
    } catch (err: any) {
      setSendError(err?.message || 'Không thể gửi tin nhắn');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // If no chat selected
  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-400 text-center">
        <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-4">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-200 mb-1">
          Chưa chọn cuộc trò chuyện
        </h3>
        <p className="text-xs max-w-sm text-slate-500">
          Chọn một cuộc trò chuyện từ danh sách bên trái hoặc tạo cuộc trò chuyện mới để bắt đầu nhắn tin mã hóa đầu-cuối.
        </p>
      </div>
    );
  }

  const isOtherOnline =
    !activeChat.is_group &&
    user &&
    activeChat.members.some((id) => id !== user.user_id && onlineUserIds.includes(id));

  const isE2EEReady = status === 'ready_e2ee';

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 min-w-0">
      {/* CHAT HEADER */}
      <div className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              activeChat.is_group
                ? 'bg-purple-600/20 text-purple-400'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {activeChat.is_group ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-slate-100 truncate">{activeChat.name}</h3>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              {activeChat.is_group ? (
                <span>{activeChat.members?.length || 0} thành viên</span>
              ) : isOtherOnline ? (
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Đang trực tuyến
                </span>
              ) : (
                <span>Ngoại tuyến</span>
              )}
            </div>
          </div>
        </div>

        {/* E2EE BADGE */}
        <div className="flex items-center gap-2">
          {isE2EEReady ? (
            <div className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/80 rounded-full flex items-center gap-1.5 text-[11px] text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="font-medium hidden sm:inline">Mã hóa đầu-cuối</span>
              <span className="font-medium sm:hidden">Bảo mật</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenKeyModal}
              className="px-2.5 py-1 bg-amber-950/60 border border-amber-800/80 rounded-full flex items-center gap-1.5 text-[11px] text-amber-300 hover:bg-amber-900/60 transition"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="font-medium">Chưa mở khóa bảo mật</span>
            </button>
          )}
        </div>
      </div>

      {/* WARNING BANNER IF KEY NOT UNLOCKED */}
      {!isE2EEReady && (
        <div className="p-3 bg-amber-950/40 border-b border-amber-800/60 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
            <span>Dữ liệu bảo mật chưa được mở khóa trên thiết bị này. Vui lòng mở khóa để đọc và gửi tin nhắn.</span>
          </div>
          <button
            type="button"
            onClick={onOpenKeyModal}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg text-[11px] transition ml-3 flex-shrink-0"
          >
            Mở khóa
          </button>
        </div>
      )}

      {/* SOCKET DISCONNECT WARNING BANNER */}
      {!socketConnected && (
        <div className="p-2 bg-red-950/60 border-b border-red-800/80 flex items-center justify-center gap-2 text-xs text-red-300">
          <WifiOff className="w-4 h-4" />
          <span>Mất kết nối với máy chủ. Đang thử kết nối lại...</span>
        </div>
      )}

      {/* MESSAGES CONTAINER */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-slate-500 space-y-2">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span>Đang tải tin nhắn...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-slate-500 space-y-2 text-center p-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <p className="font-semibold text-slate-300">Chưa có tin nhắn nào</p>
            <p className="text-[11px] max-w-xs text-slate-500">
              Mọi tin nhắn trong cuộc trò chuyện này đều được mã hóa đầu-cuối an toàn trên thiết bị của bạn.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}
              >
                {!msg.isOwn && (
                  <span className="text-[10px] text-slate-500 mb-1 ml-1">
                    Người gửi #{msg.sender_id}
                  </span>
                )}
                <div
                  className={`max-w-md sm:max-w-lg rounded-2xl p-3.5 shadow-md space-y-1.5 ${
                    msg.isOwn
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-none'
                  }`}
                >
                  {/* MESSAGE TEXT */}
                  <p
                    className={`text-sm break-words whitespace-pre-wrap ${
                      !msg.isDecrypted ? 'text-amber-300 italic text-xs' : ''
                    }`}
                  >
                    {msg.text}
                  </p>

                  {/* MESSAGE FOOTER (TIMESTAMP & E2EE STATUS) */}
                  <div
                    className={`flex items-center justify-end gap-1.5 text-[10px] ${
                      msg.isOwn ? 'text-blue-200' : 'text-slate-500'
                    }`}
                  >
                    <span>{formatTime(msg.timestamp)}</span>
                    {msg.isDecrypted ? (
                      <Lock className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* SEND ERROR ALERT */}
      {sendError && (
        <div className="mx-4 mb-2 p-2.5 bg-red-950/60 border border-red-800 rounded-xl flex items-center justify-between text-xs text-red-300">
          <span>{sendError}</span>
          <button
            type="button"
            onClick={() => setSendError(null)}
            className="text-red-400 hover:text-red-200 font-bold ml-2"
          >
            ×
          </button>
        </div>
      )}

      {/* CHAT INPUT AREA */}
      <div className="p-3 sm:p-4 bg-slate-900 border-t border-slate-800">
        <form onSubmit={handleSend} className="flex items-end gap-2 sm:gap-3">
          <div className="flex-1 relative bg-slate-950 border border-slate-800 rounded-2xl focus-within:border-blue-500 transition">
            <textarea
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isE2EEReady || !socketConnected || isSending}
              placeholder={
                !isE2EEReady
                  ? 'Vui lòng mở khóa bảo mật để gửi tin nhắn...'
                  : !socketConnected
                  ? 'Đang mất kết nối đến máy chủ...'
                  : 'Nhập tin nhắn bảo mật (Enter để gửi)...'
              }
              className="w-full pl-4 pr-10 py-3 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none resize-none max-h-32 disabled:opacity-50"
            />
            <div className="absolute right-3 bottom-3 text-slate-500 pointer-events-none">
              <Lock className="w-4 h-4 text-emerald-500/70" />
            </div>
          </div>

          <button
            type="submit"
            disabled={!inputText.trim() || !isE2EEReady || !socketConnected || isSending}
            className="h-11 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl font-medium text-sm transition flex items-center justify-center gap-1.5 flex-shrink-0"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Gửi</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
