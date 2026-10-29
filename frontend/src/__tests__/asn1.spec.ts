import { Asn1Util } from '../utils/asn1.util';

describe('Asn1Util - ASN.1 DER Parser & PKCS#1 to PKCS#8 Converter', () => {
  it('should encode and decode base64 correctly', () => {
    const raw = new Uint8Array([0, 1, 2, 255, 128, 64, 32]);
    const b64 = Asn1Util.uint8ArrayToBase64(raw);
    const decoded = Asn1Util.base64ToUint8Array(b64);
    expect(decoded).toEqual(raw);
  });

  it('should correctly strip PEM headers and footers to DER', () => {
    const pem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
-----END PUBLIC KEY-----`;
    const der = Asn1Util.pemToDer(pem);
    expect(der.length).toBeGreaterThan(0);
  });

  it('should throw error on buffer shorter than minimum PKCS#1 size', () => {
    const shortBuffer = new Uint8Array([0x30, 0x05, 0x02, 0x01, 0x00]);
    expect(() => Asn1Util.verifyPkcs1Structure(shortBuffer)).toThrow(
      'Invalid PKCS#1 DER: buffer too short',
    );
  });

  it('should throw error if first tag is not SEQUENCE (0x30)', () => {
    const badTag = new Uint8Array(120);
    badTag[0] = 0x31; // SET instead of SEQUENCE
    expect(() => Asn1Util.verifyPkcs1Structure(badTag)).toThrow(
      'Invalid PKCS#1 DER: Expected SEQUENCE tag (0x30)',
    );
  });

  it('should throw error if buffer is truncated compared to declared sequence length', () => {
    const truncated = new Uint8Array(120);
    truncated[0] = 0x30;
    truncated[1] = 0x82;
    truncated[2] = 0x04;
    truncated[3] = 0xb8; // declared length 1208 bytes, but buffer has only 120 bytes
    expect(() => Asn1Util.verifyPkcs1Structure(truncated)).toThrow(
      'Invalid PKCS#1 DER: Buffer truncated',
    );
  });

  it('should throw error if version is not INTEGER 0', () => {
    const badVersion = new Uint8Array(200);
    badVersion[0] = 0x30;
    badVersion[1] = 0x81;
    badVersion[2] = 150;
    badVersion[3] = 0x02; // INTEGER
    badVersion[4] = 0x01; // Length 1
    badVersion[5] = 0x01; // Version 1 (invalid, must be 0)
    expect(() => Asn1Util.verifyPkcs1Structure(badVersion)).toThrow(
      'Invalid PKCS#1 DER: Expected version 0',
    );
  });

  it('should throw error on unsupported length octet count (numOctets > 4 or numOctets == 0)', () => {
    const badLengthOctets = new Uint8Array(200);
    badLengthOctets[0] = 0x30;
    badLengthOctets[1] = 0x85; // 5 length octets (unsupported)
    expect(() => Asn1Util.verifyPkcs1Structure(badLengthOctets)).toThrow(
      'Unsupported length octets count',
    );

    const indefiniteLength = new Uint8Array(200);
    indefiniteLength[0] = 0x30;
    indefiniteLength[1] = 0x80; // Indefinite length (invalid in DER)
    expect(() => Asn1Util.verifyPkcs1Structure(indefiniteLength)).toThrow(
      'Unsupported length octets count',
    );
  });

  it('should throw error if any RSA component inside SEQUENCE is not an INTEGER (tag 0x02)', () => {
    // Construct a sequence with version 0, but second component is not INTEGER
    const badComponent = new Uint8Array(150);
    badComponent[0] = 0x30; // SEQUENCE
    badComponent[1] = 0x81;
    badComponent[2] = 120; // Length
    badComponent[3] = 0x02; // INTEGER (version)
    badComponent[4] = 0x01;
    badComponent[5] = 0x00; // version = 0
    badComponent[6] = 0x04; // OCTET STRING instead of INTEGER (modulus)
    badComponent[7] = 0x0a; // Length 10

    expect(() => Asn1Util.verifyPkcs1Structure(badComponent)).toThrow(
      'Expected INTEGER tag (0x02)',
    );
  });

  it('should format DER to standard PEM with 64-character line wraps', () => {
    const raw = new Uint8Array(70);
    for (let i = 0; i < 70; i++) raw[i] = i;
    const pem = Asn1Util.derToPem(raw, 'TEST LABEL');
    expect(pem).toContain('-----BEGIN TEST LABEL-----');
    expect(pem).toContain('-----END TEST LABEL-----');
    const lines = pem.split('\n');
    expect(lines[1].length).toBeLessThanOrEqual(64);
  });
});
