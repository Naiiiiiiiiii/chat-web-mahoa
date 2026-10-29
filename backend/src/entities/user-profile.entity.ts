import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from './account.entity';

@Entity('users')
export class UserProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'int', unique: true })
  accountId: number;

  @Column({ name: 'full_name', type: 'varchar', length: 100, nullable: true })
  fullName: string | null;

  @Column({ type: 'enum', enum: ['male', 'female', 'other'], default: 'other' })
  gender: 'male' | 'female' | 'other';

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 255, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @OneToOne(() => Account, (acc) => acc.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: Account;
}
