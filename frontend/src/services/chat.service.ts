import { apiClient } from './api.client';
import { WebCryptoService } from './crypto.service';
import {
  ChatItem,
  ChatMessageRaw,
  CreateChatPayload,
  DecryptedChatMessage,
} from '../types/chat.types';
import { UserProfileResponse } from '../types/auth.types';

export class ChatService {
  // Cache for public keys of users: userId -> CryptoKey
  private publicKeyCache: Map<number, CryptoKey> = new Map();
  // Cache for user profiles: userId -> UserProfileResponse
  private userProfileCache: Map<number, UserProfileResponse> = new Map();

  /**
   * Retrieves list of chats for the current user
   */
  async getChats(): Promise<ChatItem[]> {
    return apiClient.get<ChatItem[]>('/chats');
  }

  /**
   * Retrieves single chat detail
   */
  async getChatDetail(chatId: number): Promise<ChatItem> {
    return apiClient.get<ChatItem>(`/chats/${chatId}`);
  }

  /**
   * Creates a new chat (1-1 or group)
   */
  async createChat(payload: CreateChatPayload): Promise<ChatItem> {
    return apiClient.post<ChatItem>('/chats', payload);
  }

  /**
   * Fetches historical raw messages from REST API
   */
  async getMessages(chatId: number): Promise<ChatMessageRaw[]> {
    return apiClient.get<ChatMessageRaw[]>(`/chats/${chatId}/messages`);
  }

  /**
   * Marks unread messages in a chat as read
   */
  async markRead(chatId: number): Promise<{ msg: string }> {
    return apiClient.post<{ msg: string }>(`/chats/${chatId}/mark_read`);
  }

  /**
   * Gets a user's profile with public key (cached)
   */
  async getUserProfile(userId: number): Promise<UserProfileResponse> {
    if (this.userProfileCache.has(userId)) {
      return this.userProfileCache.get(userId)!;
    }
    const profile = await apiClient.get<UserProfileResponse>(`/users/${userId}`);
    this.userProfileCache.set(userId, profile);
    return profile;
  }

  /**
   * Gets and caches imported CryptoKey for a user's public key
   */
  async getPublicKey(userId: number): Promise<CryptoKey> {
    if (this.publicKeyCache.has(userId)) {
      return this.publicKeyCache.get(userId)!;
    }
    const profile = await this.getUserProfile(userId);
    if (!profile.public_key) {
      throw new Error(`Người dùng ID ${userId} chưa thiết lập dữ liệu bảo mật trên máy chủ.`);
    }

    const importedKey = await WebCryptoService.importPublicKeyPem(profile.public_key);
    this.publicKeyCache.set(userId, importedKey);
    return importedKey;
  }

  /**
   * Pre-fetches and returns a dictionary of member public keys for encrypting a message:
   * Record<string, CryptoKey> where keys are member user ID strings
   */
  async getMemberPublicKeys(
    memberIds: number[],
  ): Promise<Record<string, CryptoKey>> {
    const keysMap: Record<string, CryptoKey> = {};
    for (const memberId of memberIds) {
      try {
        const key = await this.getPublicKey(memberId);
        keysMap[memberId.toString()] = key;
      } catch (err: any) {
        throw new Error(
          `Không thể gửi tin nhắn an toàn: Thành viên ID ${memberId} chưa kích hoạt bảo mật.`,
        );
      }
    }
    return keysMap;
  }

  /**
   * Decrypts a raw message using current user's private key
   * Returns DecryptedChatMessage with failure handled gracefully (never crashes UI)
   */
  async decryptMessage(
    raw: ChatMessageRaw,
    currentUserId: number,
    privateKey: CryptoKey | null,
  ): Promise<DecryptedChatMessage> {
    const isOwn = raw.sender_id === currentUserId;

    // Parse aes_key_encrypted if JSON string
    let keyDict: Record<string, string>;
    try {
      if (typeof raw.aes_key_encrypted === 'string') {
        keyDict = JSON.parse(raw.aes_key_encrypted);
      } else if (typeof raw.aes_key_encrypted === 'object' && raw.aes_key_encrypted !== null) {
        keyDict = raw.aes_key_encrypted;
      } else {
        keyDict = {};
      }
    } catch {
      keyDict = {};
    }

    const wrappedKey = keyDict[currentUserId.toString()];

    // If private key is not unlocked or not available in session
    if (!privateKey) {
      return {
        id: raw.id,
        chat_id: raw.chat_id,
        sender_id: raw.sender_id,
        text: '🔒 (Tin nhắn bảo mật - Vui lòng mở khóa để xem)',
        isDecrypted: false,
        decryptionError: 'Dữ liệu bảo mật chưa được mở khóa',
        timestamp: raw.timestamp,
        isOwn,
      };
    }

    // If message does not have wrapped key for current user
    if (!wrappedKey) {
      return {
        id: raw.id,
        chat_id: raw.chat_id,
        sender_id: raw.sender_id,
        text: '🔒 (Tin nhắn bảo mật - Không có khóa giải mã cho tài khoản này)',
        isDecrypted: false,
        decryptionError: 'Không có khóa giải mã cho tài khoản này',
        timestamp: raw.timestamp,
        isOwn,
      };
    }

    try {
      // 1. Unwrap AES-256 key with RSA Private Key
      const rawAesKey = await WebCryptoService.unwrapAesKey(wrappedKey, privateKey);

      // 2. Decrypt AES-256-GCM ciphertext + tag
      const text = await WebCryptoService.decryptMessage(
        raw.content,
        raw.iv,
        raw.tag,
        rawAesKey,
      );

      return {
        id: raw.id,
        chat_id: raw.chat_id,
        sender_id: raw.sender_id,
        text,
        isDecrypted: true,
        timestamp: raw.timestamp,
        isOwn,
      };
    } catch (err: any) {
      return {
        id: raw.id,
        chat_id: raw.chat_id,
        sender_id: raw.sender_id,
        text: '🔒 (Tin nhắn mã hóa E2EE - Giải mã thất bại: Khóa hoặc chữ ký không khớp)',
        isDecrypted: false,
        decryptionError: err?.message || 'Lỗi giải mã E2EE',
        timestamp: raw.timestamp,
        isOwn,
      };
    }
  }

  /**
   * Clears in-memory public key cache
   */
  clearCache(): void {
    this.publicKeyCache.clear();
    this.userProfileCache.clear();
  }
}

export const chatService = new ChatService();
