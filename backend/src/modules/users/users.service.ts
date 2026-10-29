import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account, UserProfile } from '../../entities';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,
  ) {}

  async getUserById(userId: number) {
    const user = await this.accountRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException({ msg: 'User not found' });
    }

    const profile = user.profile;

    return {
      user_id: user.id,
      username: user.username,
      full_name: profile?.fullName || null,
      gender: profile?.gender || 'other',
      date_of_birth: profile?.dateOfBirth
        ? typeof profile.dateOfBirth === 'string'
          ? profile.dateOfBirth
          : profile.dateOfBirth.toISOString().split('T')[0]
        : null,
      avatar_url: profile?.avatarUrl || null,
      bio: profile?.bio || null,
      status: user.status,
      last_seen: user.lastSeen ? user.lastSeen.toISOString() : null,
      public_key: user.publicKey,
    };
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.accountRepository.findOne({
      where: { id: userId },
      relations: ['profile'],
    });

    if (!user) {
      throw new NotFoundException({ msg: 'User not found' });
    }

    let profile = user.profile;
    if (!profile) {
      profile = this.userProfileRepository.create({ accountId: user.id });
    }

    if (dto.full_name !== undefined) {
      profile.fullName = dto.full_name;
    }
    if (dto.gender !== undefined) {
      profile.gender = dto.gender;
    }
    if (dto.date_of_birth !== undefined) {
      profile.dateOfBirth = dto.date_of_birth
        ? new Date(dto.date_of_birth)
        : null;
    }
    if (dto.avatar_url !== undefined) {
      profile.avatarUrl = dto.avatar_url;
    }
    if (dto.bio !== undefined) {
      profile.bio = dto.bio;
    }

    await this.userProfileRepository.save(profile);
    return { msg: 'Profile updated' };
  }
}
