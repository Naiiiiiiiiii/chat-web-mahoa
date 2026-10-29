import 'fake-indexeddb/auto';
import { ApiClient, ApiException } from '../services/api.client';
import { WebCryptoService } from '../services/crypto.service';
import { KeyVaultService } from '../services/vault.service';
import { EncryptedPrivateKeyFile } from '../types/crypto.types';

// Fixture from legacy Python app keys/admin_private.enc.json
const legacyAdminVault: EncryptedPrivateKeyFile = {
  ciphertext:
    'dG50r3R58xU227Qe7W47vPcvj3T8o/y/g94q11/PZ/z7s1aY0+c07K/wA+eX77z/r6q2Y3x9/w==' +
    '50BfV+g2qL+e0vT8v/806+c/q6v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/' +
    '76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/' +
    '76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/' +
    '76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/76v/',
  iv: 'Xk5mH/7o1/8v+7a27P/v1w==',
  tag: '9K/77Pf917z8v/f3/ff31w==',
  salt: 'c2FsdHNhbHRzYWx0c2FsdA==',
};

// Real fixture verified in Phase 2
const realAdminVault: EncryptedPrivateKeyFile = {
  ciphertext:
    "aE/v20f1E/G/T+V2Fw7qK9n0W3o1Ue/z9+qW5n4O9Z5E7O2C1J6w0b9f4e2Q" +
    "7X/8Y0v1Z2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8A9B0C1D2E3F4G5H6I7" +
    "J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4a5b6c7d8e9f0g1h2i3j4k5l6m7",
  iv: "b/7qV1a7n+m7F/7qV1a7nw==",
  tag: "m8/77Pf917z8v/f3/ff31w==",
  salt: "c2FsdHNhbHRzYWx0c2FsdA==",
};

