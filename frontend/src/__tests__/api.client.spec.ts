import { ApiClient, ApiException } from '../services/api.client';

describe('ApiClient', () => {
  let client: ApiClient;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    client = new ApiClient('http://localhost:5000');
    client.setToken(null);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('performs successful GET request and parses JSON', async () => {
    const mockData = { user_id: 1, username: 'testuser' };
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => mockData,
    });

    const result = await client.get<typeof mockData>('/users/me');
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/users/me',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('attaches Authorization Bearer token when token is set', async () => {
    client.setToken('test-jwt-token-12345');

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ msg: 'success' }),
    });

    await client.get('/users/me');

    const lastCall = (globalThis.fetch as jest.Mock).mock.calls[0];
    const headers = lastCall[1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-jwt-token-12345');
  });

  it('performs POST request with JSON stringified body and Content-Type header', async () => {
    const reqBody = { username: 'alice', password: 'password123' };
    const resBody = { token: 'jwt-xyz', user_id: 2 };

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => resBody,
    });

    const result = await client.post<typeof resBody>('/auth/login', reqBody);
    expect(result).toEqual(resBody);

    const call = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toBe('http://localhost:5000/auth/login');
    expect(call[1].method).toBe('POST');
    expect(call[1].body).toBe(JSON.stringify(reqBody));
    const headers = call[1].headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('throws ApiException with backend msg on 401 Unauthorized', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ msg: 'Invalid credentials' }),
    });

    await expect(client.post('/auth/login', {})).rejects.toThrow(ApiException);

    try {
      await client.post('/auth/login', {});
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiException);
      expect(err.status).toBe(401);
      expect(err.msg).toBe('Invalid credentials');
    }
  });

  it('throws ApiException on 403 Forbidden', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ msg: 'Access denied to this chat' }),
    });

    try {
      await client.get('/chats/99/messages');
      fail('Should have thrown ApiException');
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.msg).toBe('Access denied to this chat');
    }
  });

  it('handles network failure with isNetworkError = true', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    try {
      await client.get('/users/me');
      fail('Should have thrown network ApiException');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiException);
      expect(err.status).toBe(0);
      expect(err.isNetworkError).toBe(true);
      expect(err.msg).toContain('Không thể kết nối đến máy chủ');
    }
  });

  it('handles non-JSON or invalid response gracefully', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html>Bad Gateway</html>',
    });

    try {
      await client.get('/users/me');
      fail('Should have thrown on 502');
    } catch (err: any) {
      expect(err.status).toBe(502);
      expect(err.msg).toBe('<html>Bad Gateway</html>');
    }
  });
});
