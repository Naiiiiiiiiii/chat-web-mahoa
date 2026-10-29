import { io, Socket } from 'socket.io-client';
import { WebCryptoService } from '../services/crypto.service';
import { Asn1Util } from '../utils/asn1.util';

const REST_URL = 'http://127.0.0.1:5000';
const SOCKET_URL = 'http://127.0.0.1:5001';

describe('Phase 4: Live End-to-End Integration Verification', () => {
  let tokenA: string;
  let userAId: number;
  let keyPairA: {
    publicKeyPem: string;
    privateKeyPem: string;
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  };
  let socketA: Socket;

  let tokenB: string;
  let userBId: number;
  let keyPairB: {
    publicKeyPem: string;
    privateKeyPem: string;
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  };
  let socketB: Socket;

  let createdChatId: number;

  const testUserAName = `e2e_user_a_${Date.now()}`;
  const testUserBName = `e2e_user_b_${Date.now()}`;
  const testPassword = 'Password123!';

  // Legacy admin fixture
  const legacyAdminKeyFile = {
    ciphertext:
      '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',
    iv: '8Kg7tsN8BYzyrxDpvcx0Ng==',
    tag: '+T2ut6s6cV+WTfw+C23emQ==',
    salt: 'stGyx3kQK2vCdRcPL/lHXw==',
  };

  afterAll(() => {
    if (socketA?.connected) socketA.disconnect();
    if (socketB?.connected) socketB.disconnect();
  });

  describe('1. Live Service Health & Database Handshake', () => {
    it('confirms backend REST is listening and connected_users returns empty array', async () => {
      const res = await fetch(`${REST_URL}/_connected_users`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.connected_users)).toBe(true);
    });
  });

  describe('2. Two-User Registration, Login & Key Exchange', () => {
    it('registers User A with RSA-2048 Public Key and logs in to obtain JWT', async () => {
      keyPairA = await WebCryptoService.generateRsaKeyPair();

      const regRes = await fetch(`${REST_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUserAName,
          password: testPassword,
          public_key: keyPairA.publicKeyPem,
          full_name: 'E2E Tester A',
        }),
      });
      expect(regRes.status).toBe(201);
      const regData = await regRes.json();
      userAId = regData.user_id;
      expect(userAId).toBeGreaterThan(0);

      // Login User A
      const loginRes = await fetch(`${REST_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUserAName,
          password: testPassword,
        }),
      });
      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      tokenA = loginData.token;
      expect(typeof tokenA).toBe('string');
    });

    it('registers User B with RSA-2048 Public Key and logs in to obtain JWT', async () => {
      keyPairB = await WebCryptoService.generateRsaKeyPair();

      const regRes = await fetch(`${REST_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUserBName,
          password: testPassword,
          public_key: keyPairB.publicKeyPem,
          full_name: 'E2E Tester B',
        }),
      });
      expect(regRes.status).toBe(201);
      const regData = await regRes.json();
      userBId = regData.user_id;
      expect(userBId).toBeGreaterThan(0);

      // Login User B
      const loginRes = await fetch(`${REST_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUserBName,
          password: testPassword,
        }),
      });
      expect(loginRes.status).toBe(200);
      const loginData = await loginRes.json();
      tokenB = loginData.token;
      expect(typeof tokenB).toBe('string');
    });
  });

  describe('3. Chat Creation & Realtime Socket.IO Handshake', () => {
    it('creates 1-1 chat between User A and User B via REST', async () => {
      const createRes = await fetch(`${REST_URL}/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          members: [userBId],
          is_group: false,
        }),
      });
      expect([200, 201]).toContain(createRes.status);
      const chatData = await createRes.json();
      createdChatId = chatData.chat_id;
      expect(createdChatId).toBeGreaterThan(0);

      // User B verifies chat exists
      const bChatsRes = await fetch(`${REST_URL}/chats`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      expect(bChatsRes.status).toBe(200);
      const bChats = await bChatsRes.json();
      expect(bChats.some((c: any) => c.chat_id === createdChatId)).toBe(true);
    });

    it('establishes live Socket.IO connection for both User A and User B and joins chat room', async () => {
      // Connect User A
      socketA = io(SOCKET_URL, {
        auth: { token: tokenA },
        transports: ['websocket'],
      });

      // Connect User B
      socketB = io(SOCKET_URL, {
        auth: { token: tokenB },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        let connectedCount = 0;
        const check = () => {
          connectedCount++;
          if (connectedCount === 2) resolve();
        };
        socketA.on('connect', check);
        socketB.on('connect', check);
      });

      expect(socketA.connected).toBe(true);
      expect(socketB.connected).toBe(true);

      // Join chat room
      socketA.emit('join_chat', { chat_id: createdChatId, user_id: userAId });
      socketB.emit('join_chat', { chat_id: createdChatId, user_id: userBId });
    });
  });

  describe('4. Realtime End-to-End Encrypted Message Transmission & Decryption', () => {
    let sentMessageId: number;
    const testSecretMessage = 'Tin nhắn E2EE kiểm thử End-to-End tuyệt mật 🚀 2026';

    it('User A encrypts for A & B, emits send_message, and User B receives and decrypts realtime', async () => {
      // 1. Fetch public keys for chat members (A and B)
      const recipientPublicKeys = {
        [userAId.toString()]: keyPairA.publicKey,
        [userBId.toString()]: keyPairB.publicKey,
      };

      // 2. Encrypt plaintext
      const encryptedPayload = await WebCryptoService.encryptMessage(
        testSecretMessage,
        recipientPublicKeys,
      );

      // 3. User B listens for receive_message
      const receivePromise = new Promise<any>((resolve) => {
        socketB.on('receive_message', (data) => {
          if (data.chat_id === createdChatId) {
            resolve(data);
          }
        });
      });

      // 4. User A sends message
      socketA.emit('send_message', {
        chat_id: createdChatId,
        sender_id: userAId,
        content: encryptedPayload.content,
        aes_key_encrypted: encryptedPayload.aes_key_encrypted,
        iv: encryptedPayload.iv,
        tag: encryptedPayload.tag,
      });

      const receivedMsg = await receivePromise;
      sentMessageId = receivedMsg.id;

      expect(receivedMsg.sender_id).toBe(userAId);
      expect(receivedMsg.content).toBe(encryptedPayload.content);
      expect(receivedMsg.aes_key_encrypted[userBId.toString()]).toBeDefined();

      // 5. User B decrypts message using User B's private key
      const wrappedKeyForB = receivedMsg.aes_key_encrypted[userBId.toString()];
      const rawAesKeyB = await WebCryptoService.unwrapAesKey(
        wrappedKeyForB,
        keyPairB.privateKey,
      );
      const plaintextB = await WebCryptoService.decryptMessage(
        receivedMsg.content,
        receivedMsg.iv,
        receivedMsg.tag,
        rawAesKeyB,
      );

      expect(plaintextB).toBe(testSecretMessage);

      // 6. User A also decrypts the message using User A's private key
      const wrappedKeyForA = receivedMsg.aes_key_encrypted[userAId.toString()];
      const rawAesKeyA = await WebCryptoService.unwrapAesKey(
        wrappedKeyForA,
        keyPairA.privateKey,
      );
      const plaintextA = await WebCryptoService.decryptMessage(
        receivedMsg.content,
        receivedMsg.iv,
        receivedMsg.tag,
        rawAesKeyA,
      );

      expect(plaintextA).toBe(testSecretMessage);
    });

    it('reloads chat history via REST API and successfully decrypts historical message', async () => {
      const res = await fetch(`${REST_URL}/chats/${createdChatId}/messages`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      expect(res.status).toBe(200);
      const messages = await res.json();
      expect(messages.length).toBeGreaterThan(0);

      const targetMsg = messages.find((m: any) => m.id === sentMessageId);
      expect(targetMsg).toBeDefined();

      // Decrypt target message from REST
      const keysDict =
        typeof targetMsg.aes_key_encrypted === 'string'
          ? JSON.parse(targetMsg.aes_key_encrypted)
          : targetMsg.aes_key_encrypted;

      const rawAesKey = await WebCryptoService.unwrapAesKey(
        keysDict[userBId.toString()],
        keyPairB.privateKey,
      );
      const decrypted = await WebCryptoService.decryptMessage(
        targetMsg.content,
        targetMsg.iv,
        targetMsg.tag,
        rawAesKey,
      );

      expect(decrypted).toBe(testSecretMessage);
    });

    it('marks chat as read via REST API', async () => {
      const res = await fetch(`${REST_URL}/chats/${createdChatId}/mark_read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('5. Legacy Compatibility: Live Historical Messages 60 and 61', () => {
    it('authenticates legacy admin account and decrypts live Message 60 and Message 61 from MySQL', async () => {
      // 1. Authenticate admin (ID 14)
      const loginRes = await fetch(`${REST_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: '123456',
        }),
      });
      expect(loginRes.status).toBe(200);
      const { token: adminToken } = await loginRes.json();

      // 2. Fetch messages from legacy chat 9
      const msgsRes = await fetch(`${REST_URL}/chats/9/messages`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(msgsRes.status).toBe(200);
      const chat9Messages = await msgsRes.json();

      // 3. Unlock admin legacy private key
      const { privateKey: adminPrivateKey } =
        await WebCryptoService.unlockPrivateKey(legacyAdminKeyFile, '123456');

      // 4. Decrypt live Message 60
      const msg60 = chat9Messages.find((m: any) => m.id === 60);
      expect(msg60).toBeDefined();

      const msg60Keys =
        typeof msg60.aes_key_encrypted === 'string'
          ? JSON.parse(msg60.aes_key_encrypted)
          : msg60.aes_key_encrypted;

      const aesKey60 = await WebCryptoService.unwrapAesKey(
        msg60Keys['14'],
        adminPrivateKey,
      );
      const text60 = await WebCryptoService.decryptMessage(
        msg60.content,
        msg60.iv,
        msg60.tag,
        aesKey60,
      );
      expect(text60).toBe('hi');

      // 5. Decrypt live Message 61
      const msg61 = chat9Messages.find((m: any) => m.id === 61);
      expect(msg61).toBeDefined();

      const msg61Keys =
        typeof msg61.aes_key_encrypted === 'string'
          ? JSON.parse(msg61.aes_key_encrypted)
          : msg61.aes_key_encrypted;

      const aesKey61 = await WebCryptoService.unwrapAesKey(
        msg61Keys['14'],
        adminPrivateKey,
      );
      const text61 = await WebCryptoService.decryptMessage(
        msg61.content,
        msg61.iv,
        msg61.tag,
        aesKey61,
      );
      expect(text61).toBe('ho');
    });
  });

  describe('6. Security & Authorization Enforcement', () => {
    it('rejects access to chat messages for non-members with 403 Forbidden', async () => {
      // User A attempts to access legacy chat 9 (belonging to admin & admin1)
      const res = await fetch(`${REST_URL}/chats/9/messages`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      expect(res.status).toBe(403);
      const err = await res.json();
      expect(err.msg).toContain('not a member');
    });

    it('rejects request with invalid or expired token with 401 Unauthorized', async () => {
      const res = await fetch(`${REST_URL}/users/me`, {
        headers: { Authorization: 'Bearer invalid-token-xyz' },
      });
      expect(res.status).toBe(401);
    });

    it('disconnects Socket.IO handshake when token is invalid', (done) => {
      const badSocket = io(SOCKET_URL, {
        auth: { token: 'invalid-jwt-token' },
        transports: ['websocket'],
      });

      badSocket.on('connect_error', () => {
        badSocket.disconnect();
        done();
      });

      badSocket.on('disconnect', () => {
        done();
      });
    });

    it('rejects Socket.IO join_chat from non-member account with error event', (done) => {
      const errorHandler = (err: any) => {
        expect(err.msg).toBe('Not a member of this chat');
        socketA.off('error', errorHandler);
        done();
      };
      socketA.on('error', errorHandler);
      socketA.emit('join_chat', { chat_id: 9 });
    });

    it('rejects Socket.IO send_message to a chat where sender is not a member', (done) => {
      const errorHandler = (err: any) => {
        expect(err.msg).toBe('Not in chat');
        socketA.off('error', errorHandler);
        done();
      };
      socketA.on('error', errorHandler);
      socketA.emit('send_message', {
        chat_id: 9, // legacy chat 9 (admin & admin1)
        sender_id: userAId,
        content: 'dGVzdA==',
        aes_key_encrypted: { '14': 'dGVzdA==' },
        iv: 'dGVzdGl2MTZieXRlcw==',
        tag: 'dGVzdHRhZzE2Ynl0ZXM=',
      });
    });

    it('enforces server-side sender identity and overrides client-supplied spoofed sender_id', async () => {
      const messagePromise = new Promise<any>((resolve) => {
        socketB.once('receive_message', (payload) => {
          resolve(payload);
        });
      });

      // User A attempts to spoof sender_id as 88888
      socketA.emit('send_message', {
        chat_id: createdChatId,
        sender_id: 88888, // Spoofed ID
        content: 'dGVzdA==',
        aes_key_encrypted: {
          [userAId]: 'dGVzdEtleUE=',
          [userBId]: 'dGVzdEtleUI=',
        },
        iv: 'dGVzdGl2MTZieXRlcw==',
        tag: 'dGVzdHRhZzE2Ynl0ZXM=',
      });

      const received = await messagePromise;
      // Server must override spoofed sender_id with real verified userAId
      expect(received.sender_id).toBe(userAId);
      expect(received.sender_id).not.toBe(88888);
    });

    it('rejects malformed send_message payload with missing required fields', (done) => {
      const errorHandler = (err: any) => {
        expect(err.msg).toBe('Invalid data');
        socketA.off('error', errorHandler);
        done();
      };
      socketA.on('error', errorHandler);
      socketA.emit('send_message', {
        chat_id: createdChatId,
        // missing content, iv, tag
      });
    });

    it('returns 404 Not Found for non-existent chat messages via REST', async () => {
      const res = await fetch(`${REST_URL}/chats/999999/messages`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      expect(res.status).toBe(404);
      const err = await res.json();
      expect(err.msg).toContain('Chat not found');
    });
  });
});
