import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import {
  Account,
  ChatMember,
  Message,
  MessageRecipient,
} from '../../entities';
import { ChatGateway } from './chat.gateway';
import { RealtimeController } from './realtime.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      ChatMember,
      Message,
      MessageRecipient,
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'jwt_secret_key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [RealtimeController],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class RealtimeModule {}
