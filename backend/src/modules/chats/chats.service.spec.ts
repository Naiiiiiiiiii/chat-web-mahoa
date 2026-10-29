import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ChatsService } from './chats.service';
import {
  Chat,
  ChatMember,
  Account,
  MessageRecipient,
} from '../../entities';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('ChatsService', () => {
  let service: ChatsService;
  let chatRepo: any;
  let chatMemberRepo: any;
  let accountRepo: any;
  let messageRecipientRepo: any;
  let dataSource: any;

  beforeEach(async () => {
    chatRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    chatMemberRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((e) => e),
      save: jest.fn(),
    };
    accountRepo = {
      findOne: jest.fn(),
    };
    messageRecipientRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatsService,
        { provide: getRepositoryToken(Chat), useValue: chatRepo },
        { provide: getRepositoryToken(ChatMember), useValue: chatMemberRepo },
        { provide: getRepositoryToken(Account), useValue: accountRepo },
        { provide: getRepositoryToken(MessageRecipient), useValue: messageRecipientRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<ChatsService>(ChatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createChat 1-1 validation', () => {
    it('should throw BadRequestException if members count != 1 for 1-1 chat', async () => {
      await expect(
        service.createChat(14, { is_group: false, members: [15, 16] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if trying to chat with oneself', async () => {
      await expect(
        service.createChat(14, { is_group: false, members: [14] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getChatDetail', () => {
    it('should throw NotFoundException if chat does not exist', async () => {
      chatRepo.findOne.mockResolvedValue(null);

      await expect(service.getChatDetail(999, 14)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not a member of chat', async () => {
      chatRepo.findOne.mockResolvedValue({
        id: 9,
        members: [{ accountId: 15 }, { accountId: 16 }],
      });

      await expect(service.getChatDetail(9, 14)).rejects.toThrow(ForbiddenException);
    });
  });
});
