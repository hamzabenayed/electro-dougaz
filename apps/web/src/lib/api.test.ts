import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, ApiError } from './api';
import { adminRequest } from './admin-api';

const request = vi.fn<typeof fetch>();
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal('fetch', request);
});
afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
const sentHeaders = () => new Headers(request.mock.calls[0]?.[1]?.headers);

describe('Request body and headers', () => {
  it.each(['GET', 'DELETE', 'POST'])(
    'does not label a bodyless %s request as JSON',
    async (method) => {
      await apiRequest('/test', { method, headers: { Authorization: 'Bearer test-token' } });
      expect(sentHeaders().has('Content-Type')).toBe(false);
      expect(sentHeaders().get('Authorization')).toBe('Bearer test-token');
      expect(request.mock.calls[0]?.[1]?.body).toBeUndefined();
    }
  );
  it.each([null, ''])('does not add JSON content type to an empty body (%s)', async (body) => {
    await apiRequest('/test', { method: 'DELETE', body });
    expect(sentHeaders().has('Content-Type')).toBe(false);
  });
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('preserves JSON bodies on %s', async (method) => {
    const body = JSON.stringify({ id: 'test', quantity: 2 });
    await apiRequest('/test', { method, body });
    expect(sentHeaders().get('Content-Type')).toBe('application/json');
    expect(request.mock.calls[0]?.[1]?.body).toBe(body);
  });
  it('preserves explicit content types without case-sensitive duplicates', async () => {
    await apiRequest('/test', {
      method: 'POST',
      body: 'text',
      headers: { 'content-type': 'text/plain' }
    });
    expect(sentHeaders().get('Content-Type')).toBe('text/plain');
  });
  it.each([new FormData(), new Blob(['image'], { type: 'image/webp' })])(
    'does not override native upload body headers (%#)',
    async (body) => {
      await apiRequest('/test', { method: 'POST', body });
      expect(sentHeaders().has('Content-Type')).toBe(false);
      expect(request.mock.calls[0]?.[1]?.body).toBe(body);
    }
  );
  it.each([new Headers({ 'X-Test': 'kept' }), [['X-Test', 'kept']] as [string, string][]])(
    'preserves Headers and tuple inputs (%#)',
    async (headers) => {
      await apiRequest('/test', { headers });
      expect(sentHeaders().get('X-Test')).toBe('kept');
    }
  );
  it('handles a successful empty delete response', async () => {
    request.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiRequest('/test', { method: 'DELETE' })).resolves.toBeUndefined();
  });
  it('retains useful API error messages and status', async () => {
    request.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Photo introuvable' }), { status: 404 })
    );
    await expect(apiRequest('/test', { method: 'DELETE' })).rejects.toMatchObject({
      message: 'Photo introuvable',
      status: 404
    });
  });
});

describe('Admin request headers', () => {
  it('preserves caller headers and sends the current token without an empty JSON body', async () => {
    sessionStorage.setItem('electro-dougaz-admin-token', 'current-token');
    const headers = new Headers({ 'Idempotency-Key': 'retry-key', Authorization: 'Bearer old' });
    await adminRequest('/admin/test', { method: 'DELETE', headers });
    expect(sentHeaders().get('Authorization')).toBe('Bearer current-token');
    expect(sentHeaders().get('Idempotency-Key')).toBe('retry-key');
    expect(sentHeaders().has('Content-Type')).toBe(false);
    expect(headers.get('Authorization')).toBe('Bearer old');
  });
  it('does not send a request without an admin session', async () => {
    await expect(adminRequest('/admin/test')).rejects.toBeInstanceOf(ApiError);
    expect(request).not.toHaveBeenCalled();
  });
  it('still clears expired sessions on a 401 response', async () => {
    sessionStorage.setItem('electro-dougaz-admin-token', 'expired');
    request.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Expired' }), { status: 401 })
    );
    await expect(adminRequest('/admin/test')).rejects.toMatchObject({ status: 401 });
    expect(sessionStorage.getItem('electro-dougaz-admin-token')).toBeNull();
  });
});
