import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MessagesService } from './messages.service';
import {
  Message,
  MessageRecipient,
  ChatMember,
  Chat,
} from '../../entities';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';

describe('MessagesService', () => {
  let service: MessagesService;
  let messageRepo: any;
  let messageRecipientRepo: any;
  let chatMemberRepo: any;
  let chatRepo: any;
  let dataSource: any;

  beforeEach(async () => {
    messageRepo = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((e) => e),
    };
    messageRecipientRepo = {
      create: jest.fn((e) => e),
      save: jest.fn(),
    };
    chatMemberRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    chatRepo = {
      findOne: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: getRepositoryToken(Message), useValue: messageRepo },
        { provide: getRepositoryToken(MessageRecipient), useValue: messageRecipientRepo },
        { provide: getRepositoryToken(ChatMember), useValue: chatMemberRepo },
        { provide: getRepositoryToken(Chat), useValue: chatRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendMessage', () => {
    it('should throw BadRequestException if required fields are missing', async () => {
      await expect(
        service.sendMessage(9, 14, {
          content: '',
          aes_key_encrypted: '',
          iv: '',
          tag: '',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if sender is not member of chat', async () => {
      chatMemberRepo.find.mockResolvedValue([
        { chatId: 9, accountId: 15 },
        { chatId: 9, accountId: 16 },
      ]);

      await expect(
        service.sendMessage(9, 14, {
          content: 'encrypted_content',
          aes_key_encrypted: { '15': 'wrapped_key' },
          iv: 'iv_value',
          tag: 'tag_value',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessages', () => {
    it('should throw NotFoundException if chat does not exist', async () => {
      chatRepo.findOne.mockResolvedValue(null);

      await expect(service.getMessages(999, 14)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not member', async () => {
      chatRepo.findOne.mockResolvedValue({ id: 9 });
      chatMemberRepo.findOne.mockResolvedValue(null);

      await expect(service.getMessages(9, 14)).rejects.toThrow(ForbiddenException);
    });
  });
});
