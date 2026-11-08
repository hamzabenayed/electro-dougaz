import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import type { DatabaseService } from '../src/database/database.service.js';
import { MediaService } from '../src/modules/catalog/media.service.js';
import { ProductMediaStorage } from '../src/modules/catalog/media-storage.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function setup() {
  vi.stubEnv('MEDIA_DRIVER', 'cloudinary');
  vi.stubEnv('CLOUDINARY_URL', 'cloudinary://test-key:test-secret@test-cloud');
  const query = vi.fn();
  const transaction = vi.fn((work: (client: { query: typeof query }) => Promise<unknown>) =>
    work({ query })
  );
  const database = { query, transaction } as unknown as DatabaseService;
  const write = vi.spyOn(ProductMediaStorage.prototype, 'write').mockResolvedValue();
  const read = vi
    .spyOn(ProductMediaStorage.prototype, 'read')
    .mockResolvedValue(Buffer.from('image'));
  return { query, write, read, service: new MediaService(database) };
}
async function input() {
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
    .png()
    .toBuffer();
  return { data: image.toString('base64'), alt: 'Photo' };
}

describe('Media service storage integration', () => {
  it('checks catalogue visibility before contacting storage', async () => {
    const { query, read, service } = setup();
    query.mockResolvedValue({ rows: [] });
    await expect(service.read('hidden-image')).rejects.toMatchObject({ status: 404 });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("p.status='published' AND c.is_visible=true"),
      ['hidden-image', false]
    );
    expect(read).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    'serves allowed images using the requested admin flag: %s',
    async (admin) => {
      const { query, read, service } = setup();
      const key = `cloudinary:${'a'.repeat(64)}.webp`;
      query.mockResolvedValue({ rows: [{ object_key: key }] });
      expect(await service.read('image-id', admin)).toEqual(Buffer.from('image'));
      expect(query).toHaveBeenCalledWith(expect.any(String), ['image-id', admin]);
      expect(read).toHaveBeenCalledWith(key);
    }
  );
  it('rejects unknown products before writing files', async () => {
    const { query, write, service } = setup();
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    await expect(service.upload('unknown', await input(), 'actor')).rejects.toMatchObject({
      status: 404
    });
    expect(write).not.toHaveBeenCalled();
  });
  it('returns an existing association on retry without another provider call', async () => {
    const { query, write, service } = setup();
    query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ id: 'existing' }] });
    expect(await service.upload('product', await input(), 'actor')).toEqual({ id: 'existing' });
    expect(write).not.toHaveBeenCalled();
  });
  it('enforces the photo limit before spending provider quota', async () => {
    const { query, write, service } = setup();
    query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 8, next: 8 }] });
    await expect(service.upload('product', await input(), 'actor')).rejects.toThrow('Maximum 8');
    expect(write).not.toHaveBeenCalled();
  });
  it('never inserts an association after provider failure', async () => {
    const { query, write, service } = setup();
    query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 0, next: 0 }] });
    write.mockRejectedValue(new Error('storage unavailable'));
    await expect(service.upload('product', await input(), 'actor')).rejects.toThrow(
      'storage unavailable'
    );
    expect(query).toHaveBeenCalledTimes(3);
  });
  it('stores normalized bytes and only an opaque key, then audits the new association', async () => {
    const { query, write, service } = setup();
    query
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: 0, next: 0 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'new-image' }] })
      .mockResolvedValueOnce({ rows: [] });
    expect(await service.upload('product', await input(), 'actor')).toEqual({ id: 'new-image' });
    expect(write).toHaveBeenCalledWith(
      expect.stringMatching(/^cloudinary:[a-f0-9]{64}\.webp$/),
      expect.any(Buffer)
    );
    expect((await sharp(write.mock.calls[0]![1]).metadata()).format).toBe('webp');
    expect(query).toHaveBeenNthCalledWith(4, expect.stringContaining('INSERT INTO product_media'), [
      'product',
      write.mock.calls[0]![0],
      'Photo',
      0
    ]);
    expect(query).toHaveBeenNthCalledWith(5, expect.stringContaining('product.image_added'), [
      'actor',
      'product'
    ]);
  });
});
