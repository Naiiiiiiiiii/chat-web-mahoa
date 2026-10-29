import { get, set, del } from 'idb-keyval';
import { EncryptedPrivateKeyFile } from '../types/crypto.types';
import { WebCryptoService } from './crypto.service';

export class KeyVaultService {
  private static readonly STORE_PREFIX = 'secure_chat_key_';

  /**
   * Helper to get namespaced key
   */
  private static getKeyName(username: string): string {
    return `${this.STORE_PREFIX}${username.trim().toLowerCase()}`;
  }

  /**
   * Saves an encrypted private key vault to IndexedDB
   * NEVER saves raw private keys or plaintext
   */
  static async saveVault(
    username: string,
    vault: EncryptedPrivateKeyFile,
  ): Promise<void> {
    if (!username) {
      throw new Error('Username is required to save key vault');
    }
    this.validateVaultStructure(vault);
    try {
      await set(this.getKeyName(username), vault);
    } catch (err: any) {
      throw new Error(
        `Không thể lưu file khóa vào bộ nhớ trình duyệt: ${err?.message || 'Lỗi IndexedDB'}`,
      );
    }
  }

  /**
   * Retrieves the encrypted private key vault from IndexedDB
   * Returns null if not found or if IndexedDB is inaccessible/restricted
   */
  static async getVault(
    username: string,
  ): Promise<EncryptedPrivateKeyFile | null> {
    if (!username) {
      return null;
    }
    try {
      const data = await get<EncryptedPrivateKeyFile>(this.getKeyName(username));
      return data || null;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a key vault exists for a username in IndexedDB
   */
  static async hasKey(username: string): Promise<boolean> {
    const vault = await this.getVault(username);
    return vault !== null;
  }

  /**
   * Removes a key vault from IndexedDB
   */
  static async removeVault(username: string): Promise<void> {
    if (!username) return;
    try {
      await del(this.getKeyName(username));
    } catch {
      // Ignore errors when removing from restricted storage
    }
  }

  /**
   * Validates the schema of an encrypted private key file
   */
  static validateVaultStructure(data: any): asserts data is EncryptedPrivateKeyFile {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid vault file: expected a JSON object');
    }
    const required = ['ciphertext', 'iv', 'tag', 'salt'] as const;
    for (const field of required) {
      if (typeof data[field] !== 'string' || data[field].trim() === '') {
        throw new Error(`Invalid vault file structure: missing or invalid field "${field}"`);
      }
    }
  }

  /**
   * Exports an encrypted vault as a JSON string
   * File content remains 100% encrypted and matches legacy Python format
   */
  static exportVaultAsJson(vault: EncryptedPrivateKeyFile): string {
    this.validateVaultStructure(vault);
    return JSON.stringify(
      {
        ciphertext: vault.ciphertext,
        iv: vault.iv,
        tag: vault.tag,
        salt: vault.salt,
      },
      null,
      2,
    );
  }

  /**
   * Validates, tests and imports a backup key file without overwriting if test fails.
   * Atomic guarantee: If the password is wrong, tag is invalid, or key import fails,
   * the existing key vault is kept intact and an error is thrown.
   * If expectedPublicKeyPem is provided, validates that the unlocked private key
   * matches the account's public key (preventing importing another user's backup key).
   */
  static async importAndVerifyVault(
    jsonContent: string,
    passphrase: string,
    targetUsername?: string,
    expectedPublicKeyPem?: string,
  ): Promise<{
    vault: EncryptedPrivateKeyFile;
    privateKey: CryptoKey;
    privateKeyPem: string;
  }> {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      throw new Error('File sao lưu không phải là định dạng JSON hợp lệ');
    }

    // 1. Validate structure
    this.validateVaultStructure(parsed);

    // 2. Test unlock with passphrase and verify Web Crypto import
    // If unlockPrivateKey throws, execution halts here, preserving existing vault!
    const { privateKey, privateKeyPem } = await WebCryptoService.unlockPrivateKey(
      parsed,
      passphrase,
    );

    // 3. Verify public key ownership if expectedPublicKeyPem is provided
    if (expectedPublicKeyPem) {
      const expectedPubKey = await WebCryptoService.importPublicKeyPem(expectedPublicKeyPem);
      // Generate ephemeral 32-byte test key
      const testKey = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto) {
        window.crypto.getRandomValues(testKey);
      } else {
        const nodeCrypto = require('crypto');
        nodeCrypto.webcrypto.getRandomValues(testKey);
      }

      try {
        const wrapped = await WebCryptoService.wrapAesKey(testKey, expectedPubKey);
        const unwrapped = await WebCryptoService.unwrapAesKey(wrapped, privateKey);
        let matches = unwrapped.length === testKey.length;
        if (matches) {
          for (let i = 0; i < testKey.length; i++) {
            if (unwrapped[i] !== testKey[i]) {
              matches = false;
              break;
            }
          }
        }
        if (!matches) {
          throw new Error('Public key mismatch');
        }
      } catch {
        throw new Error(
          'File khóa sao lưu không thuộc về tài khoản này (Public Key không khớp)',
        );
      }
    }

    // 4. If targetUsername is provided, persist the verified vault
    if (targetUsername) {
      await this.saveVault(targetUsername, parsed);
    }

    return {
      vault: parsed,
      privateKey,
      privateKeyPem,
    };
  }
}
