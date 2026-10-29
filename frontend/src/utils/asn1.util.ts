/**
 * ASN.1 DER Parser and PKCS#1 to PKCS#8 Converter with Structural Verification.
 * Designed to run in all environments (browser and Node.js) with zero external dependencies.
 */

export class Asn1Util {
  /**
   * Converts standard Base64 string to Uint8Array safely in browser and Node.js
   */
  static base64ToUint8Array(base64: string): Uint8Array {
    const cleanBase64 = base64.replace(/\s+/g, '');
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(cleanBase64, 'base64'));
    }
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Converts Uint8Array to standard Base64 string safely
   */
  static uint8ArrayToBase64(bytes: Uint8Array): string {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64');
    }
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Strips PEM headers, footers and whitespace to return raw DER bytes
   */
  static pemToDer(pem: string): Uint8Array {
    const clean = pem
      .replace(/-----BEGIN[^-]+-----/g, '')
      .replace(/-----END[^-]+-----/g, '')
      .replace(/\s+/g, '');
    return this.base64ToUint8Array(clean);
  }

  /**
   * Formats raw DER bytes as standard PEM string
   */
  static derToPem(der: Uint8Array, label: string): string {
    const b64 = this.uint8ArrayToBase64(der);
    const lines = b64.match(/.{1,64}/g) || [];
    return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
  }

  /**
   * Encodes ASN.1 length in DER format
   */
  private static encodeLength(length: number): Uint8Array {
    if (length < 128) {
      return new Uint8Array([length]);
    }
    const bytes: number[] = [];
    let temp = length;
    while (temp > 0) {
      bytes.unshift(temp & 0xff);
      temp = temp >> 8;
    }
    return new Uint8Array([0x80 | bytes.length, ...bytes]);
  }

  /**
   * Decodes ASN.1 length from DER buffer at offset
   */
  private static decodeLength(
    bytes: Uint8Array,
    offset: number,
  ): { length: number; bytesRead: number } {
    if (offset >= bytes.length) {
      throw new Error('ASN.1 DER: Offset out of bounds reading length');
    }
    const first = bytes[offset];
    if ((first & 0x80) === 0) {
      return { length: first, bytesRead: 1 };
    }
    const numOctets = first & 0x7f;
    if (numOctets === 0 || numOctets > 4) {
      throw new Error(`ASN.1 DER: Unsupported length octets count: ${numOctets}`);
    }
    if (offset + 1 + numOctets > bytes.length) {
      throw new Error('ASN.1 DER: Truncated buffer while reading length octets');
    }
    let length = 0;
    for (let i = 0; i < numOctets; i++) {
      length = (length << 8) | bytes[offset + 1 + i];
    }
    return { length, bytesRead: 1 + numOctets };
  }

  /**
   * Verifies the structure of a PKCS#1 RSAPrivateKey DER:
   * RSAPrivateKey ::= SEQUENCE {
   *   version           INTEGER,  -- 0
   *   modulus           INTEGER,  -- n
   *   publicExponent    INTEGER,  -- e
   *   privateExponent   INTEGER,  -- d
   *   prime1            INTEGER,  -- p
   *   prime2            INTEGER,  -- q
   *   exponent1         INTEGER,  -- d mod (p-1)
   *   exponent2         INTEGER,  -- d mod (q-1)
   *   coefficient       INTEGER   -- (inverse of q) mod p
   * }
   */
  static verifyPkcs1Structure(pkcs1Der: Uint8Array): void {
    if (!pkcs1Der || pkcs1Der.length < 100) {
      throw new Error('Invalid PKCS#1 DER: buffer too short');
    }
    if (pkcs1Der[0] !== 0x30) {
      throw new Error('Invalid PKCS#1 DER: Expected SEQUENCE tag (0x30)');
    }

    const { length: seqLen, bytesRead: lenBytes } = this.decodeLength(pkcs1Der, 1);
    const totalExpected = 1 + lenBytes + seqLen;
    if (pkcs1Der.length < totalExpected) {
      throw new Error(
        `Invalid PKCS#1 DER: Buffer truncated. Expected ${totalExpected} bytes, got ${pkcs1Der.length}`,
      );
    }

    let cursor = 1 + lenBytes;
    // Element 1: version INTEGER (must be tag 0x02, length 1, value 0x00)
    if (pkcs1Der[cursor] !== 0x02) {
      throw new Error('Invalid PKCS#1 DER: Expected INTEGER tag for version');
    }
    const vLen = this.decodeLength(pkcs1Der, cursor + 1);
    cursor += 1 + vLen.bytesRead;
    if (vLen.length !== 1 || pkcs1Der[cursor] !== 0x00) {
      throw new Error('Invalid PKCS#1 DER: Expected version 0');
    }
    cursor += vLen.length;

    // Verify presence of at least 8 remaining INTEGER components
    for (let i = 0; i < 8; i++) {
      if (cursor >= 1 + lenBytes + seqLen) {
        throw new Error(`Invalid PKCS#1 DER: Truncated before INTEGER #${i + 2}`);
      }
      if (pkcs1Der[cursor] !== 0x02) {
        throw new Error(
          `Invalid PKCS#1 DER: Expected INTEGER tag (0x02) at offset ${cursor}, got 0x${pkcs1Der[cursor].toString(16)}`,
        );
      }
      const itemLen = this.decodeLength(pkcs1Der, cursor + 1);
      cursor += 1 + itemLen.bytesRead + itemLen.length;
    }
  }

  /**
   * Converts a verified PKCS#1 RSAPrivateKey DER into PKCS#8 PrivateKeyInfo DER
   * PrivateKeyInfo ::= SEQUENCE {
   *   version                   Version, -- 0
   *   privateKeyAlgorithm       PrivateKeyAlgorithmIdentifier, -- rsaEncryption OID
   *   privateKey                PrivateKey -- OCTET STRING containing PKCS#1
   * }
   */
  static convertPkcs1ToPkcs8(pkcs1Der: Uint8Array): Uint8Array {
    // 1. Verify structure
    this.verifyPkcs1Structure(pkcs1Der);

    // 2. AlgorithmIdentifier for rsaEncryption (OID: 1.2.840.113549.1.1.1, NULL params)
    // 30 0D 06 09 2A 86 48 86 F7 0D 01 01 01 05 00
    const rsaOidHeader = new Uint8Array([
      0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
      0x05, 0x00,
    ]);

    // 3. Wrap pkcs1Der in OCTET STRING (0x04)
    const octetLen = this.encodeLength(pkcs1Der.length);
    const octetString = new Uint8Array(1 + octetLen.length + pkcs1Der.length);
    octetString[0] = 0x04;
    octetString.set(octetLen, 1);
    octetString.set(pkcs1Der, 1 + octetLen.length);

    // 4. Version INTEGER 0 (0x02 0x01 0x00)
    const version = new Uint8Array([0x02, 0x01, 0x00]);

    // 5. Build inner sequence content
    const innerLen = version.length + rsaOidHeader.length + octetString.length;
    const seqLenBytes = this.encodeLength(innerLen);

    // 6. Assemble full PKCS#8 DER
    const pkcs8Der = new Uint8Array(1 + seqLenBytes.length + innerLen);
    let offset = 0;
    pkcs8Der[offset] = 0x30; // SEQUENCE
    offset += 1;
    pkcs8Der.set(seqLenBytes, offset);
    offset += seqLenBytes.length;
    pkcs8Der.set(version, offset);
    offset += version.length;
    pkcs8Der.set(rsaOidHeader, offset);
    offset += rsaOidHeader.length;
    pkcs8Der.set(octetString, offset);

    return pkcs8Der;
  }
}
