import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../../entities/account.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'jwt_secret_key',
    });
  }

  async validate(payload: any) {
    const userId = parseInt(payload.sub || payload.userId, 10);
    if (!userId) {
      throw new UnauthorizedException({ msg: 'Invalid token' });
    }

    const account = await this.accountRepository.findOne({
      where: { id: userId },
    });

    if (!account) {
      throw new UnauthorizedException({ msg: 'User not found' });
    }

    return {
      userId: account.id,
      username: account.username,
    };
  }
}
