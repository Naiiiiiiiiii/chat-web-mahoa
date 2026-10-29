export interface RegisterRequest {
  username: string;
  password: string;
  public_key: string;
  full_name?: string;
  gender?: 'male' | 'female' | 'other';
  date_of_birth?: string;
  avatar_url?: string;
  bio?: string;
}

export interface RegisterResponse {
  msg: string;
  user_id: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user_id: number;
}

export interface LogoutResponse {
  msg: string;
}

export interface UserProfileResponse {
  user_id: number;
  username: string;
  full_name: string | null;
  gender: 'male' | 'female' | 'other';
  date_of_birth: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: 'online' | 'offline';
  last_seen: string | null;
  public_key: string;
}

export interface ApiErrorResponse {
  msg: string;
}

export type AuthStatus =
  | 'unauthenticated'
  | 'authenticating'
  | 'authenticated_no_key'
  | 'unlocking'
  | 'ready_e2ee'
  | 'error';

export interface AuthContextType {
  user: UserProfileResponse | null;
  token: string | null;
  status: AuthStatus;
  privateKey: CryptoKey | null;
  privateKeyPem: string | null;
  error: string | null;
  hasStoredVault: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<UserProfileResponse>;
  register: (
    data: Omit<RegisterRequest, 'public_key'>,
  ) => Promise<{ user_id: number; downloadJson: string; storedInBrowser: boolean }>;
  unlockStoredKey: (passphrase: string) => Promise<void>;
  importKeyFile: (jsonContent: string, passphrase: string) => Promise<void>;
  exportKeyFile: () => Promise<string>;
  logout: () => Promise<void>;
  clearError: () => void;
}
