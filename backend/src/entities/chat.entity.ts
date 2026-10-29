import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { ChatMember } from './chat-member.entity';
import { Message } from './message.entity';

@Entity('chats')
export class Chat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ name: 'is_group', type: 'boolean', default: false })
  isGroup: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;

  @OneToMany(() => ChatMember, (cm) => cm.chat, { cascade: true })
  members: ChatMember[];

  @OneToMany(() => Message, (msg) => msg.chat, { cascade: true })
  messages: Message[];
}
