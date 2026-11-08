import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { normalizeProductImage } from '../src/modules/catalog/media.service.js';
describe('Product upload validation', () => {
  it.each(['jpeg', 'png', 'webp'] as const)(
    'decodes %s and stores bounded WebP without metadata',
    async (format) => {
      const source = await sharp({
        create: { width: 30, height: 20, channels: 3, background: 'red' }
      })
        .toFormat(format)
        .toBuffer();
      const output = await normalizeProductImage(source.toString('base64'));
      const metadata = await sharp(output).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.width).toBe(30);
      expect(metadata.exif).toBeUndefined();
    }
  );
  it('rejects disguised text and SVG files', async () => {
    for (const text of [
      'not a jpeg',
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'
    ])
      await expect(normalizeProductImage(Buffer.from(text).toString('base64'))).rejects.toThrow(
        'Photo invalide'
      );
  });
  it('rejects oversized uploads before decoding', async () => {
    await expect(
      normalizeProductImage(Buffer.alloc(5 * 1024 * 1024 + 1).toString('base64'))
    ).rejects.toThrow('5 Mo');
  });
});
