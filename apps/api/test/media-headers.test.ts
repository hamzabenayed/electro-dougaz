import helmet from '@fastify/helmet';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogController } from '../src/modules/catalog/catalog.controller.js';
import type { CatalogService } from '../src/modules/catalog/catalog.service.js';
import type { MediaService } from '../src/modules/catalog/media.service.js';

describe('Product image response policy with production Helmet defaults', () => {
  let adapter: FastifyAdapter | undefined;
  afterEach(async () => {
    await adapter?.close();
  });

  async function setup() {
    const read = vi.fn().mockResolvedValue(Buffer.from('image fixture'));
    const controller = new CatalogController(
      {} as CatalogService,
      { read } as unknown as MediaService
    );
    adapter = new FastifyAdapter();
    const server = adapter.getInstance();
    await server.register(helmet);
    // Invoke the real response handlers, with storage mocked (no database/account needed).
    server.get('/public-image', (_request, reply) => controller.image('image-id', reply));
    server.get('/admin-image', (_request, reply) => controller.adminImage('image-id', reply));
    server.get('/other', () => ({ ok: true }));
    await server.ready();
    return { server, read };
  }

  it('allows public image embedding from a different website origin', async () => {
    const { server, read } = await setup();
    const response = await server.inject({
      method: 'GET',
      url: '/public-image',
      headers: { origin: 'https://shop.example' }
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(response.headers['content-type']).toBe('image/webp');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(read).toHaveBeenCalledWith('image-id');
  });

  it('keeps private image and unrelated response policies restricted', async () => {
    const { server, read } = await setup();
    const response = await server.inject({ method: 'GET', url: '/admin-image' });
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(read).toHaveBeenCalledWith('image-id', true);
    const other = await server.inject({ method: 'GET', url: '/other' });
    expect(other.headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  it('does not relax headers or return bytes when visibility checks reject an image', async () => {
    const { server, read } = await setup();
    read.mockRejectedValue(Object.assign(new Error('Image introuvable'), { statusCode: 404 }));
    const response = await server.inject({ method: 'GET', url: '/public-image' });
    expect(response.statusCode).toBe(404);
    expect(response.headers['cross-origin-resource-policy']).toBe('same-origin');
    expect(response.body).not.toContain('image fixture');
  });
});
