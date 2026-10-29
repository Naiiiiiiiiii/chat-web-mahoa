import { io, Socket } from 'socket.io-client';
import {
  ReceiveSocketMessagePayload,
  SendSocketMessagePayload,
} from '../types/chat.types';

export type MessageReceivedCallback = (message: ReceiveSocketMessagePayload) => void;
export type OnlineUsersCallback = (userIds: number[]) => void;
export type ConnectionStateCallback = (connected: boolean, error?: string | null) => void;
export type SocketErrorCallback = (error: { msg: string }) => void;

export class SocketService {
  private socket: Socket | null = null;
  private socketUrl: string;
  private currentToken: string | null = null;
  private currentJoinedChat: { chat_id: number; user_id?: number } | null = null;
  private disconnectTimeout: any = null;

  private messageCallbacks: Set<MessageReceivedCallback> = new Set();
  private onlineUsersCallbacks: Set<OnlineUsersCallback> = new Set();
  private connectionCallbacks: Set<ConnectionStateCallback> = new Set();
  private errorCallbacks: Set<SocketErrorCallback> = new Set();

  constructor(socketUrl?: string) {
    this.socketUrl =
      socketUrl ||
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SOCKET_URL) ||
      'http://localhost:5001';
  }

  public connect(token: string): Socket {
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }

    // Reuse active socket if token has not changed
    if (
      this.socket &&
      this.currentToken === token &&
      (this.socket.connected || (this.socket as any).active)
    ) {
      return this.socket;
    }

    this.currentToken = token;

    // Clean up existing socket if token changed or socket is inactive
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.socket = io(this.socketUrl, {
      auth: { token },
      query: { token }, // Fallback for environments where auth is queried
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.socket.on('connect', () => {
      this.notifyConnectionState(true, null);
      if (this.currentJoinedChat) {
        this.socket?.emit('join_chat', this.currentJoinedChat);
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.notifyConnectionState(false, `Ngắt kết nối: ${reason}`);
    });

    this.socket.on('connect_error', (err) => {
      this.notifyConnectionState(false, err.message || 'Lỗi kết nối máy chủ');
    });

    this.socket.on('online_users', (users: number[]) => {
      this.onlineUsersCallbacks.forEach((cb) => {
        try {
          cb(users);
        } catch {
          // Ignore callback error
        }
      });
    });

    this.socket.on('receive_message', (payload: ReceiveSocketMessagePayload) => {
      this.messageCallbacks.forEach((cb) => {
        try {
          cb(payload);
        } catch {
          // Ignore callback error
        }
      });
    });

    this.socket.on('error', (err: { msg: string }) => {
      this.errorCallbacks.forEach((cb) => {
        try {
          cb(err);
        } catch {
          // Ignore callback error
        }
      });
    });

    return this.socket;
  }

  public disconnect(immediate?: boolean): void {
    if (this.disconnectTimeout) {
      clearTimeout(this.disconnectTimeout);
      this.disconnectTimeout = null;
    }

    const performDisconnect = () => {
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
        this.currentToken = null;
        this.currentJoinedChat = null;
        this.notifyConnectionState(false, null);
      }
    };

    // Immediate in Node/test environments or on explicit user logout
    const shouldBeImmediate = immediate ?? (typeof window === 'undefined');
    if (shouldBeImmediate) {
      performDisconnect();
    } else {
      // Debounce disconnect by 150ms in browser to avoid aborting WebSocket in React StrictMode/HMR
      this.disconnectTimeout = setTimeout(performDisconnect, 150);
    }
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public joinChat(chatId: number, userId?: number): void {
    this.currentJoinedChat = { chat_id: chatId, user_id: userId };
    if (!this.socket || !this.socket.connected) {
      return;
    }
    this.socket.emit('join_chat', this.currentJoinedChat);
  }

  public sendMessage(payload: SendSocketMessagePayload): void {
    if (!this.socket || !this.socket.connected) {
      throw new Error('Chưa kết nối đến máy chủ, không thể gửi tin nhắn.');
    }
    this.socket.emit('send_message', payload);
  }

  public onMessageReceived(cb: MessageReceivedCallback): () => void {
    this.messageCallbacks.add(cb);
    return () => this.messageCallbacks.delete(cb);
  }

  public onOnlineUsers(cb: OnlineUsersCallback): () => void {
    this.onlineUsersCallbacks.add(cb);
    return () => this.onlineUsersCallbacks.delete(cb);
  }

  public onConnectionState(cb: ConnectionStateCallback): () => void {
    this.connectionCallbacks.add(cb);
    return () => this.connectionCallbacks.delete(cb);
  }

  public onError(cb: SocketErrorCallback): () => void {
    this.errorCallbacks.add(cb);
    return () => this.errorCallbacks.delete(cb);
  }

  private notifyConnectionState(connected: boolean, error?: string | null): void {
    this.connectionCallbacks.forEach((cb) => {
      try {
        cb(connected, error);
      } catch {
        // Ignore
      }
    });
  }
}

export const socketService = new SocketService();
