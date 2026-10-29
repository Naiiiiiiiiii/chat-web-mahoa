'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/auth.context';
import { useChat } from '../../context/chat.context';
import { UserPlus, AlertCircle, X, Users, User } from 'lucide-react';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NewChatModal({ isOpen, onClose }: NewChatModalProps) {
  const { user } = useAuth();
  const { createChat } = useChat();

  const [recipientId, setRecipientId] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedId = parseInt(recipientId.trim(), 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      setErrorMsg('Vui lòng nhập ID người dùng hợp lệ (số nguyên dương)');
      return;
    }

    if (user && parsedId === user.user_id) {
      setErrorMsg('Không thể tạo cuộc trò chuyện với chính mình');
      return;
    }

    if (isGroup && !groupName.trim()) {
      setErrorMsg('Vui lòng nhập tên cho nhóm chat');
      return;
    }

    setIsSubmitting(true);
    try {
      await createChat(parsedId, isGroup ? groupName.trim() : undefined, isGroup);
      onClose();
      setRecipientId('');
      setGroupName('');
      setIsGroup(false);
    } catch (err: any) {
      setErrorMsg(err?.msg || err?.message || 'Không thể tạo cuộc trò chuyện');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Tạo Cuộc Trò Chuyện</h3>
              <p className="text-xs text-slate-400">Bắt đầu trò chuyện bảo mật</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl flex items-center gap-2.5 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Loại cuộc trò chuyện
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsGroup(false)}
                className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border transition ${
                  !isGroup
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Chat 1-1</span>
              </button>
              <button
                type="button"
                onClick={() => setIsGroup(true)}
                className={`py-2 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border transition ${
                  isGroup
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Nhóm Chat</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              ID Người dùng đối phương <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value)}
              placeholder="Nhập ID người nhận (ví dụ: 14, 15)..."
              required
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
              autoFocus
            />
          </div>

          {isGroup && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Tên Nhóm Chat <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Nhập tên nhóm..."
                required
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-medium rounded-xl text-xs transition flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang tạo...' : 'Tạo Cuộc Trò Chuyện'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
