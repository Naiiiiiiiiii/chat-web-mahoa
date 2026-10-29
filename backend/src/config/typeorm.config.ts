import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  Account,
  UserProfile,
  Chat,
  ChatMember,
  Message,
  MessageRecipient,
} from '../entities';

export const getTypeOrmConfig = (): TypeOrmModuleOptions => ({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_DATABASE || 'secure_chat',
  entities: [
    Account,
    UserProfile,
    Chat,
    ChatMember,
    Message,
    MessageRecipient,
  ],
  synchronize: false, // Bắt buộc: Không tự động thay đổi schema CSDL thật
  logging: process.env.NODE_ENV === 'development',
});
