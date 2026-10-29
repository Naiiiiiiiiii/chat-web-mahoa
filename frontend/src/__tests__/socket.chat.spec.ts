import { SocketService } from '../services/socket.service';
import { ChatService } from '../services/chat.service';
import { WebCryptoService } from '../services/crypto.service';
import { Asn1Util } from '../utils/asn1.util';
import {
  ChatMessageRaw,
  ReceiveSocketMessagePayload,
  SendSocketMessagePayload,
} from '../types/chat.types';

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const listeners: Record<string, Function[]> = {};

  const mockSocket: any = {
    connected: false,
    on: jest.fn((event: string, cb: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      return mockSocket;
    }),
    emit: jest.fn((event: string, data: any) => {
      // Simulate loopback if needed
    }),
    disconnect: jest.fn(() => {
      mockSocket.connected = false;
      if (listeners['disconnect']) {
        listeners['disconnect'].forEach((cb) => cb('io client disconnect'));
      }
    }),
    removeAllListeners: jest.fn(() => {
      Object.keys(listeners).forEach((k) => delete listeners[k]);
    }),
    _trigger: (event: string, ...args: any[]) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(...args));
      }
    },
  };

  return {
    io: jest.fn((url: string, opts: any) => {
      mockSocket.connected = true;
      setTimeout(() => {
        if (listeners['connect']) {
          listeners['connect'].forEach((cb) => cb());
        }
      }, 0);
      return mockSocket;
    }),
    __mockSocket: mockSocket,
  };
});

