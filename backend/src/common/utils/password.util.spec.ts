import { PasswordUtil } from './password.util';

describe('PasswordUtil', () => {
  it('should verify the existing admin password hash from MySQL database', () => {
    // Hash of admin from secure_chat.sql
    const adminHash =
      'scrypt:32768:8:1$nqWqDlOerDcxkz9t$13f075ba7525633c067f725f3d65f08f0c4db0987ce05ff6d85cddae81ea2e66ceeb6a77fa22608ab66d701a89a0296613ba695361e5b1eb4ff3f274ef47a9a7';

    expect(PasswordUtil.verifyPassword('123456', adminHash)).toBe(true);
    expect(PasswordUtil.verifyPassword('wrongpassword', adminHash)).toBe(false);
  });

  it('should verify the existing admin1 password hash from MySQL database', () => {
    // Hash of admin1 from secure_chat.sql
    const admin1Hash =
      'scrypt:32768:8:1$JZJrG2DGbXgK9SZG$be6f4d69606815b6cd6f52d185902d9b668b60893e761cce526b6db9008f24167a6c07a784f25bb45927a34b4e5976197898fccb1ed96e9761e4bdbfe610f606';

    expect(PasswordUtil.verifyPassword('123456', admin1Hash)).toBe(true);
    expect(PasswordUtil.verifyPassword('123', admin1Hash)).toBe(false);
  });

  it('should generate a valid hash and verify it successfully', () => {
    const password = 'MySecurePassword2026!';
    const hash = PasswordUtil.hashPassword(password);

    expect(hash.startsWith('scrypt:32768:8:1$')).toBe(true);
    expect(PasswordUtil.verifyPassword(password, hash)).toBe(true);
    expect(PasswordUtil.verifyPassword('wrong', hash)).toBe(false);
  });
});
