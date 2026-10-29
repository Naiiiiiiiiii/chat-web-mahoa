'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/auth.context';
import { useChat } from '../../context/chat.context';
import {
  MessageSquare,
  Plus,
  Search,
  User,
  Users,
  Lock,
  Unlock,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Download,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { NewChatModal } from './NewChatModal';

interface ChatSidebarProps {
  onOpenKeyModal?: () => void;
}

export function ChatSidebar({ onOpenKeyModal }: ChatSidebarProps) {
  const { user, status, exportKeyFile, logout } = useAuth();
  const {
    chats,
    activeChatId,
    selectChat,
    onlineUserIds,
    socketConnected,
    isLoadingChats,
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

  const filteredChats = chats.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleExportKey = async () => {
    try {
      const json = await exportKeyFile();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${user?.username || 'user'}_private.enc.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Không thể tạo file sao lưu');
    }
  };

  // Check if other member in 1-1 chat is online
  const isChatOnline = (members: number[]) => {
    if (!user) return false;
    const otherId = members.find((id) => id !== user.user_id);
    return otherId ? onlineUserIds.includes(otherId) : false;
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 flex flex-col h-full bg-slate-900 border-r border-slate-800 flex-shrink-0">
      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
      />

      {/* TOP USER BAR */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold">
              {user?.full_name ? user.full_name[0].toUpperCase() : user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            {/* Socket status indicator */}
            <span
              title={socketConnected ? 'Đã kết nối máy chủ' : 'Mất kết nối máy chủ'}
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                socketConnected ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm text-slate-100 truncate">
              {user?.full_name || user?.username}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>ID: #{user?.user_id}</span>
              <span>•</span>
              {status === 'ready_e2ee' ? (
                <span className="text-emerald-400 flex items-center gap-0.5">
                  <ShieldCheck className="w-3 h-3" />
                  Bảo mật sẵn sàng
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onOpenKeyModal}
                  className="text-amber-400 hover:underline flex items-center gap-0.5"
                >
                  <ShieldAlert className="w-3 h-3" />
                  Chưa mở khóa
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1">
          {status === 'ready_e2ee' && (
            <button
              type="button"
              onClick={handleExportKey}
              title="Sao lưu dữ liệu bảo mật (.json)"
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsNewChatModalOpen(true)}
            title="Tạo cuộc trò chuyện mới"
            className="p-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => logout()}
            title="Đăng xuất"
            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-xl transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SEARCH INPUT */}
      <div className="p-3 border-b border-slate-800">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm cuộc trò chuyện..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* CHAT LIST */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoadingChats ? (
          <div className="flex items-center justify-center p-8 text-xs text-slate-500">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
            <span>Đang tải danh sách...</span>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="text-center p-8 text-xs text-slate-500 space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-600" />
            <p>Chưa có cuộc trò chuyện nào</p>
            <button
              type="button"
              onClick={() => setIsNewChatModalOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium"
            >
              Bắt đầu trò chuyện
            </button>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = chat.chat_id === activeChatId;
            const online = !chat.is_group && isChatOnline(chat.members);

            return (
              <button
                key={chat.chat_id}
                type="button"
                onClick={() => selectChat(chat.chat_id)}
                className={`w-full p-3 rounded-2xl flex items-center gap-3 transition text-left ${
                  isActive
                    ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                    : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      chat.is_group
                        ? 'bg-purple-600/20 text-purple-400'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {chat.is_group ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      <User className="w-5 h-5" />
                    )}
                  </div>
                  {online && (
                    <span
                      title="Trực tuyến"
                      className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h5 className="font-semibold text-sm text-slate-100 truncate">
                      {chat.name}
                    </h5>
                    {chat.unread_count > 0 && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">
                      {chat.is_group
                        ? `${chat.members?.length || 0} thành viên`
                        : online
                        ? 'Đang trực tuyến'
                        : 'Ngoại tuyến'}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-400">
                      <Lock className="w-3 h-3 text-emerald-400/80" />
                      Bảo mật
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* FOOTER CONNECTION STATUS */}
      <div className="p-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          {socketConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Đã kết nối</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
              <span className="text-red-400">Mất kết nối</span>
            </>
          )}
        </div>
        <span>{onlineUserIds.length} trực tuyến</span>
      </div>
    </aside>
  );
}
