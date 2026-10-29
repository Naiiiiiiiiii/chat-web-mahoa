import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat, ChatMember, Account, Message, MessageRecipient } from '../../entities';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Chat,
      ChatMember,
      Account,
      Message,
      MessageRecipient,
    ]),
  ],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
