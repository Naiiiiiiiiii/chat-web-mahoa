import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Account, UserProfile } from '../../entities';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordUtil } from '../../common/utils/password.util';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepository: Repository<UserProfile>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async register(dto: RegisterDto): Promise<{ msg: string; user_id: number }> {
    const username = dto.username.trim();
    const password = dto.password.trim();
    const publicKey = dto.public_key.trim();

    if (!username || !password || !publicKey) {
      throw new BadRequestException({
        msg: 'Username, password and public_key are required',
      });
    }

    const existing = await this.accountRepository.findOne({
      where: { username },
    });
    if (existing) {
      throw new BadRequestException({ msg: 'Username already exists' });
    }

    const passwordHash = PasswordUtil.hashPassword(password);

    return await this.dataSource.transaction(async (manager) => {
      const account = manager.create(Account, {
        username,
        passwordHash,
        publicKey,
        status: 'offline',
      });
      const savedAccount = await manager.save(account);

      let dob: Date | null = null;
      if (dto.date_of_birth) {
        dob = new Date(dto.date_of_birth);
        if (isNaN(dob.getTime())) {
          dob = null;
        }
      }

      const profile = manager.create(UserProfile, {
        accountId: savedAccount.id,
        fullName: dto.full_name || null,
        gender: dto.gender || 'other',
        dateOfBirth: dob,
        avatarUrl: dto.avatar_url || null,
        bio: dto.bio || null,
      });
      await manager.save(profile);

      return { msg: 'User created', user_id: savedAccount.id };
    });
  }

  async login(dto: LoginDto): Promise<{ token: string; user_id: number }> {
    const username = dto.username.trim();
    const password = dto.password.trim();

    const account = await this.accountRepository.findOne({
      where: { username },
    });

    if (!account || !PasswordUtil.verifyPassword(password, account.passwordHash)) {
      throw new UnauthorizedException({ msg: 'Invalid credentials' });
    }

    account.status = 'online';
    account.lastSeen = new Date();
    await this.accountRepository.save(account);

    const payload = {
      sub: account.id.toString(),
      userId: account.id,
      username: account.username,
    };

    const token = this.jwtService.sign(payload);
    return { token, user_id: account.id };
  }

  async logout(userId: number): Promise<{ msg: string }> {
    const account = await this.accountRepository.findOne({
      where: { id: userId },
    });
    if (account) {
      account.status = 'offline';
      account.lastSeen = new Date();
      await this.accountRepository.save(account);
    }
    return { msg: 'Logged out' };
  }
}
