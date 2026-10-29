import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../entities';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class StatusService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
  ) {}

  async updateStatus(userId: number, dto: UpdateStatusDto) {
    const user = await this.accountRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({ msg: 'User not found' });
    }

    user.status = dto.status;
    if (dto.status === 'offline') {
      user.lastSeen = new Date();
    }
    await this.accountRepository.save(user);

    return { msg: 'Status updated' };
  }

  async getStatus(userId: number) {
    const user = await this.accountRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({ msg: 'User not found' });
    }

    return {
      status: user.status,
      last_seen: user.lastSeen ? user.lastSeen.toISOString() : null,
    };
  }
}
