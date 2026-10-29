import { UserProfileResponse } from './auth.types';

export interface ChatItem {
  chat_id: number;
  name: string;
  is_group: boolean;
  members: number[];
  created_at: string;
  unread_count: number;
}

export interface ChatMessageRaw {
  id: number;
  chat_id: number;
  sender_id: number;
  content: string;
  aes_key_encrypted: Record<string, string> | string;
  iv: string;
  tag: string;
  timestamp: string;
  recipients?: number[];
}

export interface DecryptedChatMessage {
  id: number;
  chat_id: number;
  sender_id: number;
  text: string;
  isDecrypted: boolean;
  decryptionError?: string;
  timestamp: string;
  isOwn: boolean;
  senderName?: string;
}

export interface CreateChatPayload {
  name?: string;
  is_group?: boolean;
  members: number[];
}

export interface SendSocketMessagePayload {
  chat_id: number;
  sender_id: number;
  content: string;
  aes_key_encrypted: Record<string, string>;
  iv: string;
  tag: string;
}

export interface ReceiveSocketMessagePayload {
  id: number;
  chat_id: number;
  sender_id: number;
  content: string;
  aes_key_encrypted: Record<string, string>;
  iv: string;
  tag: string;
  timestamp: string;
}

export interface SocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  onlineUsers: number[];
}
