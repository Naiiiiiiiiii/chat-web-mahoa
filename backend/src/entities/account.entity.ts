import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { UserProfile } from './user-profile.entity';
import { ChatMember } from './chat-member.entity';
import { Message } from './message.entity';
import { MessageRecipient } from './message-recipient.entity';

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  username: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 200 })
  passwordHash: string;

  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  @Column({ type: 'enum', enum: ['online', 'offline'], default: 'offline' })
  status: 'online' | 'offline';

  @Column({ name: 'last_seen', type: 'datetime', nullable: true })
  lastSeen: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @OneToOne(() => UserProfile, (profile) => profile.account, { cascade: true })
  profile: UserProfile;

  @OneToMany(() => ChatMember, (cm) => cm.account)
  chatMemberships: ChatMember[];

  @OneToMany(() => Message, (msg) => msg.sender)
  sentMessages: Message[];

  @OneToMany(() => MessageRecipient, (mr) => mr.receiver)
  receivedMessages: MessageRecipient[];
}
