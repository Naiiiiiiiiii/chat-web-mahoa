'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  AuthContextType,
  AuthStatus,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  UserProfileResponse,
} from '../types/auth.types';
import { apiClient, ApiException } from '../services/api.client';
import { WebCryptoService } from '../services/crypto.service';
import { KeyVaultService } from '../services/vault.service';
import { EncryptedPrivateKeyFile } from '../types/crypto.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfileResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('unauthenticated');
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [privateKeyPem, setPrivateKeyPem] = useState<string | null>(null);
  const [hasStoredVault, setHasStoredVault] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check existing session on mount
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const existingToken = apiClient.getToken();
      if (!existingToken) {
        if (isMounted) {
          setIsLoading(false);
          setStatus('unauthenticated');
        }
        return;
      }

      try {
        const profile = await apiClient.get<UserProfileResponse>('/users/me');
        if (!isMounted) return;

        setUser(profile);
        setToken(existingToken);

        const hasKey = await KeyVaultService.hasKey(profile.username);
        if (isMounted) {
          setHasStoredVault(hasKey);
          if (hasKey) {
            setStatus('unlocking');
          } else {
            setStatus('authenticated_no_key');
          }
        }
      } catch {
        if (isMounted) {
          apiClient.setToken(null);
          setUser(null);
          setToken(null);
          setStatus('unauthenticated');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Login implementation
  const login = useCallback(
    async (credentials: LoginRequest): Promise<UserProfileResponse> => {
      setError(null);
      setStatus('authenticating');

      try {
        const res = await apiClient.post<LoginResponse>(
          '/auth/login',
          credentials,
        );

        apiClient.setToken(res.token);
        setToken(res.token);

        // Fetch user profile
        const profile = await apiClient.get<UserProfileResponse>('/users/me');
        setUser(profile);

        // Check if vault exists in IndexedDB for this user
        const hasKey = await KeyVaultService.hasKey(profile.username);
        setHasStoredVault(hasKey);

        if (hasKey) {
          const vault = await KeyVaultService.getVault(profile.username);
          if (vault) {
            try {
              // Seamless unlock attempt using login password
              const unlocked = await WebCryptoService.unlockPrivateKey(
                vault,
                credentials.password,
              );
              setPrivateKey(unlocked.privateKey);
              setPrivateKeyPem(unlocked.privateKeyPem);
              setStatus('ready_e2ee');
              return profile;
            } catch {
              // Passphrase mismatch with vault (user used different password for vault)
              setStatus('unlocking');
              return profile;
            }
          }
        }

        // Device doesn't have the private key
        setStatus('authenticated_no_key');
        return profile;
      } catch (err: any) {
        const errorMsg =
          err instanceof ApiException
            ? err.msg
            : 'Đăng nhập không thành công. Vui lòng kiểm tra lại.';
        setError(errorMsg);
        setStatus('error');
        throw err;
      }
    },
    [],
  );

  // Register implementation
  const register = useCallback(
    async (
      data: Omit<RegisterRequest, 'public_key'>,
    ): Promise<{ user_id: number; downloadJson: string; storedInBrowser: boolean }> => {
      setError(null);

      // 1. Client-side input validation
      if (!data.username || data.username.trim().length < 3) {
        throw new Error('Tên đăng nhập phải có ít nhất 3 ký tự');
      }
      if (!data.password || data.password.length < 6) {
        throw new Error('Mật khẩu phải có ít nhất 6 ký tự');
      }

      // 2. Generate RSA-2048 Key Pair
      const { publicKeyPem, privateKeyPem } =
        await WebCryptoService.generateRsaKeyPair();

      // 3. Encrypt Private Key with password (PBKDF2 + AES-256-GCM)
      const vault: EncryptedPrivateKeyFile =
        await WebCryptoService.protectPrivateKey(
          privateKeyPem,
          data.password,
        );

      // 4. Verify that generated vault can be decrypted with password
      await WebCryptoService.unlockPrivateKey(vault, data.password);

      // 5. Register with backend with public_key
      const registerPayload: RegisterRequest = {
        ...data,
        public_key: publicKeyPem,
      };

      const res = await apiClient.post<RegisterResponse>(
        '/auth/register',
        registerPayload,
      );

      // 6. Save encrypted vault to IndexedDB
      let storedInBrowser = false;
      try {
        await KeyVaultService.saveVault(data.username, vault);
        setHasStoredVault(true);
        storedInBrowser = true;
      } catch {
        storedInBrowser = false;
      }

      // 7. Generate exportable backup JSON string
      const downloadJson = KeyVaultService.exportVaultAsJson(vault);

      return {
        user_id: res.user_id,
        downloadJson,
        storedInBrowser,
      };
    },
    [],
  );

  // Unlock stored key
  const unlockStoredKey = useCallback(
    async (passphrase: string): Promise<void> => {
      if (!user) {
        throw new Error('Chưa đăng nhập');
      }

      setError(null);
      const vault = await KeyVaultService.getVault(user.username);
      if (!vault) {
        setStatus('authenticated_no_key');
        throw new Error('Không tìm thấy file khóa trên thiết bị này');
      }

      try {
        const unlocked = await WebCryptoService.unlockPrivateKey(
          vault,
          passphrase,
        );
        setPrivateKey(unlocked.privateKey);
        setPrivateKeyPem(unlocked.privateKeyPem);
        setStatus('ready_e2ee');
      } catch {
        const msg = 'Mật khẩu mở khóa không chính xác';
        setError(msg);
        throw new Error(msg);
      }
    },
    [user],
  );

  // Import key from file
  const importKeyFile = useCallback(
    async (jsonContent: string, passphrase: string): Promise<void> => {
      if (!user) {
        throw new Error('Chưa đăng nhập');
      }

      setError(null);

      // Atomic verification: if verification fails, existing stored key is untouched
      // Also verifies private key matches user.public_key (cannot import other user's key)
      const result = await KeyVaultService.importAndVerifyVault(
        jsonContent,
        passphrase,
        user.username,
        user.public_key,
      );

      setPrivateKey(result.privateKey);
      setPrivateKeyPem(result.privateKeyPem);
      setHasStoredVault(true);
      setStatus('ready_e2ee');
    },
    [user],
  );

  // Export stored key as JSON
  const exportKeyFile = useCallback(async (): Promise<string> => {
    if (!user) {
      throw new Error('Chưa đăng nhập');
    }

    const vault = await KeyVaultService.getVault(user.username);
    if (!vault) {
      throw new Error('Chưa có dữ liệu bảo mật được lưu trên thiết bị này');
    }

    return KeyVaultService.exportVaultAsJson(vault);
  }, [user]);

  // Logout
  const logout = useCallback(async (): Promise<void> => {
    if (token) {
      try {
        await apiClient.post('/auth/logout');
      } catch {
        // Ignore network failure on logout
      }
    }

    apiClient.setToken(null);
    setUser(null);
    setToken(null);
    setPrivateKey(null);
    setPrivateKeyPem(null);
    setError(null);
    setStatus('unauthenticated');
    // NOTE: Does NOT delete key vault from IndexedDB!
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        status,
        privateKey,
        privateKeyPem,
        error,
        hasStoredVault,
        isLoading,
        login,
        register,
        unlockStoredKey,
        importKeyFile,
        exportKeyFile,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
