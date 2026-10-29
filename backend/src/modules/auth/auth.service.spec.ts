import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { Account, UserProfile } from '../../entities';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PasswordUtil } from '../../common/utils/password.util';

describe('AuthService', () => {
  let service: AuthService;
  let accountRepo: any;
  let userProfileRepo: any;
  let jwtService: any;
  let dataSource: any;

  beforeEach(async () => {
    accountRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((e) => e),
    };
    userProfileRepo = {
      create: jest.fn((e) => e),
      save: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('mock_jwt_token'),
    };
    dataSource = {
      transaction: jest.fn(async (cb) => {
        const manager = {
          create: jest.fn((entity, data) => ({ ...data, id: 99 })),
          save: jest.fn((entity) => Promise.resolve(entity)),
          findOne: jest.fn().mockResolvedValue({ id: 99 }),
        };
        return cb(manager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(Account), useValue: accountRepo },
        { provide: getRepositoryToken(UserProfile), useValue: userProfileRepo },
        { provide: JwtService, useValue: jwtService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should successfully login with valid credentials (scrypt)', async () => {
      const password = 'correct_password';
      const passwordHash = PasswordUtil.hashPassword(password);
      accountRepo.findOne.mockResolvedValue({
        id: 14,
        username: 'admin',
        passwordHash,
        status: 'offline',
      });

      const result = await service.login({
        username: 'admin',
        password,
      });

      expect(result).toEqual({
        token: 'mock_jwt_token',
        user_id: 14,
      });
      expect(accountRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'online' }),
      );
    });

    it('should throw UnauthorizedException on wrong password', async () => {
      const passwordHash = PasswordUtil.hashPassword('secret123');
      accountRepo.findOne.mockResolvedValue({
        id: 14,
        username: 'admin',
        passwordHash,
      });

      await expect(
        service.login({ username: 'admin', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ username: 'nonexistent', password: 'any' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should throw BadRequestException if username already exists', async () => {
      accountRepo.findOne.mockResolvedValue({ id: 1, username: 'taken' });

      await expect(
        service.register({
          username: 'taken',
          password: 'pw',
          public_key: 'key',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should register successfully using transaction', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      const res = await service.register({
        username: 'newuser',
        password: 'password123',
        public_key: 'PEM_PUBLIC_KEY',
        full_name: 'New User Full Name',
      });

      expect(res).toEqual({ msg: 'User created', user_id: 99 });
      expect(dataSource.transaction).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should set status to offline and return msg', async () => {
      const account = { id: 14, status: 'online', lastSeen: null };
      accountRepo.findOne.mockResolvedValue(account);

      const res = await service.logout(14);
      expect(res).toEqual({ msg: 'Logged out' });
      expect(account.status).toBe('offline');
      expect(accountRepo.save).toHaveBeenCalledWith(account);
    });
  });
});
