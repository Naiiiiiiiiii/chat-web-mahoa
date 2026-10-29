import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Secure Chat Backend (E2E Integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let admin1Token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.listen(5000);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('1. Authentication & Scrypt Compatibility', () => {
    it('POST /auth/login - should fail with wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' })
        .expect(401);

      expect(res.body).toEqual({ msg: 'Invalid credentials' });
    });

    it('POST /auth/login - should log in existing admin user with Scrypt hash', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin', password: '123456' })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(res.body.user_id).toBe(14);
      adminToken = res.body.token;
    });

    it('POST /auth/login - should log in existing admin1 user with Scrypt hash', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'admin1', password: '123456' })
        .expect(200);

      expect(res.body).toHaveProperty('token');
      expect(res.body.user_id).toBe(15);
      admin1Token = res.body.token;
    });
  });

  describe('2. Users API & E2EE Public Keys', () => {
    it('GET /users/14 - should retrieve user profile and RSA public key', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/14')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.user_id).toBe(14);
      expect(res.body.username).toBe('admin');
      expect(res.body.full_name).toBe('Nguyen Quang Thinh');
      expect(res.body.public_key).toContain('BEGIN PUBLIC KEY');
      expect(res.body.public_key).toContain('END PUBLIC KEY');
    });

    it('GET /users/15 - should retrieve other user profile and public key', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/15')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.user_id).toBe(15);
      expect(res.body.username).toBe('admin1');
      expect(res.body.public_key).toContain('BEGIN PUBLIC KEY');
    });

    it('PUT /users/me - should update profile biography', async () => {
      const res = await request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ bio: 'Senior Security Engineer' })
        .expect(200);

      expect(res.body).toEqual({ msg: 'Profile updated' });
    });
  });

  describe('3. Chats API & Membership Security', () => {
    it('GET /chats - should return chat list with unread_count and members', async () => {
      const res = await request(app.getHttpServer())
        .get('/chats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const chat9 = res.body.find((c: any) => c.chat_id === 9);
      expect(chat9).toBeDefined();
      expect(chat9.is_group).toBe(false);
      expect(chat9.members).toContain(14);
      expect(chat9.members).toContain(15);
    });

    it('GET /chats/9 - should return chat detail for member', async () => {
      const res = await request(app.getHttpServer())
        .get('/chats/9')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.chat_id).toBe(9);
      expect(res.body.members).toContain(14);
    });

    it('POST /chats - 1-1 chat deduplication should return existing chat with HTTP 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/chats')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ is_group: false, members: [15] })
        .expect(200);

      expect(res.body.chat_id).toBe(9);
    });

    it('POST /chats/9/mark_read - should mark unread messages as read', async () => {
      const res = await request(app.getHttpServer())
        .post('/chats/9/mark_read')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.msg).toContain('Marked');
    });
  });

  describe('4. Messages API & E2EE Data Integrity', () => {
    it('GET /chats/9/messages - should preserve ciphertext, iv, tag, and aes_key_encrypted', async () => {
      const res = await request(app.getHttpServer())
        .get('/chats/9/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(4);

      // Check message 60
      const msg60 = res.body.find((m: any) => m.id === 60);
      expect(msg60).toBeDefined();
      expect(msg60.sender_id).toBe(15);
      expect(msg60.content).toBe('MvU=');
      expect(msg60.iv).toBe('U7sPwduAf5nNWIq8EIVP2w==');
      expect(msg60.tag).toBe('g8207BYufIz+yLEAXR4y2A==');

      // aes_key_encrypted must contain wrapped keys for both 14 and 15
      const parsedKeys = JSON.parse(msg60.aes_key_encrypted);
      expect(parsedKeys).toHaveProperty('14');
      expect(parsedKeys).toHaveProperty('15');
    });

    it('POST /chats/9/messages - should support sending encrypted message via REST fallback', async () => {
      const res = await request(app.getHttpServer())
        .post('/chats/9/messages')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          content: 'VEVTVF9DSVBIRVI=',
          aes_key_encrypted: {
            '14': 'd3JhcHBlZF9rZXlfMTQ=',
            '15': 'd3JhcHBlZF9rZXlfMTU=',
          },
          iv: 'Tk9OQ0VfMTZfQllURVM=',
          tag: 'VEFHXzE2X0JZVEVTOg==',
        })
        .expect(201);

      expect(res.body.msg).toBe('Sent');
      expect(res.body.message_id).toBeDefined();
    });
  });

  describe('5. Status API (Online Presence & Routing Aliases)', () => {
    it('POST /status - should update status to online', async () => {
      const res = await request(app.getHttpServer())
        .post('/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'online' })
        .expect(200);

      expect(res.body).toEqual({ msg: 'Status updated' });
    });

    it('POST /status/status - alias route should also succeed', async () => {
      const res = await request(app.getHttpServer())
        .post('/status/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'online' })
        .expect(200);

      expect(res.body).toEqual({ msg: 'Status updated' });
    });

    it('GET /status/14 - should return user status', async () => {
      const res = await request(app.getHttpServer())
        .get('/status/14')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.status).toBe('online');
    });
  });

  describe('6. Realtime Socket.IO Gateway', () => {
    let clientSocket: Socket;

    afterEach(async () => {
      if (clientSocket && clientSocket.connected) {
        clientSocket.disconnect();
        // Give time for handleDisconnect to finish before closing
        await new Promise((r) => setTimeout(r, 500));
      }
    });

    it('should connect using JWT token, receive online_users, and handle join_chat', (done) => {
      clientSocket = io('http://127.0.0.1:5001', {
        auth: { token: adminToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        clientSocket.emit('join_chat', { chat_id: 9 });
      });

      clientSocket.on('online_users', (users: number[]) => {
        expect(Array.isArray(users)).toBe(true);
        expect(users).toContain(14);
        done();
      });

      clientSocket.on('error', (err) => {
        done(new Error(JSON.stringify(err)));
      });
    }, 15000);
  });
});
