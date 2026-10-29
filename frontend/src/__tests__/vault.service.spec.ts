import 'fake-indexeddb/auto';
import { KeyVaultService } from '../services/vault.service';
import { WebCryptoService } from '../services/crypto.service';
import { EncryptedPrivateKeyFile } from '../types/crypto.types';

describe('KeyVaultService - IndexedDB Storage & Backup Management', () => {
  const sampleVault: EncryptedPrivateKeyFile = {
    ciphertext: 'c2FtcGxlX2NpcGhlcnRleHQ=',
    iv: 'c2FtcGxlX2l2XzE2Ynl0ZXM=',
    tag: 'c2FtcGxlX3RhZ18xNmJ5dGVz',
    salt: 'c2FtcGxlX3NhbHRfMTZieXRlcw==',
  };

  it('1. should validate vault structure correctly', () => {
    expect(() => KeyVaultService.validateVaultStructure(sampleVault)).not.toThrow();

    expect(() => KeyVaultService.validateVaultStructure(null)).toThrow(
      'Invalid vault file: expected a JSON object',
    );
    expect(() =>
      KeyVaultService.validateVaultStructure({ ciphertext: 'abc' }),
    ).toThrow('missing or invalid field "iv"');
  });

  it('2. should save and retrieve encrypted vault in IndexedDB without storing plaintext', async () => {
    await KeyVaultService.saveVault('testuser', sampleVault);

    const has = await KeyVaultService.hasKey('testuser');
    expect(has).toBe(true);

    const retrieved = await KeyVaultService.getVault('testuser');
    expect(retrieved).toEqual(sampleVault);

    await KeyVaultService.removeVault('testuser');
    const hasAfter = await KeyVaultService.hasKey('testuser');
    expect(hasAfter).toBe(false);
  });

  it('3. should export vault as formatted JSON string matching legacy format', () => {
    const jsonStr = KeyVaultService.exportVaultAsJson(sampleVault);
    const parsed = JSON.parse(jsonStr);

    expect(parsed).toEqual(sampleVault);
    expect(jsonStr).toContain('ciphertext');
    expect(jsonStr).toContain('iv');
    expect(jsonStr).toContain('tag');
    expect(jsonStr).toContain('salt');
  });

  it('4. should import and verify valid backup file with correct password', async () => {
    // Generate real key and protect it
    const keyPair = await WebCryptoService.generateRsaKeyPair();
    const passphrase = 'MyVaultPassword123!';
    const vault = await WebCryptoService.protectPrivateKey(
      keyPair.privateKeyPem,
      passphrase,
    );
    const backupJson = KeyVaultService.exportVaultAsJson(vault);

    const result = await KeyVaultService.importAndVerifyVault(
      backupJson,
      passphrase,
      'alice',
    );

    expect(result.vault).toEqual(vault);
    expect(result.privateKey).toBeDefined();

    // Verify it was saved in IndexedDB
    const saved = await KeyVaultService.getVault('alice');
    expect(saved).toEqual(vault);
  });

  it('5. should reject import on wrong passphrase and NOT modify existing vault', async () => {
    // Existing vault in storage
    const originalVault: EncryptedPrivateKeyFile = { ...sampleVault, ciphertext: 'ORIGINAL_DATA' };
    await KeyVaultService.saveVault('bob', originalVault);

    // Corrupt or wrong password payload
    const keyPair = await WebCryptoService.generateRsaKeyPair();
    const vault = await WebCryptoService.protectPrivateKey(
      keyPair.privateKeyPem,
      'correct_passphrase',
    );
    const backupJson = KeyVaultService.exportVaultAsJson(vault);

    // Attempt import with wrong passphrase
    await expect(
      KeyVaultService.importAndVerifyVault(backupJson, 'wrong_passphrase', 'bob'),
    ).rejects.toThrow('Sai mật khẩu hoặc file khóa bị lỗi');

    // Verify existing vault was NOT overwritten!
    const retained = await KeyVaultService.getVault('bob');
    expect(retained).toEqual(originalVault);
  });

  it('6. should reject malformed JSON file', async () => {
    await expect(
      KeyVaultService.importAndVerifyVault('not a json string', 'any', 'user'),
    ).rejects.toThrow('File sao lưu không phải là định dạng JSON hợp lệ');
  });

  it('7. should reject importing backup file belonging to another account (Public Key mismatch) and preserve existing key', async () => {
    const username = 'alice';
    const originalVault: EncryptedPrivateKeyFile = { ...sampleVault, ciphertext: 'ALICE_VALID_KEY' };
    await KeyVaultService.saveVault(username, originalVault);

    // Alice's legitimate public key
    const aliceKeys = await WebCryptoService.generateRsaKeyPair();

    // Bob creates a backup file
    const bobKeys = await WebCryptoService.generateRsaKeyPair();
    const bobPassphrase = 'BobSecretPassphrase!';
    const bobVault = await WebCryptoService.protectPrivateKey(
      bobKeys.privateKeyPem,
      bobPassphrase,
    );
    const bobBackupJson = KeyVaultService.exportVaultAsJson(bobVault);

    // Alice accidentally tries to import Bob's backup file with Bob's passphrase
    await expect(
      KeyVaultService.importAndVerifyVault(
        bobBackupJson,
        bobPassphrase,
        username,
        aliceKeys.publicKeyPem, // Alice's public key
      ),
    ).rejects.toThrow('File khóa sao lưu không thuộc về tài khoản này (Public Key không khớp)');

    // Verify Alice's original vault was NOT overwritten!
    const currentVault = await KeyVaultService.getVault(username);
    expect(currentVault!.ciphertext).toBe('ALICE_VALID_KEY');
  });

  it('8. should succeed importing backup file when expectedPublicKey matches unlocked private key', async () => {
    const keyPair = await WebCryptoService.generateRsaKeyPair();
    const passphrase = 'MatchingPassphrase123!';
    const vault = await WebCryptoService.protectPrivateKey(
      keyPair.privateKeyPem,
      passphrase,
    );
    const backupJson = KeyVaultService.exportVaultAsJson(vault);

    const result = await KeyVaultService.importAndVerifyVault(
      backupJson,
      passphrase,
      'valid_user',
      keyPair.publicKeyPem,
    );

    expect(result.privateKey).toBeDefined();
    const saved = await KeyVaultService.getVault('valid_user');
    expect(saved).toEqual(vault);
  });
});