describe('Phase 4: Realtime Socket.IO & E2EE Chat Flow', () => {
  let socketService: SocketService;
  let chatService: ChatService;
  let mockSocket: any;

  beforeEach(() => {
    const ioModule = require('socket.io-client');
    mockSocket = ioModule.__mockSocket;
    mockSocket.connected = false;
    mockSocket.emit.mockClear();
    mockSocket.on.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.removeAllListeners.mockClear();

    socketService = new SocketService('http://localhost:5001');
    chatService = new ChatService();
    chatService.clearCache();
  });

  afterEach(() => {
    socketService.disconnect();
    jest.restoreAllMocks();
  });

  describe('1. Socket.IO Connection & Event Lifecycle', () => {
    it('connects to Socket.IO with token in auth object and receives connect event', (done) => {
      const token = 'jwt-valid-token-phase4';

      socketService.onConnectionState((connected, err) => {
        if (connected) {
          expect(connected).toBe(true);
          expect(err).toBeNull();
          done();
        }
      });

      socketService.connect(token);
    });

    it('handles connect_error and notifies connection state listeners', (done) => {
      socketService.connect('invalid-token');

      socketService.onConnectionState((connected, err) => {
        if (!connected && err === 'Unauthorized handshake') {
          expect(connected).toBe(false);
          expect(err).toBe('Unauthorized handshake');
          done();
        }
      });

      mockSocket._trigger('connect_error', new Error('Unauthorized handshake'));
    });

    it('handles online_users broadcast from server', (done) => {
      socketService.connect('dummy-token');

      socketService.onOnlineUsers((users) => {
        expect(users).toEqual([14, 15, 20]);
        done();
      });

      mockSocket._trigger('online_users', [14, 15, 20]);
    });

    it('emits join_chat with correct chat_id and user_id', () => {
      socketService.connect('dummy-token');
      socketService.joinChat(9, 14);

      expect(mockSocket.emit).toHaveBeenCalledWith('join_chat', {
        chat_id: 9,
        user_id: 14,
      });
    });

    it('throws error when attempting to send message while socket is disconnected', () => {
      mockSocket.connected = false;
      expect(() =>
        socketService.sendMessage({
          chat_id: 9,
          sender_id: 14,
          content: 'abc',
          aes_key_encrypted: { '14': 'key' },
          iv: 'iv',
          tag: 'tag',
        }),
      ).toThrow('Chưa kết nối đến máy chủ');
    });
  });

  describe('2. E2EE Message Send & Receive via Socket.IO', () => {
    it('encrypts for all members, sends via Socket.IO, receives and decrypts message', async () => {
      // Setup sender (Alice, ID 14) and recipient (Bob, ID 15)
      const aliceKeyPair = await WebCryptoService.generateRsaKeyPair();
      const bobKeyPair = await WebCryptoService.generateRsaKeyPair();

      // Alice sends message to chat room 9
      const plaintext = 'Bí mật bảo mật đầu-cuối 🔒 2026';

      const recipientPublicKeys = {
        '14': aliceKeyPair.publicKey,
        '15': bobKeyPair.publicKey,
      };

      // 1. Client-side E2EE encryption
      const encryptedPayload = await WebCryptoService.encryptMessage(
        plaintext,
        recipientPublicKeys,
      );

      expect(encryptedPayload.content).toBeDefined();
      expect(encryptedPayload.aes_key_encrypted['14']).toBeDefined();
      expect(encryptedPayload.aes_key_encrypted['15']).toBeDefined();

      // 2. Send via socket
      socketService.connect('alice-token');
      const sendPayload: SendSocketMessagePayload = {
        chat_id: 9,
        sender_id: 14,
        content: encryptedPayload.content,
        aes_key_encrypted: encryptedPayload.aes_key_encrypted,
        iv: encryptedPayload.iv,
        tag: encryptedPayload.tag,
      };
      socketService.sendMessage(sendPayload);

      expect(mockSocket.emit).toHaveBeenCalledWith('send_message', sendPayload);

      // 3. Receive message simulation (as Bob, ID 15)
      const receivedMsg: ReceiveSocketMessagePayload = {
        id: 101,
        chat_id: 9,
        sender_id: 14,
        content: encryptedPayload.content,
        aes_key_encrypted: encryptedPayload.aes_key_encrypted,
        iv: encryptedPayload.iv,
        tag: encryptedPayload.tag,
        timestamp: new Date().toISOString(),
      };

      // Bob decrypts the message
      const bobDecrypted = await chatService.decryptMessage(
        receivedMsg,
        15, // Bob's userId
        bobKeyPair.privateKey,
      );

      expect(bobDecrypted.isDecrypted).toBe(true);
      expect(bobDecrypted.text).toBe(plaintext);
      expect(bobDecrypted.isOwn).toBe(false);

      // Alice also decrypts her own message
      const aliceDecrypted = await chatService.decryptMessage(
        receivedMsg,
        14, // Alice's userId
        aliceKeyPair.privateKey,
      );
      expect(aliceDecrypted.isDecrypted).toBe(true);
      expect(aliceDecrypted.text).toBe(plaintext);
      expect(aliceDecrypted.isOwn).toBe(true);
    });

    it('safely handles message when current user is not an intended recipient (no wrapped key)', async () => {
      const aliceKeyPair = await WebCryptoService.generateRsaKeyPair();

      // Message encrypted only for Alice (14)
      const encryptedPayload = await WebCryptoService.encryptMessage('Chỉ Alice đọc được', {
        '14': aliceKeyPair.publicKey,
      });

      const rawMsg: ChatMessageRaw = {
        id: 202,
        chat_id: 9,
        sender_id: 14,
        content: encryptedPayload.content,
        aes_key_encrypted: encryptedPayload.aes_key_encrypted, // Only has '14'
        iv: encryptedPayload.iv,
        tag: encryptedPayload.tag,
        timestamp: new Date().toISOString(),
      };

      // Charlie (ID 99) attempts to decrypt
      const charlieDecrypted = await chatService.decryptMessage(
        rawMsg,
        99,
        aliceKeyPair.privateKey,
      );

      expect(charlieDecrypted.isDecrypted).toBe(false);
      expect(charlieDecrypted.text).toContain('Không có khóa giải mã cho tài khoản này');
    });

    it('safely handles message when private key is not unlocked in session', async () => {
      const rawMsg: ChatMessageRaw = {
        id: 203,
        chat_id: 9,
        sender_id: 14,
        content: 'ciphertext',
        aes_key_encrypted: { '14': 'wrapped' },
        iv: 'iv',
        tag: 'tag',
        timestamp: new Date().toISOString(),
      };

      // Decrypt with privateKey = null
      const result = await chatService.decryptMessage(rawMsg, 14, null);
      expect(result.isDecrypted).toBe(false);
      expect(result.text).toContain('Vui lòng mở khóa để xem');
    });

    it('safely handles corrupted ciphertext or invalid auth tag without crashing', async () => {
      const keyPair = await WebCryptoService.generateRsaKeyPair();
      const payload = await WebCryptoService.encryptMessage('Valid message', {
        '14': keyPair.publicKey,
      });

      // Tamper with tag
      const corruptedTag = Asn1Util.uint8ArrayToBase64(new Uint8Array(16)); // all zero bytes

      const corruptedMsg: ChatMessageRaw = {
        id: 204,
        chat_id: 9,
        sender_id: 14,
        content: payload.content,
        aes_key_encrypted: payload.aes_key_encrypted,
        iv: payload.iv,
        tag: corruptedTag,
        timestamp: new Date().toISOString(),
      };

      const result = await chatService.decryptMessage(
        corruptedMsg,
        14,
        keyPair.privateKey,
      );

      expect(result.isDecrypted).toBe(false);
      expect(result.text).toContain('Giải mã thất bại');
      // Never exposes ciphertext in text field on failure
      expect(result.text).not.toContain(payload.content);
    });
  });

  describe('3. Historical Messages REST API & Legacy Decryption', () => {
    it('decrypts historical message list where aes_key_encrypted is a JSON string', async () => {
      // Historical fixture from legacy database secure_chat.sql message 60
      const legacyEncryptedKeyFile = {
        ciphertext:
          'kTGsltg2n5tjKkoZpP0nqAiBsKD85X67B83q6pHJ3EJCL7fND3BfvfzfCguNvAO6mmUHSVLn1yDnv9jFGAnJA9W2KgmE1/anVbJBnPDW/99VcyXFUZCSn+CyglhUrFty5RoEnv1aoz1nv4BOtFPHv736rbN6Rdm/GnoPFIVO2JX4YRXRoKy42y5XsWxvMNf6bwUY/e+i/qCDqtbdtmzrMBpsUTWqGYMl1HBvXvBA7NKNWVEmB1EBOXxnVlKQqY39LTGaTI7bRUwosKb+1vCXaaWT29VS+636S5O5HyNOo94u6QmM/irO7f7cEPtZoIdnlk/40dSK/Uc+hCE2n5YjYmPV9ySTbVi0Qqvzulshn5ISKsp61W7G18a04NBarD0pDIUiV/AsBk0Vj9yJpD7FatirXvQ2B24XOqSG6Al2b3OPnTjQpO0qXJA1kfoSVtSwZXifdqTNIZqD1EaENJz8xi3ARbSB8mixFPOLJk8GxOedXzTBky8lCEv5k8BA7FtOS/8Lr5ULEmmULlmXz1YDePvVCE2Laj36A4UG+YGs3BK554D/1JBIJis+q+ZcnvIL7j2BEYM6PzCL7pGYtN7ma5hcsUXSwwMs5KB28xDyIXPgCJx0u2eykTm5nZ6IHdXy318SFXpiFohwUvqv4JSmr1bECjONpTI371Me0YIpjICHgkWMzaJkM0fUfuIlyj1OOJoN1tRJSAmgO8IiHiYVhzZC7wUzsoby2IFc7SCscuoUHgxuJB773SW7Kq9qC2qgXsVKaL5kDSSyHxkLQKFa72a1sG8nbCQc6cDAaPeytx3MO/A3bOxfHcvi76SCkKMXINbSm1c1hSTc5kSZFVx3i1uHOZmQWcb28pWYhW6v1auSOUD2+NeeYxQ8+XPggcuU26jI+zlN5VQg2kXvOan/GPKIqD8NmS+CsBX4FOhNBs63QdRXTqkhhKxslqqWC32yhhQJj0H4JtszYotM2eMgY7tyyaObJAeV9r6K+ddvNpl97kis8rX/yBf9nnbU9rtIcpy8J3y/qZWejgb1PMzSklaDiFG5zx0Hc+jPPBm66wIDurVRUe34TQCVQDkEC1g3Id+wTVobotlDbcDXVcq3apBCTXZ0fIwHnsr56BvB5fsSnfFZO6r34WhE7jmO80cZCcmYMd8E1E3nIde3c90V0XslADnHo/EdVxSSCSPKoHxWpia8Bsf5CPU1yS6zcwR6Ldfc2vPjq9vtbQ7SEI6YeSRBNS/YRm3Cm85fvHM3QtDFoJS57pUHd9J9JODXwb/npowDYumdJ6FUt7vZ1Sb4lidoKZk9aeNaCeEzW0n6x8mABLpEFdLvd5I2oGgYJubAK+YWCwamHcTt7CCjz1cwJOKtRMUL7+8A/UatD7i2C7pOiJkze8//0tw0Snqvj1gVFCeBQHrhhruiq9gqIhDq1U/yB+2C9d+VRBPeWo9jS7nBI39MXvPzd7QGsVUHYhpFO7+s2ah1a527B00XtVaMTCXoEIXQFWnOzjkh/r1d3Qe5m1z1iD0tbsQJjIaiGRJ5VjVq18mNpZk3kSF7uhnP7KZOSLE3Biu3XQwFKbF0FzEf71mGBzzn358uY5A5MZUL7TPXabwug1uox9Yz5qKlM81/4Ze/WJmSUUws+clrrvOZnzf8t4JjQGW0EBSrT3qmqdbpED4XrgF4vHv7aKQ4kawtvSnRI9hO9N8CHZUuloS4i58BWmjKfgkyCfAGxJe9UbVa4PKRbdjlzoMPbzztytohJ+62/cMNFSsUzg399C8a2U71TT3l1eKG3iWmHYdsexZqZWdeFNCNh66S2/SKkOXb3oGi0pFmKlrQt6q7MGkOFkBPoNJ0wM4Nw9shennP3Fq81mIE0ziIfCN0Ju2731eItPVdT3WGAXmQ5DLuf1UExgLO0uvv8m1MmAIOF7+uHc90/B46do2FwWoAE9Wi1lC1SJn+AAQmoNeO5/oKNSJc9MgpwHqBuuaecf6KPlPFBMU6bjDNLgSMnuOPH9aqN7OGdO5vuRMCb5yAMQnC+ew9wSt/uLzY6aXh7EEPrXtwRG9lrVNbcI99Z53i6eGqu51yMfLxuF5SIw3pma6MWzS7V3sjW0RCPXmg2OW+7xUrExfPAHu66nqRbvsh5a8X89b7GbwaYtSjMN9rrXqGOpQ4U3lv6sKwk6akpLl7o7mzxNkn/xOo3zeFy5qL2424HKXLyqVFSYjHOkKMAzUWp92YQfE65IfY2El2',
        iv: '8Kg7tsN8BYzyrxDpvcx0Ng==',
        tag: '+T2ut6s6cV+WTfw+C23emQ==',
        salt: 'stGyx3kQK2vCdRcPL/lHXw==',
      };

      const { privateKey } = await WebCryptoService.unlockPrivateKey(
        legacyEncryptedKeyFile,
        '123456',
      );

      // Raw message 60 from MySQL where aes_key_encrypted is stored as JSON string
      const rawMsg60: ChatMessageRaw = {
        id: 60,
        chat_id: 9,
        sender_id: 15,
        content: 'MvU=',
        aes_key_encrypted:
          '{"15": "aKCnhVA...", "14": "No4JZOdy+t8n0TBra+SLhwO7x4ABiVH9GRw8lYA2MgHRJ985y0tSCnVamgP1UcpbY9gpUvP/CPNv5ZaeplNPAKoPvsanyP8UE7su8y6gzwOv5IM10uOwHa8iZCqXNGAuFUpizazFy636LPOLckgtCnyJFWv7YX8Ga6W7QuYhe+EeiC1ydLFhw+06LRUJM6SwbCPmbfPikWYpPwWBNY6e/k30dc73VGOL4Tke6pfDk2jQYIlqa/532DlWE6hleCKrMiIjF9hddCmVuY583HxCphuxwvTJecwj+p3ZawxGQ/VobsFT5h+uC45oyb+FW6WIeLW4GTEJUw81xnVVyQhaJw=="}',
        iv: 'U7sPwduAf5nNWIq8EIVP2w==',
        tag: 'g8207BYufIz+yLEAXR4y2A==',
        timestamp: '2026-01-17T16:10:57.000Z',
      };

      const decrypted = await chatService.decryptMessage(
        rawMsg60,
        14, // admin user_id
        privateKey,
      );

      expect(decrypted.isDecrypted).toBe(true);
      expect(decrypted.text).toBe('hi');
    });
  });
});
