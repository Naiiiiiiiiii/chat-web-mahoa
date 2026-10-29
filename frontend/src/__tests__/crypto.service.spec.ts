import * as fs from 'fs';
import * as path from 'path';
import { WebCryptoService } from '../services/crypto.service';
import { Asn1Util } from '../utils/asn1.util';

describe('WebCryptoService - End-to-End Cryptography Engine', () => {
  // Test fixture from admin_private.enc.json
  const legacyEncryptedKeyFile = {
    ciphertext:
      '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',
    iv: '8Kg7tsN8BYzyrxDpvcx0Ng==',
    tag: '+T2ut6s6cV+WTfw+C23emQ==',
    salt: 'stGyx3kQK2vCdRcPL/lHXw==',
  };

  it('1. should generate RSA key pair, export SPKI PEM and import back successfully', async () => {
    const keyPair = await WebCryptoService.generateRsaKeyPair();

    expect(keyPair.publicKeyPem).toContain('-----BEGIN PUBLIC KEY-----');
    expect(keyPair.publicKeyPem).toContain('-----END PUBLIC KEY-----');
    expect(keyPair.privateKeyPem).toContain('-----BEGIN PRIVATE KEY-----');

    const importedPubKey = await WebCryptoService.importPublicKeyPem(
      keyPair.publicKeyPem,
    );
    expect(importedPubKey.algorithm.name).toBe('RSA-OAEP');
  });

  it('2. should wrap and unwrap AES key using RSA-OAEP SHA-256', async () => {
    const keyPair = await WebCryptoService.generateRsaKeyPair();
    const rawAesKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) rawAesKey[i] = i * 7 + 3;

    const wrappedKeyB64 = await WebCryptoService.wrapAesKey(
      rawAesKey,
      keyPair.publicKey,
    );
    expect(typeof wrappedKeyB64).toBe('string');
    expect(wrappedKeyB64.length).toBeGreaterThan(0);

    const unwrappedAesKey = await WebCryptoService.unwrapAesKey(
      wrappedKeyB64,
      keyPair.privateKey,
    );
    expect(unwrappedAesKey).toEqual(rawAesKey);
  });

  it('3. should encrypt and decrypt AES-256-GCM verifying tag splitting (16B) and concatenation', async () => {
    const keyPair = await WebCryptoService.generateRsaKeyPair();
    const message = 'Hello Secure Chat Web 2026! 🔒';

    const payload = await WebCryptoService.encryptMessage(message, {
      '14': keyPair.publicKey,
    });

    expect(payload.content).toBeDefined();
    expect(payload.iv).toBeDefined();
    expect(payload.tag).toBeDefined();
    expect(payload.aes_key_encrypted['14']).toBeDefined();

    // Verify IV length is 16 bytes
    const ivBytes = Asn1Util.base64ToUint8Array(payload.iv);
    expect(ivBytes.length).toBe(16);

    // Verify Tag length is 16 bytes
    const tagBytes = Asn1Util.base64ToUint8Array(payload.tag);
    expect(tagBytes.length).toBe(16);

    // Decrypt
    const aesKeyRaw = await WebCryptoService.unwrapAesKey(
      payload.aes_key_encrypted['14'],
      keyPair.privateKey,
    );
    const decryptedText = await WebCryptoService.decryptMessage(
      payload.content,
      payload.iv,
      payload.tag,
      aesKeyRaw,
    );

    expect(decryptedText).toBe(message);
  });

  it('4. should unlock legacy Python .enc.json file and convert PKCS#1 to PKCS#8 via ASN.1', async () => {
    const { privateKey, privateKeyPem } =
      await WebCryptoService.unlockPrivateKey(legacyEncryptedKeyFile, '123456');

    expect(privateKey).toBeDefined();
    expect(privateKey.algorithm.name).toBe('RSA-OAEP');
    expect(privateKeyPem).toContain('BEGIN RSA PRIVATE KEY');
  });

  it('5. should decrypt historical MySQL message 60 using legacy admin key', async () => {
    const { privateKey } = await WebCryptoService.unlockPrivateKey(
      legacyEncryptedKeyFile,
      '123456',
    );

    // Historical message 60 fixture from secure_chat.sql
    const msg60Keys = JSON.parse(
      '{"15": "aKCnhVAHNIuzkuoN1TCXA+wHPHML/9LarjSiSywbTM+mdeJ9hITHadRbEmRtg7YZSFPpiaUUZCy98P1WCM4DkFKq7d/37Z3BbACJE1StGB7qFatCSeiZymhVFzeficNHk89O8IkpMWanZjBcDWGoDBIu6Cxez1GA7WxWkABNNUt9srxuT2Ch/Z5egBu9peQ1bAKCvy3Js4ZAPhTMfTJMVltTRS/NBlsogiVnXANeTKfVB8B9SyyO6rSXzIfcXQvM9XDXg6NVqhtMJ6et8uEnJiaE448VLVHWV2h0R/mBHblN4RoIXuchftKDx1Ktx8Oy/Ho67w1bKvcWHm5hlon6RA==", "14": "No4JZOdy+t8n0TBra+SLhwO7x4ABiVH9GRw8lYA2MgHRJ985y0tSCnVamgP1UcpbY9gpUvP/CPNv5ZaeplNPAKoPvsanyP8UE7su8y6gzwOv5IM10uOwHa8iZCqXNGAuFUpizazFy636LPOLckgtCnyJFWv7YX8Ga6W7QuYhe+EeiC1ydLFhw+06LRUJM6SwbCPmbfPikWYpPwWBNY6e/k30dc73VGOL4Tke6pfDk2jQYIlqa/532DlWE6hleCKrMiIjF9hddCmVuY583HxCphuxwvTJecwj+p3ZawxGQ/VobsFT5h+uC45oyb+FW6WIeLW4GTEJUw81xnVVyQhaJw=="}',
    );
    const msg60Content = 'MvU=';
    const msg60Iv = 'U7sPwduAf5nNWIq8EIVP2w==';
    const msg60Tag = 'g8207BYufIz+yLEAXR4y2A==';

    const aesKeyRaw = await WebCryptoService.unwrapAesKey(
      msg60Keys['14'],
      privateKey,
    );
    expect(aesKeyRaw.length).toBe(32);

    const decrypted = await WebCryptoService.decryptMessage(
      msg60Content,
      msg60Iv,
      msg60Tag,
      aesKeyRaw,
    );

    // Verify successful decryption without logging secrets
    expect(decrypted).toBe('hi');
  });

  it('6. should decrypt historical MySQL message 61 using legacy admin key', async () => {
    const { privateKey } = await WebCryptoService.unlockPrivateKey(
      legacyEncryptedKeyFile,
      '123456',
    );

    const msg61Content = 'ZlQ=';
    const msg61Iv = 'kAAt4826/U1oUa8cTdg4/A==';
    const msg61Tag = 'LP5+zdka8IHo82cNRkv82g==';
    const msg61KeyFor14 =
      'JcucV0/TMuYHbDeJE/epRXZXZoBh/cCc7R2WeTsDtGCoyKTktO8Y3MxYMhCYMoXL0Tb00D+0vXp1bdDceOFm+si+MDcpHRemBC9ZMXRA5mc+FSzkAZi8rWROoZsCu8i+CHppBlUKnO2L29NmQkdtL+mUPGhd25soIvs1Jkuj0q9or2XCB3H05oYAF8dTDuuxIUymbNzdidluu2EZRH7XfBxyHHoQSSrz1jkdFTL8M6uR4xDY6gZKGVHngk5l8Qkbx8M8Vpwql0nvJftLiGRHlByy562m40IVJPqOD7mEjdyIp7wjrNADvA7PJYEZOXA8C9s6AdIbXo4vU9koCAsjwg==';

    const aesKeyRaw = await WebCryptoService.unwrapAesKey(
      msg61KeyFor14,
      privateKey,
    );
    const decrypted = await WebCryptoService.decryptMessage(
      msg61Content,
      msg61Iv,
      msg61Tag,
      aesKeyRaw,
    );

    expect(decrypted).toBe('ho');
  });

  it('7. should throw error on wrong passphrase when unlocking key vault', async () => {
    await expect(
      WebCryptoService.unlockPrivateKey(legacyEncryptedKeyFile, 'wrong_password'),
    ).rejects.toThrow('Sai mật khẩu hoặc file khóa bị lỗi');
  });

  it('8. should throw error when decrypting message with corrupt authentication tag', async () => {
    const keyPair = await WebCryptoService.generateRsaKeyPair();
    const payload = await WebCryptoService.encryptMessage('Secret', {
      '14': keyPair.publicKey,
    });
    const aesKey = await WebCryptoService.unwrapAesKey(
      payload.aes_key_encrypted['14'],
      keyPair.privateKey,
    );

    // Tamper with tag
    const corruptTag = Asn1Util.uint8ArrayToBase64(new Uint8Array(16)); // all zeros

    await expect(
      WebCryptoService.decryptMessage(
        payload.content,
        payload.iv,
        corruptTag,
        aesKey,
      ),
    ).rejects.toThrow();
  });

  it('9. should throw error when decrypting message with invalid IV length', async () => {
    const invalidIv = Asn1Util.uint8ArrayToBase64(new Uint8Array(8)); // 8 bytes instead of 16
    await expect(
      WebCryptoService.decryptMessage('test', invalidIv, 'test', new Uint8Array(32)),
    ).rejects.toThrow('Invalid IV length');
  });

  it('10. should protect private key and re-unlock successfully (round-trip)', async () => {
    const keyPair = await WebCryptoService.generateRsaKeyPair();
    const passphrase = 'UltraSecurePassphrase2026!';

    const vault = await WebCryptoService.protectPrivateKey(
      keyPair.privateKeyPem,
      passphrase,
    );

    expect(vault.ciphertext).toBeDefined();
    expect(vault.iv).toBeDefined();
    expect(vault.tag).toBeDefined();
    expect(vault.salt).toBeDefined();

    const unlocked = await WebCryptoService.unlockPrivateKey(vault, passphrase);
    expect(unlocked.privateKey).toBeDefined();
    expect(unlocked.privateKeyPem).toBe(keyPair.privateKeyPem);
  });

  it('11. should mathematically prove key-pair equivalence between legacy admin Public Key from MySQL and unlocked Private Key', async () => {
    // Admin public key exactly as stored in MySQL `accounts` table (id 14)
    const adminPublicKeyPem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnk6C/jQKWClAN7PIs9m9
KlYsPdOXRyvVRUidCjM2TzzZJdqFvHVj8cEwHolfxjq6DlcUKkAuQF/Q5wQoBByw
HIjzoL4bvmo0friuy+4Ks9ReaMgd4Ex4OENDYZbHMjr6QqryK9651qV8rFZwJq/n
TpuryP0DB9/TEkSGv2IVSMTgHIoqibAJsECMD4pdm8KsYAGrpCLHHrI7Sj5t+U+9
nlwNiZcF/fjr9vRAWdg993lxjlP/pj0SaKuoPgxrbybUH+64TnoxJJFSp79UL1Fb
CsS8dowybIdO1vPopjocBRwLOOwnbMA8cevuNAwBRYJlXRIrqRL/K48OFTPAqI2R
QwIDAQAB
-----END PUBLIC KEY-----`;

    const importedPubKey = await WebCryptoService.importPublicKeyPem(adminPublicKeyPem);
    const { privateKey } = await WebCryptoService.unlockPrivateKey(
      legacyEncryptedKeyFile,
      '123456',
    );

    // 1. Wrap raw AES key using public key from database
    const rawAesKey = new Uint8Array(32);
    for (let i = 0; i < 32; i++) rawAesKey[i] = (i * 13 + 7) & 0xff;

    const wrappedKeyB64 = await WebCryptoService.wrapAesKey(rawAesKey, importedPubKey);

    // 2. Unwrap with private key unlocked from legacy admin_private.enc.json
    const unwrappedAesKey = await WebCryptoService.unwrapAesKey(wrappedKeyB64, privateKey);
    expect(unwrappedAesKey).toEqual(rawAesKey);

    // 3. Full message encryption round-trip
    const payload = await WebCryptoService.encryptMessage('Challenge message for Admin E2EE', {
      '14': importedPubKey,
    });

    const recoveredKey = await WebCryptoService.unwrapAesKey(
      payload.aes_key_encrypted['14'],
      privateKey,
    );
    const plaintext = await WebCryptoService.decryptMessage(
      payload.content,
      payload.iv,
      payload.tag,
      recoveredKey,
    );
    expect(plaintext).toBe('Challenge message for Admin E2EE');
  });
});
