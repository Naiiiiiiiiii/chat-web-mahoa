import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Account,
  ChatMember,
  Message,
  MessageRecipient,
} from '../../entities';

const socketPort = parseInt(process.env.SOCKET_PORT || '5001', 10);

@WebSocketGateway(socketPort, {
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map: userId -> Set of socket ids
  private connectedUsers = new Map<number, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(ChatMember)
    private readonly chatMemberRepository: Repository<ChatMember>,
    private readonly dataSource: DataSource,
  ) {}

  private getUserIdFromToken(token: string): number | null {
    try {
      const decoded = this.jwtService.verify(token);
      const userId = parseInt(decoded.sub || decoded.userId, 10);
      return isNaN(userId) ? null : userId;
    } catch {
      return null;
    }
  }

  private broadcastOnlineUsers() {
    const users = Array.from(this.connectedUsers.keys());
    this.server.emit('online_users', users);
  }

  async handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      (client.handshake.query?.token as string);

    if (!token) {
      client.disconnect();
      return;
    }

    const userId = this.getUserIdFromToken(token);
    if (!userId) {
      client.disconnect();
      return;
    }

    client.data.userId = userId;

    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId).add(client.id);

    // Cập nhật trạng thái database
    await this.accountRepository.update(userId, { status: 'online' });

    this.broadcastOnlineUsers();
  }

  async handleDisconnect(client: Socket) {
    try {
      const userId = client.data?.userId;
      if (userId && this.connectedUsers.has(userId)) {
        const sockets = this.connectedUsers.get(userId);
        sockets.delete(client.id);

        if (sockets.size === 0) {
          this.connectedUsers.delete(userId);
          await this.accountRepository.update(userId, {
            status: 'offline',
            lastSeen: new Date(),
          });
        }
      }

      this.broadcastOnlineUsers();
    } catch {
      // Ignore disconnect errors during server shutdown
    }
  }

  @SubscribeMessage('join_chat')
  async handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chat_id: number; user_id?: number },
  ) {
    const userId = client.data?.userId;
    const chatId = Number(data?.chat_id);

    if (!userId || !chatId) {
      client.emit('error', { msg: 'Invalid chat_id or user_id' });
      return;
    }

    // Xác thực quyền thành viên trước khi cho vào room
    const isMember = await this.chatMemberRepository.findOne({
      where: { chatId, accountId: userId },
    });

    if (!isMember) {
      client.emit('error', { msg: 'Not a member of this chat' });
      return;
    }

    client.join(`chat_${chatId}`);
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      chat_id: number;
      sender_id: number;
      content: string;
      aes_key_encrypted: Record<string, string> | string;
      iv: string;
      tag: string;
    },
  ) {
    const userId = client.data?.userId;
    const chatId = Number(data?.chat_id);
    const content = data?.content;
    const aesKeyEncrypted = data?.aes_key_encrypted;
    const iv = data?.iv;
    const tag = data?.tag;

    if (
      !chatId ||
      !userId ||
      !content ||
      !iv ||
      !tag ||
      !aesKeyEncrypted
    ) {
      client.emit('error', { msg: 'Invalid data' });
      return;
    }

    // Bảo mật: sender_id luôn là userId đã xác thực từ token handshake
    const senderId = userId;

    // Kiểm tra quyền thành viên
    const chatMembers = await this.chatMemberRepository.find({
      where: { chatId },
    });

    const isMember = chatMembers.some((m) => m.accountId === senderId);
    if (!isMember) {
      client.emit('error', { msg: 'Not in chat' });
      return;
    }

    // Đảm bảo socket người gửi đã gia nhập room trước khi phát tin nhắn
    client.join(`chat_${chatId}`);

    let keyDict: Record<string, string>;
    let aesKeyEncryptedStr: string;

    if (typeof aesKeyEncrypted === 'string') {
      try {
        keyDict = JSON.parse(aesKeyEncrypted);
        aesKeyEncryptedStr = aesKeyEncrypted;
      } catch {
        client.emit('error', { msg: 'Invalid aes_key_encrypted format' });
        return;
      }
    } else if (typeof aesKeyEncrypted === 'object' && aesKeyEncrypted !== null) {
      keyDict = aesKeyEncrypted;
      aesKeyEncryptedStr = JSON.stringify(aesKeyEncrypted);
    } else {
      client.emit('error', { msg: 'Invalid aes_key_encrypted format' });
      return;
    }

    // Lưu vào database với transaction
    const savedMessage = await this.dataSource.transaction(async (manager) => {
      const message = manager.create(Message, {
        chatId,
        senderId,
        content,
        aesKeyEncrypted: aesKeyEncryptedStr,
        iv,
        tag,
      });
      const saved = await manager.save(message);

      for (const m of chatMembers) {
        await manager.save(
          manager.create(MessageRecipient, {
            messageId: saved.id,
            receiverId: m.accountId,
            readAt: m.accountId === senderId ? new Date() : null,
          }),
        );
      }
      return saved;
    });

    // Phát event receive_message tới room chat_<id> (bao gồm cả người gửi)
    const eventPayload = {
      id: savedMessage.id,
      chat_id: chatId,
      sender_id: senderId,
      content,
      aes_key_encrypted: keyDict,
      iv,
      tag,
      timestamp: savedMessage.timestamp.toISOString(),
    };

    this.server.to(`chat_${chatId}`).emit('receive_message', eventPayload);
  }

  // Tiện ích lấy danh sách connected users
  getConnectedUserIds(): number[] {
    return Array.from(this.connectedUsers.keys());
  }
}
