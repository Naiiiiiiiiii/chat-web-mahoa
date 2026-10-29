import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Message } from './message.entity';
import { Account } from './account.entity';

@Entity('message_recipients')
@Unique('message_id_receiver_id_unique', ['messageId', 'receiverId'])
export class MessageRecipient {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'message_id', type: 'int' })
  messageId: number;

  @Column({ name: 'receiver_id', type: 'int' })
  receiverId: number;

  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt: Date | null;

  @ManyToOne(() => Message, (msg) => msg.recipients, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @ManyToOne(() => Account, (acc) => acc.receivedMessages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiver_id' })
  receiver: Account;
}
