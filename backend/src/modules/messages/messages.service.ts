import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Message,
  MessageRecipient,
  ChatMember,
  Chat,
} from '../../entities';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageRecipient)
    private readonly messageRecipientRepository: Repository<MessageRecipient>,
    @InjectRepository(ChatMember)
    private readonly chatMemberRepository: Repository<ChatMember>,
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    private readonly dataSource: DataSource,
  ) {}

  async sendMessage(
    chatId: number,
    senderId: number,
    dto: SendMessageDto,
  ): Promise<{ msg: string; message_id: number }> {
    const required = ['content', 'aes_key_encrypted', 'iv', 'tag'] as const;
    for (const f of required) {
      if (!dto[f]) {
        throw new BadRequestException({ msg: `Missing ${f}` });
      }
    }

    const chatMembers = await this.chatMemberRepository.find({
      where: { chatId },
    });

    const isMember = chatMembers.some((m) => m.accountId === senderId);
    if (!isMember) {
      throw new ForbiddenException({ msg: 'Not in chat' });
    }

    const aesKeyEncryptedStr =
      typeof dto.aes_key_encrypted === 'object'
        ? JSON.stringify(dto.aes_key_encrypted)
        : dto.aes_key_encrypted;

    return await this.dataSource.transaction(async (manager) => {
      const message = manager.create(Message, {
        chatId,
        senderId,
        content: dto.content,
        aesKeyEncrypted: aesKeyEncryptedStr,
        iv: dto.iv,
        tag: dto.tag,
      });
      const savedMessage = await manager.save(message);

      for (const m of chatMembers) {
        const recipient = manager.create(MessageRecipient, {
          messageId: savedMessage.id,
          receiverId: m.accountId,
          readAt: m.accountId === senderId ? new Date() : null, // người gửi tự động xem như đã đọc
        });
        await manager.save(recipient);
      }

      return { msg: 'Sent', message_id: savedMessage.id };
    });
  }

  async getMessages(chatId: number, userId: number) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
    });
    if (!chat) {
      throw new NotFoundException({ msg: 'Chat not found' });
    }

    const isMember = await this.chatMemberRepository.findOne({
      where: { chatId, accountId: userId },
    });
    if (!isMember) {
      throw new ForbiddenException({ msg: 'You are not a member of this chat' });
    }

    const messages = await this.messageRepository.find({
      where: { chatId },
      relations: ['recipients'],
      order: { timestamp: 'ASC' },
    });

    return messages.map((m) => ({
      id: m.id,
      sender_id: m.senderId,
      content: m.content,
      aes_key_encrypted: m.aesKeyEncrypted,
      iv: m.iv,
      tag: m.tag,
      timestamp: m.timestamp.toISOString(),
      recipients: m.recipients ? m.recipients.map((r) => r.receiverId) : [],
    }));
  }
}