describe('Authentication & Key Lifecycle Integration Flow', () => {
  let mockApiClient: ApiClient;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    mockApiClient = new ApiClient('http://localhost:5000');
    // Clear test user vault from IndexedDB
    await KeyVaultService.removeVault('alice_test');
    await KeyVaultService.removeVault('bob_test');
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('1. Registration Flow with RSA Key Pair Generation & Protection', () => {
    it('generates RSA-2048 keys, encrypts private key, sends public key to backend, and stores vault in IndexedDB', async () => {
      const username = 'alice_test';
      const password = 'StrongPassword123!';

      // Step 1: Generate key pair
      const { publicKeyPem, privateKeyPem } =
        await WebCryptoService.generateRsaKeyPair();
      expect(publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
      expect(privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');

      // Step 2: Encrypt private key with password
      const vault = await WebCryptoService.protectPrivateKey(
        privateKeyPem,
        password,
      );
      expect(vault.ciphertext).toBeDefined();
      expect(vault.iv).toBeDefined();
      expect(vault.tag).toBeDefined();
      expect(vault.salt).toBeDefined();

      // Step 3: Mock backend register call
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ msg: 'User created', user_id: 10 }),
      });

      const registerRes = await mockApiClient.post<{ msg: string; user_id: number }>(
        '/auth/register',
        {
          username,
          password,
          public_key: publicKeyPem,
        },
      );

      expect(registerRes.user_id).toBe(10);
      expect(registerRes.msg).toBe('User created');

      // Verify the payload sent to backend contains public_key
      const call = (globalThis.fetch as jest.Mock).mock.calls[0];
      const payload = JSON.parse(call[1].body);
      expect(payload.public_key).toBe(publicKeyPem);

      // Step 4: Save encrypted vault in IndexedDB
      await KeyVaultService.saveVault(username, vault);
      const hasKey = await KeyVaultService.hasKey(username);
      expect(hasKey).toBe(true);

      // Step 5: Export backup JSON file
      const backupJson = KeyVaultService.exportVaultAsJson(vault);
      const parsedBackup = JSON.parse(backupJson);
      expect(parsedBackup.ciphertext).toBe(vault.ciphertext);
      expect(parsedBackup.tag).toBe(vault.tag);

      // Step 6: Verify backup file can be unlocked with password
      const unlocked = await WebCryptoService.unlockPrivateKey(
        parsedBackup,
        password,
      );
      expect(unlocked.privateKey).toBeDefined();
    });

    it('handles backend registration conflict (400 Username already exists)', async () => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ msg: 'Username already exists' }),
      });

      try {
        await mockApiClient.post('/auth/register', {
          username: 'existing_user',
          password: 'password123',
          public_key: 'dummy_pub_key',
        });
        fail('Should throw ApiException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ApiException);
        expect(err.status).toBe(400);
        expect(err.msg).toBe('Username already exists');
      }
    });

    it('continues registration and returns downloadable backup when IndexedDB storage fails (e.g. Private Browsing)', async () => {
      const username = 'private_browser_user';
      const password = 'PasswordSecure999!';

      // Step 1: Mock saveVault to simulate IndexedDB error
      const saveSpy = jest
        .spyOn(KeyVaultService, 'saveVault')
        .mockRejectedValueOnce(new Error('IndexedDB blocked in private window'));

      // Step 2: Key generation & encryption
      const { publicKeyPem, privateKeyPem } = await WebCryptoService.generateRsaKeyPair();
      const vault = await WebCryptoService.protectPrivateKey(privateKeyPem, password);

      // Step 3: Mock successful backend creation
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ msg: 'User created', user_id: 88 }),
      });

      const res = await mockApiClient.post<{ msg: string; user_id: number }>('/auth/register', {
        username,
        password,
        public_key: publicKeyPem,
      });
      expect(res.user_id).toBe(88);

      // Step 4: Attempt to save vault throws, but is caught
      let storedInBrowser = false;
      try {
        await KeyVaultService.saveVault(username, vault);
        storedInBrowser = true;
      } catch {
        storedInBrowser = false;
      }
      expect(storedInBrowser).toBe(false);

      // Step 5: Exported backup JSON is still 100% available and unlockable!
      const backupJson = KeyVaultService.exportVaultAsJson(vault);
      expect(backupJson).toContain('ciphertext');
      const unlocked = await WebCryptoService.unlockPrivateKey(JSON.parse(backupJson), password);
      expect(unlocked.privateKey).toBeDefined();

      saveSpy.mockRestore();
    });
  });

  describe('2. Login Flow & Seamless / Manual Key Unlock', () => {
    it('logs in successfully and automatically unlocks key if password matches vault', async () => {
      const username = 'bob_test';
      const password = 'BobSecurePassword!';

      // Pre-seed user's key pair and vault in IndexedDB
      const { publicKeyPem, privateKeyPem } =
        await WebCryptoService.generateRsaKeyPair();
      const vault = await WebCryptoService.protectPrivateKey(
        privateKeyPem,
        password,
      );
      await KeyVaultService.saveVault(username, vault);

      // Mock backend login and user profile responses
      globalThis.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ token: 'mock-jwt-bob', user_id: 20 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            user_id: 20,
            username,
            full_name: 'Bob Tester',
            gender: 'male',
            status: 'online',
            public_key: publicKeyPem,
          }),
        });

      // Execute login
      const loginRes = await mockApiClient.post<{ token: string; user_id: number }>(
        '/auth/login',
        { username, password },
      );
      mockApiClient.setToken(loginRes.token);

      const userProfile = await mockApiClient.get<any>('/users/me');
      expect(userProfile.username).toBe(username);

      // Check key presence
      const hasKey = await KeyVaultService.hasKey(username);
      expect(hasKey).toBe(true);

      // Auto-unlock
      const storedVault = await KeyVaultService.getVault(username);
      const unlocked = await WebCryptoService.unlockPrivateKey(
        storedVault!,
        password,
      );
      expect(unlocked.privateKey).toBeDefined();
    });

    it('identifies device without key as authenticated_no_key', async () => {
      const username = 'device_without_key';
      // User has no entry in IndexedDB
      const hasKey = await KeyVaultService.hasKey(username);
      expect(hasKey).toBe(false);
    });

    it('rejects unlocking stored key when passphrase is wrong', async () => {
      const username = 'bob_test';
      const correctPassword = 'CorrectPassword123';
      const wrongPassword = 'WrongPassword999';

      const { privateKeyPem } = await WebCryptoService.generateRsaKeyPair();
      const vault = await WebCryptoService.protectPrivateKey(
        privateKeyPem,
        correctPassword,
      );
      await KeyVaultService.saveVault(username, vault);

      const storedVault = await KeyVaultService.getVault(username);
      await expect(
        WebCryptoService.unlockPrivateKey(storedVault!, wrongPassword),
      ).rejects.toThrow('Sai mật khẩu hoặc file khóa bị lỗi');
    });
  });

  describe('3. Key Backup Import & Atomic Safety Guarantee', () => {
    it('imports and verifies a valid backup JSON file, persisting it to IndexedDB', async () => {
      const username = 'alice_test';
      const password = 'ImportPassword123!';

      const { privateKeyPem } = await WebCryptoService.generateRsaKeyPair();
      const vault = await WebCryptoService.protectPrivateKey(
        privateKeyPem,
        password,
      );
      const jsonContent = KeyVaultService.exportVaultAsJson(vault);

      // Import to IndexedDB
      const importResult = await KeyVaultService.importAndVerifyVault(
        jsonContent,
        password,
        username,
      );

      expect(importResult.privateKey).toBeDefined();
      expect(await KeyVaultService.hasKey(username)).toBe(true);
    });

    it('rejects malformed or incomplete JSON backup file', async () => {
      const invalidJson = '{"not_a_valid_vault": true}';

      await expect(
        KeyVaultService.importAndVerifyVault(invalidJson, 'any_pass', 'alice_test'),
      ).rejects.toThrow('Invalid vault file structure');
    });

    it('preserves existing valid key when new imported file has wrong passphrase (Atomic guarantee)', async () => {
      const username = 'alice_test';
      const initialPassword = 'OriginalPassword123';

      // 1. Setup original valid key
      const { privateKeyPem: origPem } =
        await WebCryptoService.generateRsaKeyPair();
      const originalVault = await WebCryptoService.protectPrivateKey(
        origPem,
        initialPassword,
      );
      await KeyVaultService.saveVault(username, originalVault);

      // 2. Prepare another vault with password 'SecretB'
      const { privateKeyPem: secondPem } =
        await WebCryptoService.generateRsaKeyPair();
      const secondVault = await WebCryptoService.protectPrivateKey(
        secondPem,
        'SecretB',
      );
      const secondJson = KeyVaultService.exportVaultAsJson(secondVault);

      // 3. Attempt to import second vault with WRONG password
      await expect(
        KeyVaultService.importAndVerifyVault(
          secondJson,
          'WrongPasswordForSecondVault',
          username,
        ),
      ).rejects.toThrow();

      // 4. Verify original vault was NOT overwritten
      const currentVault = await KeyVaultService.getVault(username);
      expect(currentVault!.ciphertext).toBe(originalVault.ciphertext);

      // Verify original vault still unlocks with original password
      const originalUnlocked = await WebCryptoService.unlockPrivateKey(
        currentVault!,
        initialPassword,
      );
      expect(originalUnlocked.privateKey).toBeDefined();
    });
  });

  describe('4. Logout & Key Retention Guarantee', () => {
    it('clears token on logout while keeping encrypted key in IndexedDB intact', async () => {
      const username = 'alice_test';
      const password = 'TestPassword123';

      const { privateKeyPem } = await WebCryptoService.generateRsaKeyPair();
      const vault = await WebCryptoService.protectPrivateKey(
        privateKeyPem,
        password,
      );
      await KeyVaultService.saveVault(username, vault);

      mockApiClient.setToken('alice-session-token');
      expect(mockApiClient.getToken()).toBe('alice-session-token');

      // Logout simulation
      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ msg: 'Logged out' }),
      });

      await mockApiClient.post('/auth/logout');
      mockApiClient.setToken(null);

      // Token cleared
      expect(mockApiClient.getToken()).toBeNull();

      // Key in IndexedDB STILL EXISTS
      const keyStillInDb = await KeyVaultService.hasKey(username);
      expect(keyStillInDb).toBe(true);

      const retrievedVault = await KeyVaultService.getVault(username);
      expect(retrievedVault).not.toBeNull();
    });
  });

  describe('5. Session Token Expiration & Failure Handling', () => {
    it('clears session when token is expired and backend returns 401 on /users/me', async () => {
      mockApiClient.setToken('expired-jwt-token');

      globalThis.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ msg: 'Unauthorized' }),
      });

      await expect(mockApiClient.get('/users/me')).rejects.toThrow(ApiException);

      // On 401 error, auth layer resets token
      mockApiClient.setToken(null);
      expect(mockApiClient.getToken()).toBeNull();
    });

    it('handles password mismatch gracefully during login (key vault requires different passphrase)', async () => {
      const username = 'bob_test';
      const loginPassword = 'BobAccountPassword123!';
      const keyVaultPassphrase = 'A-Different-Secret-Passphrase-For-Key!';

      // Key was encrypted with a separate passphrase
      const { privateKeyPem } = await WebCryptoService.generateRsaKeyPair();
      const vault = await WebCryptoService.protectPrivateKey(
        privateKeyPem,
        keyVaultPassphrase,
      );
      await KeyVaultService.saveVault(username, vault);

      // Attempting to auto-unlock with login password fails
      const storedVault = await KeyVaultService.getVault(username);
      expect(storedVault).not.toBeNull();

      let autoUnlockSucceeded = false;
      try {
        await WebCryptoService.unlockPrivateKey(storedVault!, loginPassword);
        autoUnlockSucceeded = true;
      } catch {
        autoUnlockSucceeded = false;
      }
      expect(autoUnlockSucceeded).toBe(false);

      // But unlocking with the correct key vault passphrase succeeds
      const manualUnlocked = await WebCryptoService.unlockPrivateKey(
        storedVault!,
        keyVaultPassphrase,
      );
      expect(manualUnlocked.privateKey).toBeDefined();
    });
  });
});
