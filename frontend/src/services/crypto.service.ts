import { Asn1Util } from '../utils/asn1.util';
import {
  EncryptedPrivateKeyFile,
  EncryptedMessagePayload,
} from '../types/crypto.types';

export class WebCryptoService {
  private static readonly RSA_ALGORITHM = {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), // 65537
    hash: 'SHA-256',
  };

  private static readonly PBKDF2_ITERATIONS = 100000;
  private static readonly AES_KEY_LENGTH = 256; // bits = 32 bytes
  private static readonly IV_LENGTH = 16;       // bytes
  private static readonly TAG_LENGTH = 128;     // bits = 16 bytes
  private static readonly SALT_LENGTH = 16;     // bytes

  private static getSubtle(): SubtleCrypto {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return window.crypto.subtle;
    }
    // Node.js test environment support
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.subtle) {
      return (globalThis as any).crypto.subtle;
    }
    try {
      const nodeCrypto = require('crypto');
      return nodeCrypto.webcrypto.subtle;
    } catch {
      throw new Error('Web Crypto API (crypto.subtle) is not available in this environment');
    }
  }

  private static getRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    if (typeof window !== 'undefined' && window.crypto) {
      return window.crypto.getRandomValues(bytes);
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto) {
      return (globalThis as any).crypto.getRandomValues(bytes);
    }
    const nodeCrypto = require('crypto');
    return nodeCrypto.webcrypto.getRandomValues(bytes);
  }

  /**
   * Generates a new 2048-bit RSA-OAEP key pair
   * Returns Public Key as SPKI PEM and Private Key as PKCS#8 PEM
   */
  static async generateRsaKeyPair(): Promise<{
    publicKeyPem: string;
    privateKeyPem: string;
    publicKey: CryptoKey;
    privateKey: CryptoKey;
  }> {
    const subtle = this.getSubtle();
    const keyPair = await subtle.generateKey(
      this.RSA_ALGORITHM,
      true,
      ['encrypt', 'decrypt'],
    );

    const spkiDer = await subtle.exportKey('spki', keyPair.publicKey);
    const pkcs8Der = await subtle.exportKey('pkcs8', keyPair.privateKey);

    const publicKeyPem = Asn1Util.derToPem(
      new Uint8Array(spkiDer),
      'PUBLIC KEY',
    );
    const privateKeyPem = Asn1Util.derToPem(
      new Uint8Array(pkcs8Der),
      'PRIVATE KEY',
    );

    return {
      publicKeyPem,
      privateKeyPem,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    };
  }

  /**
   * Imports an RSA Public Key in SPKI PEM format
   */
  static async importPublicKeyPem(pem: string): Promise<CryptoKey> {
    if (!pem || !pem.includes('PUBLIC KEY')) {
      throw new Error('Invalid Public Key PEM: Missing PUBLIC KEY header/footer');
    }
    const der = Asn1Util.pemToDer(pem);
    const subtle = this.getSubtle();

    return await subtle.importKey(
      'spki',
      der as BufferSource,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['encrypt'],
    );
  }

  /**
   * Imports an RSA Private Key. Supports both:
   * 1. PKCS#1 PEM ("BEGIN RSA PRIVATE KEY" - legacy Python format, converted via ASN.1)
   * 2. PKCS#8 PEM ("BEGIN PRIVATE KEY" - standard WebCrypto format)
   */
  static async importPrivateKeyPem(pem: string): Promise<CryptoKey> {
    if (!pem || !pem.includes('PRIVATE KEY')) {
      throw new Error('Invalid Private Key PEM: Missing PRIVATE KEY header/footer');
    }

    const subtle = this.getSubtle();
    let pkcs8Der: Uint8Array;

    if (pem.includes('BEGIN RSA PRIVATE KEY')) {
      // Legacy PKCS#1 -> parse and convert to PKCS#8
      const pkcs1Der = Asn1Util.pemToDer(pem);
      pkcs8Der = Asn1Util.convertPkcs1ToPkcs8(pkcs1Der);
    } else if (pem.includes('BEGIN PRIVATE KEY')) {
      // Standard PKCS#8
      pkcs8Der = Asn1Util.pemToDer(pem);
    } else {
      throw new Error('Unsupported Private Key format: Expected PKCS#1 or PKCS#8 PEM');
    }

    return await subtle.importKey(
      'pkcs8',
      pkcs8Der as BufferSource,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true,
      ['decrypt'],
    );
  }

  /**
   * Wraps (encrypts) an AES raw key with an RSA Public Key using RSA-OAEP SHA-256
   * Returns standard Base64 string
   */
  static async wrapAesKey(
    aesKeyRaw: Uint8Array,
    publicKey: CryptoKey,
  ): Promise<string> {
    const subtle = this.getSubtle();
    const wrappedBuffer = await subtle.encrypt(
      { name: 'RSA-OAEP' },
      publicKey,
      aesKeyRaw as BufferSource,
    );
    return Asn1Util.uint8ArrayToBase64(new Uint8Array(wrappedBuffer));
  }

  /**
   * Unwraps (decrypts) a wrapped AES key with an RSA Private Key using RSA-OAEP SHA-256
   * Returns 32-byte raw AES key
   */
  static async unwrapAesKey(
    wrappedKeyB64: string,
    privateKey: CryptoKey,
  ): Promise<Uint8Array> {
    if (!wrappedKeyB64) {
      throw new Error('Invalid wrapped key: empty string');
    }
    const subtle = this.getSubtle();
    const wrappedBytes = Asn1Util.base64ToUint8Array(wrappedKeyB64);
    const rawAesBuffer = await subtle.decrypt(
      { name: 'RSA-OAEP' },
      privateKey,
      wrappedBytes as BufferSource,
    );
    return new Uint8Array(rawAesBuffer);
  }

  /**
   * Encrypts a message using AES-256-GCM and wraps the key for all recipients
   * Correctly separates the 16-byte authentication tag from WebCrypto's output buffer
   */
  static async encryptMessage(
    plaintext: string,
    recipientPublicKeys: Record<string, CryptoKey>,
  ): Promise<EncryptedMessagePayload> {
    if (Object.keys(recipientPublicKeys).length === 0) {
      throw new Error('Recipient public keys dictionary cannot be empty');
    }

    const subtle = this.getSubtle();
    // 1. Generate 32 bytes ephemeral AES key
    const aesKeyRaw = this.getRandomBytes(32);
    const aesKey = await subtle.importKey(
      'raw',
      aesKeyRaw as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['encrypt'],
    );

    // 2. Generate 16 bytes random IV
    const iv = this.getRandomBytes(this.IV_LENGTH);

    // 3. Encrypt plaintext with AES-GCM
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const encryptedBuffer = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
        tagLength: this.TAG_LENGTH,
      },
      aesKey,
      plaintextBytes as BufferSource,
    );

    // 4. In Web Crypto API, tag is appended at the end of ciphertext (last 16 bytes)
    const encryptedBytes = new Uint8Array(encryptedBuffer);
    const tagOffset = encryptedBytes.length - 16;
    const ciphertextBytes = encryptedBytes.slice(0, tagOffset);
    const tagBytes = encryptedBytes.slice(tagOffset);

    // 5. Wrap AES key for every recipient
    const aesKeyEncrypted: Record<string, string> = {};
    for (const [accountId, pubKey] of Object.entries(recipientPublicKeys)) {
      aesKeyEncrypted[accountId] = await this.wrapAesKey(aesKeyRaw, pubKey);
    }

    return {
      content: Asn1Util.uint8ArrayToBase64(ciphertextBytes),
      iv: Asn1Util.uint8ArrayToBase64(iv),
      tag: Asn1Util.uint8ArrayToBase64(tagBytes),
      aes_key_encrypted: aesKeyEncrypted,
    };
  }

  /**
   * Decrypts an AES-256-GCM encrypted message
   * Re-concatenates ciphertext and tag before calling Web Crypto API
   */
  static async decryptMessage(
    contentB64: string,
    ivB64: string,
    tagB64: string,
    aesKeyRaw: Uint8Array,
  ): Promise<string> {
    if (!contentB64 || !ivB64 || !tagB64) {
      throw new Error('Missing required message parameters (content, iv, or tag)');
    }

    const subtle = this.getSubtle();
    const ciphertextBytes = Asn1Util.base64ToUint8Array(contentB64);
    const ivBytes = Asn1Util.base64ToUint8Array(ivB64);
    const tagBytes = Asn1Util.base64ToUint8Array(tagB64);

    if (ivBytes.length !== this.IV_LENGTH) {
      throw new Error(`Invalid IV length: expected ${this.IV_LENGTH} bytes, got ${ivBytes.length}`);
    }
    if (tagBytes.length !== 16) {
      throw new Error(`Invalid tag length: expected 16 bytes, got ${tagBytes.length}`);
    }

    // Concatenate [ciphertext, tag] for Web Crypto API
    const gcmPayload = new Uint8Array(ciphertextBytes.length + tagBytes.length);
    gcmPayload.set(ciphertextBytes, 0);
    gcmPayload.set(tagBytes, ciphertextBytes.length);

    const aesKey = await subtle.importKey(
      'raw',
      aesKeyRaw as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );

    const decryptedBuffer = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes as BufferSource,
        tagLength: this.TAG_LENGTH,
      },
      aesKey,
      gcmPayload as BufferSource,
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  /**
   * Encrypts and protects an RSA Private Key PEM using PBKDF2 + AES-256-GCM
   * Exactly matches the Python app format: { ciphertext, iv, tag, salt }
   */
  static async protectPrivateKey(
    privateKeyPem: string,
    passphrase: string,
  ): Promise<EncryptedPrivateKeyFile> {
    if (!passphrase) {
      throw new Error('Passphrase cannot be empty');
    }

    const subtle = this.getSubtle();
    const salt = this.getRandomBytes(this.SALT_LENGTH);
    const iv = this.getRandomBytes(this.IV_LENGTH);

    // PBKDF2 key derivation
    const passphraseBytes = new TextEncoder().encode(passphrase);
    const baseKey = await subtle.importKey(
      'raw',
      passphraseBytes as BufferSource,
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );

    const aesDerivedKey = await subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: this.AES_KEY_LENGTH },
      false,
      ['encrypt'],
    );

    // AES-GCM encrypt
    const pemBytes = new TextEncoder().encode(privateKeyPem);
    const encryptedBuffer = await subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
        tagLength: this.TAG_LENGTH,
      },
      aesDerivedKey,
      pemBytes as BufferSource,
    );

    const encBytes = new Uint8Array(encryptedBuffer);
    const tagOffset = encBytes.length - 16;
    const ciphertextBytes = encBytes.slice(0, tagOffset);
    const tagBytes = encBytes.slice(tagOffset);

    return {
      ciphertext: Asn1Util.uint8ArrayToBase64(ciphertextBytes),
      iv: Asn1Util.uint8ArrayToBase64(iv),
      tag: Asn1Util.uint8ArrayToBase64(tagBytes),
      salt: Asn1Util.uint8ArrayToBase64(salt),
    };
  }

  /**
   * Unlocks an encrypted Private Key vault using passphrase
   * Compatible with legacy Python .enc.json files
   */
  static async unlockPrivateKey(
    vault: EncryptedPrivateKeyFile,
    passphrase: string,
  ): Promise<{ privateKey: CryptoKey; privateKeyPem: string }> {
    if (!vault || !vault.ciphertext || !vault.iv || !vault.tag || !vault.salt) {
      throw new Error('Invalid vault file structure: missing required fields');
    }

    const subtle = this.getSubtle();
    const salt = Asn1Util.base64ToUint8Array(vault.salt);
    const iv = Asn1Util.base64ToUint8Array(vault.iv);
    const tag = Asn1Util.base64ToUint8Array(vault.tag);
    const ciphertext = Asn1Util.base64ToUint8Array(vault.ciphertext);

    // Concatenate [ciphertext, tag]
    const gcmPayload = new Uint8Array(ciphertext.length + tag.length);
    gcmPayload.set(ciphertext, 0);
    gcmPayload.set(tag, ciphertext.length);

    // PBKDF2 derive key
    const passphraseBytes = new TextEncoder().encode(passphrase);
    const baseKey = await subtle.importKey(
      'raw',
      passphraseBytes as BufferSource,
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    );

    const aesDerivedKey = await subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      baseKey,
      { name: 'AES-GCM', length: this.AES_KEY_LENGTH },
      false,
      ['decrypt'],
    );

    let decryptedBuffer: ArrayBuffer;
    try {
      decryptedBuffer = await subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as BufferSource,
          tagLength: this.TAG_LENGTH,
        },
        aesDerivedKey,
        gcmPayload as BufferSource,
      );
    } catch {
      throw new Error('Sai mật khẩu hoặc file khóa bị lỗi');
    }

    const privateKeyPem = new TextDecoder().decode(decryptedBuffer);
    const privateKey = await this.importPrivateKeyPem(privateKeyPem);

    return { privateKey, privateKeyPem };
  }
}
