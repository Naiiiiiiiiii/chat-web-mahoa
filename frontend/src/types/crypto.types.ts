export interface EncryptedPrivateKeyFile {
  ciphertext: string; // Base64 of AES-256-GCM ciphertext
  iv: string;         // Base64 of 16 bytes IV
  tag: string;        // Base64 of 16 bytes Tag
  salt: string;       // Base64 of 16 bytes PBKDF2 salt
}

export interface EncryptedMessagePayload {
  content: string;                            // Base64 ciphertext
  aes_key_encrypted: Record<string, string>; // { [accountId: string]: Base64 wrappedKey }
  iv: string;                                 // Base64 16 bytes IV
  tag: string;                                // Base64 16 bytes Auth Tag
}

export interface DecryptedMessageResult {
  text: string;
}
