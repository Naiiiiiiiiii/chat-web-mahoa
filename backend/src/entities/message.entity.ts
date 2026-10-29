import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Chat } from './chat.entity';
import { Account } from './account.entity';
import { MessageRecipient } from './message-recipient.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'chat_id', type: 'int' })
  chatId: number;

  @Column({ name: 'sender_id', type: 'int' })
  senderId: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'aes_key_encrypted', type: 'text' })
  aesKeyEncrypted: string;

  @Column({ type: 'text' })
  iv: string;

  @Column({ type: 'text' })
  tag: string;

  @CreateDateColumn({ type: 'datetime' })
  timestamp: Date;

  @ManyToOne(() => Chat, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat: Chat;

  @ManyToOne(() => Account, (acc) => acc.sentMessages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: Account;

  @OneToMany(() => MessageRecipient, (mr) => mr.message, { cascade: true })
  recipients: MessageRecipient[];
}
