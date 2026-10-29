import { ApiErrorResponse } from '../types/auth.types';

export class ApiException extends Error {
  public status: number;
  public msg: string;
  public isNetworkError: boolean;

  constructor(status: number, msg: string, isNetworkError: boolean = false) {
    super(msg);
    this.name = 'ApiException';
    this.status = status;
    this.msg = msg;
    this.isNetworkError = isNetworkError;
    Object.setPrototypeOf(this, ApiException.prototype);
  }
}

export interface RequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private static readonly STORAGE_TOKEN_KEY = 'secure_chat_auth_token';

  constructor(baseUrl?: string) {
    this.baseUrl = (
      baseUrl ||
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
      'http://localhost:5000'
    ).replace(/\/+$/, '');

    // Initialize token from sessionStorage if running in browser
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        this.token = window.sessionStorage.getItem(ApiClient.STORAGE_TOKEN_KEY);
      } catch {
        this.token = null;
      }
    }
  }

  public setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        if (token) {
          window.sessionStorage.setItem(ApiClient.STORAGE_TOKEN_KEY, token);
        } else {
          window.sessionStorage.removeItem(ApiClient.STORAGE_TOKEN_KEY);
        }
      } catch {
        // Storage might be restricted or full
      }
    }
  }

  public getToken(): string | null {
    if (!this.token && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        this.token = window.sessionStorage.getItem(ApiClient.STORAGE_TOKEN_KEY);
      } catch {
        this.token = null;
      }
    }
    return this.token;
  }

  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${cleanEndpoint}`;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(endpoint);
    const headers = new Headers(options.headers || {});

    // Always expect JSON response unless custom header specified
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    // Attach Bearer token if available
    const token = this.getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    // Default Content-Type for requests with body
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (networkError: any) {
      // Never log sensitive data or URLs with parameters
      throw new ApiException(
        0,
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng hoặc thử lại sau.',
        true,
      );
    }

    // Parse JSON or text
    let data: any;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } else {
      try {
        data = await response.text();
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      let errorMessage = 'Đã có lỗi xảy ra từ máy chủ.';
      if (data && typeof data === 'object') {
        const errObj = data as Partial<ApiErrorResponse & { message?: string | string[] }>;
        if (typeof errObj.msg === 'string' && errObj.msg.trim() !== '') {
          errorMessage = errObj.msg;
        } else if (Array.isArray(errObj.message)) {
          errorMessage = errObj.message.join(', ');
        } else if (typeof errObj.message === 'string') {
          errorMessage = errObj.message;
        }
      } else if (typeof data === 'string' && data.trim() !== '') {
        errorMessage = data;
      }

      throw new ApiException(response.status, errorMessage);
    }

    return data as T;
  }

  public async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  public async post<T>(
    endpoint: string,
    body?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async put<T>(
    endpoint: string,
    body?: any,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public async delete<T>(
    endpoint: string,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

// Global singleton instance for app-wide use
export const apiClient = new ApiClient();
