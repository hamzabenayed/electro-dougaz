import { FastifyAdapter } from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createCorsOptions } from '../src/config/cors.js';

describe('Browser API access', () => {
  let adapter: FastifyAdapter;

  beforeEach(async () => {
    adapter = new FastifyAdapter();
    adapter.enableCors(createCorsOptions(' http://localhost:3000, http://localhost:3100 '));
    await adapter.getInstance().ready();
  });

  afterEach(async () => {
    await adapter.close();
  });

  it.each([
    ['DELETE', '/api/v1/admin/products/test-product/images/test-image'],
    ['PATCH', '/api/v1/admin/orders/test-order/status'],
    ['PATCH', '/api/v1/admin/inventory/adjust'],
    ['PUT', '/api/v1/admin/products/test-product'],
    ['POST', '/api/v1/orders']
  ])('permits %s preflight for %s', async (method, url) => {
    const response = await adapter.getInstance().inject({
      method: 'OPTIONS',
      url,
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': method,
        'access-control-request-headers': 'authorization,content-type,idempotency-key'
      }
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(String(response.headers['access-control-allow-methods']).split(/,\s*/)).toContain(
      method
    );
    expect(
      String(response.headers['access-control-allow-headers']).toLowerCase().split(/,\s*/)
    ).toEqual(expect.arrayContaining(['authorization', 'content-type', 'idempotency-key']));
  });

  it('does not grant browser access to an untrusted origin', async () => {
    const response = await adapter.getInstance().inject({
      method: 'OPTIONS',
      url: '/api/v1/admin/orders/test-order/status',
      headers: { origin: 'https://untrusted.example', 'access-control-request-method': 'PATCH' }
    });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
