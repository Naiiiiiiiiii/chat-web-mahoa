'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { useAuth } from './auth.context';
import {
  ChatItem,
  ChatMessageRaw,
  DecryptedChatMessage,
  CreateChatPayload,
  ReceiveSocketMessagePayload,
} from '../types/chat.types';
import { chatService } from '../services/chat.service';
import { socketService } from '../services/socket.service';
import { WebCryptoService } from '../services/crypto.service';

interface ChatContextType {
  chats: ChatItem[];
  activeChatId: number | null;
  activeChat: ChatItem | null;
  messages: DecryptedChatMessage[];
  isLoadingChats: boolean;
  isLoadingMessages: boolean;
  isSending: boolean;
  onlineUserIds: number[];
  socketConnected: boolean;
  socketError: string | null;
  error: string | null;
  selectChat: (chatId: number) => Promise<void>;
  sendMessage: (plaintext: string) => Promise<void>;
  createChat: (recipientId: number, name?: string, isGroup?: boolean) => Promise<ChatItem>;
  refreshChats: () => Promise<void>;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, token, privateKey, status } = useAuth();

  const [chats, setChats] = useState<ChatItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<DecryptedChatMessage[]>([]);
  const [isLoadingChats, setIsLoadingChats] = useState<boolean>(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [onlineUserIds, setOnlineUserIds] = useState<number[]>([]);
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeChatIdRef = useRef<number | null>(activeChatId);
  activeChatIdRef.current = activeChatId;

  const userRef = useRef(user);
  userRef.current = user;

  const privateKeyRef = useRef(privateKey);
  privateKeyRef.current = privateKey;

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const activeChat = chats.find((c) => c.chat_id === activeChatId) || null;

  // Load chats list
  const refreshChats = useCallback(async () => {
    if (!token || !userRef.current) return;
    setIsLoadingChats(true);
    try {
      const list = await chatService.getChats();
      setChats(list);
    } catch (err: any) {
      setError(err?.msg || err?.message || 'Không thể tải danh sách cuộc trò chuyện');
    } finally {
      setIsLoadingChats(false);
    }
  }, [token]);

  // Handle incoming realtime message
  const handleIncomingMessage = useCallback(
    async (rawMsg: ReceiveSocketMessagePayload) => {
      const currentUser = userRef.current;
      const currentActiveChatId = activeChatIdRef.current;
      const currentPrivateKey = privateKeyRef.current;

      if (!currentUser) return;

      // Update chat unread counts in sidebar
      setChats((prev) =>
        prev.map((c) => {
          if (c.chat_id === rawMsg.chat_id) {
            const isCurrentChat = rawMsg.chat_id === currentActiveChatId;
            return {
              ...c,
              unread_count: isCurrentChat ? 0 : c.unread_count + 1,
            };
          }
          return c;
        }),
      );

      // If message is for the currently open chat room, decrypt and display it
      if (rawMsg.chat_id === currentActiveChatId) {
        const decrypted = await chatService.decryptMessage(
          rawMsg,
          currentUser.user_id,
          currentPrivateKey,
        );

        setMessages((prev) => {
          // Prevent duplicates by checking id
          if (prev.some((m) => m.id === decrypted.id)) {
            return prev;
          }
          return [...prev, decrypted];
        });

        // Mark as read immediately on server if active
        chatService.markRead(rawMsg.chat_id).catch(() => {});
      }
    },
    [],
  );

  // Setup Socket.IO connection and lifecycle
  useEffect(() => {
    if (!token || !user?.user_id) {
      socketService.disconnect(true);
      setSocketConnected(false);
      setOnlineUserIds([]);
      setChats([]);
      setMessages([]);
      setActiveChatId(null);
      return;
    }

    socketService.connect(token);
    setSocketConnected(socketService.isConnected());

    const unsubConn = socketService.onConnectionState((connected, err) => {
      setSocketConnected(connected);
      setSocketError(err || null);
    });

    const unsubOnline = socketService.onOnlineUsers((users) => {
      setOnlineUserIds(users);
    });

    const unsubMsg = socketService.onMessageReceived(handleIncomingMessage);

    const unsubErr = socketService.onError((err) => {
      setError(err.msg || 'Lỗi kết nối từ máy chủ');
    });

    refreshChats();

    return () => {
      unsubConn();
      unsubOnline();
      unsubMsg();
      unsubErr();
      socketService.disconnect();
    };
  }, [token, user?.user_id]);

  // Synchronize active chat room with socket room
  useEffect(() => {
    if (activeChatId && user && socketConnected) {
      socketService.joinChat(activeChatId, user.user_id);
    }
  }, [activeChatId, user?.user_id, socketConnected]);

  // Select and join a chat
  const selectChat = useCallback(
    async (chatId: number) => {
      if (!user) return;
      setActiveChatId(chatId);
      setError(null);
      setIsLoadingMessages(true);

      // Join Socket.IO room for real-time delivery
      socketService.joinChat(chatId, user.user_id);

      // Mark unread as 0 locally
      setChats((prev) =>
        prev.map((c) =>
          c.chat_id === chatId ? { ...c, unread_count: 0 } : c,
        ),
      );

      try {
        // 1. Fetch raw messages from REST API
        const rawList = await chatService.getMessages(chatId);

        // 2. Decrypt all messages using current user's unlocked private key
        const decryptedList = await Promise.all(
          rawList.map((raw) =>
            chatService.decryptMessage(raw, user.user_id, privateKey),
          ),
        );

        setMessages(decryptedList);

        // 3. Mark read on server
        chatService.markRead(chatId).catch(() => {});
      } catch (err: any) {
        setError(err?.msg || err?.message || 'Không thể tải tin nhắn cuộc trò chuyện');
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [user, privateKey],
  );

  // Send an E2EE encrypted message
  const sendMessage = useCallback(
    async (plaintext: string) => {
      if (!plaintext.trim()) return;

      if (!user) {
        throw new Error('Chưa đăng nhập');
      }
      if (status !== 'ready_e2ee' || !privateKey) {
        throw new Error(
          'Chưa thể gửi tin nhắn an toàn. Vui lòng mở khóa dữ liệu bảo mật để tiếp tục.',
        );
      }
      if (!activeChatId || !activeChat) {
        throw new Error('Chưa chọn cuộc trò chuyện');
      }
      if (!socketService.isConnected()) {
        throw new Error('Đang mất kết nối tới máy chủ. Vui lòng thử lại sau.');
      }

      setIsSending(true);
      setError(null);

      try {
        // 1. Get members of active chat
        const members = activeChat.members || [];
        if (members.length === 0) {
          throw new Error('Cuộc trò chuyện không có thành viên.');
        }

        // 2. Fetch/cache public keys for each member
        const memberPublicKeys = await chatService.getMemberPublicKeys(members);

        // 3. Perform client-side E2EE encryption (AES-256-GCM + RSA-OAEP for all members)
        const payload = await WebCryptoService.encryptMessage(
          plaintext.trim(),
          memberPublicKeys,
        );

        // 4. Send encrypted payload via Socket.IO
        socketService.sendMessage({
          chat_id: activeChatId,
          sender_id: user.user_id,
          content: payload.content,
          aes_key_encrypted: payload.aes_key_encrypted,
          iv: payload.iv,
          tag: payload.tag,
        });
      } catch (err: any) {
        const errorMsg = err?.message || 'Gửi tin nhắn thất bại';
        setError(errorMsg);
        throw err;
      } finally {
        setIsSending(false);
      }
    },
    [user, status, privateKey, activeChatId, activeChat],
  );

  // Create a new chat
  const createChat = useCallback(
    async (recipientId: number, name?: string, isGroup?: boolean): Promise<ChatItem> => {
      if (!user) {
        throw new Error('Chưa đăng nhập');
      }

      setError(null);
      try {
        const payload: CreateChatPayload = {
          name: isGroup ? name : undefined,
          is_group: isGroup ?? false,
          members: [recipientId],
        };

        const newChat = await chatService.createChat(payload);
        await refreshChats();
        await selectChat(newChat.chat_id);
        return newChat;
      } catch (err: any) {
        const errorMsg = err?.msg || err?.message || 'Không thể tạo cuộc trò chuyện';
        setError(errorMsg);
        throw err;
      }
    },
    [user, refreshChats, selectChat],
  );

  return (
    <ChatContext.Provider
      value={{
        chats,
        activeChatId,
        activeChat,
        messages,
        isLoadingChats,
        isLoadingMessages,
        isSending,
        onlineUserIds,
        socketConnected,
        socketError,
        error,
        selectChat,
        sendMessage,
        createChat,
        refreshChats,
        clearError,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
