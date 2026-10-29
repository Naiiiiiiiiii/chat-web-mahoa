import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Chat } from './chat.entity';
import { Account } from './account.entity';

@Entity('chat_members')
@Unique('chat_id_account_id_unique', ['chatId', 'accountId'])
export class ChatMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'chat_id', type: 'int' })
  chatId: number;

  @Column({ name: 'account_id', type: 'int' })
  accountId: number;

  @CreateDateColumn({ name: 'joined_at', type: 'datetime' })
  joinedAt: Date;

  @ManyToOne(() => Chat, (c) => c.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @ManyToOne(() => Account, (acc) => acc.chatMemberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: Account;
}
