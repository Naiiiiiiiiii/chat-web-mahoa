import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Not } from 'typeorm';
import {
  Chat,
  ChatMember,
  Account,
  Message,
  MessageRecipient,
} from '../../entities';
import { CreateChatDto } from './dto/create-chat.dto';

@Injectable()
export class ChatsService {
  constructor(
    @InjectRepository(Chat)
    private readonly chatRepository: Repository<Chat>,
    @InjectRepository(ChatMember)
    private readonly chatMemberRepository: Repository<ChatMember>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(MessageRecipient)
    private readonly messageRecipientRepository: Repository<MessageRecipient>,
    private readonly dataSource: DataSource,
  ) {}

  async serializeChatForUser(chat: Chat, userId: number) {
    const membersIds = chat.members ? chat.members.map((m) => m.accountId) : [];
    let chatName = chat.name;

    if (!chat.isGroup) {
      const otherMemberId = membersIds.find((mid) => mid !== userId);
      if (otherMemberId) {
        const otherUser = await this.accountRepository.findOne({
          where: { id: otherMemberId },
          relations: ['profile'],
        });
        if (otherUser && otherUser.profile?.fullName) {
          chatName = otherUser.profile.fullName;
        } else if (otherUser) {
          chatName = otherUser.username;
        }
      } else {
        chatName = 'My Notes';
      }
    }

    // Logic unread_count: đếm tin nhắn của người khác mà mình chưa đọc trong chat này
    const unreadCount = await this.messageRecipientRepository
      .createQueryBuilder('mr')
      .innerJoin('mr.message', 'm')
      .where('m.chatId = :chatId', { chatId: chat.id })
      .andWhere('mr.receiverId = :userId', { userId })
      .andWhere('mr.readAt IS NULL')
      .andWhere('m.senderId != :userId', { userId })
      .getCount();

    return {
      chat_id: chat.id,
      name: chatName,
      is_group: chat.isGroup,
      members: membersIds,
      created_at: chat.createdAt ? chat.createdAt.toISOString() : new Date().toISOString(),
      unread_count: unreadCount,
    };
  }

  async createChat(creatorId: number, dto: CreateChatDto) {
    const isGroup = dto.is_group ?? false;
    let name = dto.name;
    const membersIds = dto.members || [];

    if (!isGroup) {
      if (membersIds.length !== 1) {
        throw new BadRequestException({
          msg: 'Chat 1-1 yêu cầu chính xác 1 member',
        });
      }

      const otherMemberId = membersIds[0];
      if (otherMemberId === creatorId) {
        throw new BadRequestException({
          msg: 'Không thể tự tạo chat với chính mình theo cách này',
        });
      }

      // Tìm chat 1-1 đã tồn tại
      const existingChat = await this.chatRepository
        .createQueryBuilder('chat')
        .innerJoin('chat.members', 'm1')
        .innerJoin('chat.members', 'm2')
        .leftJoinAndSelect('chat.members', 'all_members')
        .where('chat.isGroup = :isGroup', { isGroup: false })
        .andWhere('m1.accountId = :creatorId', { creatorId })
        .andWhere('m2.accountId = :otherMemberId', { otherMemberId })
        .getOne();

      if (existingChat) {
        return {
          chat: await this.serializeChatForUser(existingChat, creatorId),
          isNew: false,
        };
      }

      const otherUser = await this.accountRepository.findOne({
        where: { id: otherMemberId },
        relations: ['profile'],
      });

      if (!otherUser) {
        throw new NotFoundException({
          msg: `User ${otherMemberId} không tồn tại`,
        });
      }

      name = otherUser.profile?.fullName || otherUser.username;
    }

    return await this.dataSource.transaction(async (manager) => {
      const chat = manager.create(Chat, {
        name: name || null,
        isGroup,
      });
      const savedChat = await manager.save(chat);

      // Thêm người tạo
      await manager.save(
        manager.create(ChatMember, {
          chatId: savedChat.id,
          accountId: creatorId,
        }),
      );

      // Thêm các thành viên khác
      for (const mId of membersIds) {
        if (mId !== creatorId) {
          const userExists = await manager.findOne(Account, {
            where: { id: mId },
          });
          if (userExists) {
            await manager.save(
              manager.create(ChatMember, {
                chatId: savedChat.id,
                accountId: mId,
              }),
            );
          }
        }
      }

      const fullChat = await manager.findOne(Chat, {
        where: { id: savedChat.id },
        relations: ['members'],
      });

      return {
        chat: await this.serializeChatForUser(fullChat, creatorId),
        isNew: true,
      };
    });
  }

  async getChats(userId: number) {
    const memberships = await this.chatMemberRepository.find({
      where: { accountId: userId },
      relations: ['chat', 'chat.members'],
    });

    const results = [];
    for (const m of memberships) {
      if (m.chat) {
        results.push(await this.serializeChatForUser(m.chat, userId));
      }
    }

    return results;
  }

  async getChatDetail(chatId: number, userId: number) {
    const chat = await this.chatRepository.findOne({
      where: { id: chatId },
      relations: ['members'],
    });

    if (!chat) {
      throw new NotFoundException({ msg: 'Chat not found' });
    }

    const isMember = chat.members.some((m) => m.accountId === userId);
    if (!isMember) {
      throw new ForbiddenException({
        msg: 'You are not a member of this chat',
      });
    }

    return await this.serializeChatForUser(chat, userId);
  }

  async markChatAsRead(chatId: number, userId: number) {
    const unreadRecipients = await this.messageRecipientRepository
      .createQueryBuilder('mr')
      .innerJoinAndSelect('mr.message', 'm')
      .where('m.chatId = :chatId', { chatId })
      .andWhere('mr.receiverId = :userId', { userId })
      .andWhere('mr.readAt IS NULL')
      .andWhere('m.senderId != :userId', { userId })
      .getMany();

    const now = new Date();
    for (const r of unreadRecipients) {
      r.readAt = now;
    }

    if (unreadRecipients.length > 0) {
      await this.messageRecipientRepository.save(unreadRecipients);
    }

    return { msg: `Marked ${unreadRecipients.length} messages as read` };
  }
}
