import * as crypto from 'crypto';

export class PasswordUtil {
  private static readonly DEFAULT_N = 32768;
  private static readonly DEFAULT_R = 8;
  private static readonly DEFAULT_P = 1;
  private static readonly DEFAULT_KEYLEN = 64;
  private static readonly MAX_MEM = 128 * 1024 * 1024; // 128 MB

  /**
   * Generates a password hash compatible with Werkzeug (scrypt:32768:8:1$salt$digest)
   */
  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex').slice(0, 16);
    const derived = crypto.scryptSync(
      password,
      salt,
      this.DEFAULT_KEYLEN,
      {
        N: this.DEFAULT_N,
        r: this.DEFAULT_R,
        p: this.DEFAULT_P,
        maxmem: this.MAX_MEM,
      },
    );

    return `scrypt:${this.DEFAULT_N}:${this.DEFAULT_R}:${this.DEFAULT_P}$${salt}$${derived.toString('hex')}`;
  }

  /**
   * Verifies a password against a Werkzeug-compatible scrypt or pbkdf2 hash
   */
  static verifyPassword(password: string, passwordHash: string): boolean {
    if (!password || !passwordHash) {
      return false;
    }

    try {
      const parts = passwordHash.split('$');
      if (parts.length !== 3) {
        return false;
      }

      const [header, salt, expectedHex] = parts;

      if (header.startsWith('scrypt')) {
        const headerParams = header.split(':');
        const N = parseInt(headerParams[1], 10) || this.DEFAULT_N;
        const r = parseInt(headerParams[2], 10) || this.DEFAULT_R;
        const p = parseInt(headerParams[3], 10) || this.DEFAULT_P;
        const keylen = Buffer.from(expectedHex, 'hex').length;

        const derived = crypto.scryptSync(
          password,
          salt,
          keylen,
          {
            N,
            r,
            p,
            maxmem: this.MAX_MEM,
          },
        );

        const expectedBuf = Buffer.from(expectedHex, 'hex');
        return crypto.timingSafeEqual(derived, expectedBuf);
      }

      // Fallback for pbkdf2:sha256:rounds$salt$digest
      if (header.startsWith('pbkdf2')) {
        const headerParams = header.split(':');
        const hashAlgo = headerParams[1] || 'sha256';
        const iterations = parseInt(headerParams[2], 10) || 260000;
        const keylen = Buffer.from(expectedHex, 'hex').length;

        const derived = crypto.pbkdf2Sync(password, salt, iterations, keylen, hashAlgo);
        const expectedBuf = Buffer.from(expectedHex, 'hex');
        return crypto.timingSafeEqual(derived, expectedBuf);
      }

      return false;
    } catch {
      return false;
    }
  }
}
