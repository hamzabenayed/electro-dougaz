import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProductMediaStorage } from '../src/modules/catalog/media-storage.js';

const env = {
  MEDIA_DRIVER: 'cloudinary',
  CLOUDINARY_URL: 'cloudinary://test-key:test-secret@test-cloud'
};
const bytes = Buffer.from('normalized image fixture');
const hash = createHash('sha256').update(bytes).digest('hex');
const key = `cloudinary:${hash}.webp`;
const publicId = `electro-dougaz/products/${hash}`;
const uploaded = { public_id: publicId, type: 'authenticated', format: 'webp' };
const imageResponse = () => new Response(bytes, { headers: { 'Content-Type': 'image/webp' } });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Media storage configuration', () => {
  it('defaults to local, and uses distinct deterministic remote keys', () => {
    expect(new ProductMediaStorage({}).keyFor(bytes)).toBe(`${hash}.webp`);
    expect(new ProductMediaStorage(env).keyFor(bytes)).toBe(key);
  });
  it('fails closed for unknown drivers and missing credentials', () => {
    expect(() => new ProductMediaStorage({ MEDIA_DRIVER: 'typo' })).toThrow('MEDIA_DRIVER');
    expect(() => new ProductMediaStorage({ MEDIA_DRIVER: 'cloudinary' })).toThrow('CLOUDINARY_URL');
  });
  it.each([
    'not-a-url-secret',
    'https://key:secret@cloud',
    'cloudinary://key@cloud',
    'cloudinary://key:secret@cloud/extra',
    'cloudinary://key:secret@cloud?api_url=evil',
    'cloudinary://key:secret@cloud.example'
  ])('rejects malformed configuration without echoing credentials (%#)', (value) => {
    expect(() => new ProductMediaStorage({ ...env, CLOUDINARY_URL: value })).toThrow(
      /^CLOUDINARY_URL must contain valid Cloudinary credentials$/
    );
  });
});

describe('Local storage compatibility', () => {
  it('persists across instances, deduplicates writes, and reads old local keys with cloud driver', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'electro-storage-test-'));
    try {
      const local = new ProductMediaStorage({ MEDIA_ROOT: directory });
      const localKey = local.keyFor(bytes);
      await local.write(localKey, bytes);
      await local.write(localKey, Buffer.from('must not overwrite'));
      expect(
        await new ProductMediaStorage({ ...env, MEDIA_ROOT: directory }).read(localKey)
      ).toEqual(bytes);
      await expect(local.read(`${'a'.repeat(64)}.webp`)).rejects.toThrow('Image introuvable');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  it.each(['../.env', 'https://example.com/x.webp', 'cloudinary:../../.env', 'x.webp'])(
    'rejects untrusted keys before network/file access: %s',
    async (value) => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const storage = new ProductMediaStorage(env);
      await expect(storage.read(value)).rejects.toThrow('Image introuvable');
      await expect(storage.write(value, bytes)).rejects.toThrow('Image introuvable');
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );
});

describe('Cloudinary adapter (mocked HTTP, no account required)', () => {
  it('signs normalized uploads as authenticated, deterministic and non-overwriting', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(uploaded));
    vi.stubGlobal('fetch', request);
    await new ProductMediaStorage(env).write(key, bytes);
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe('https://api.cloudinary.com/v1_1/test-cloud/image/upload');
    expect(options?.redirect).toBe('error');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    const form = options?.body as FormData;
    expect(form.get('type')).toBe('authenticated');
    expect(form.get('overwrite')).toBe('false');
    expect(form.get('signature')).toBe(
      createHash('sha256')
        .update(
          `overwrite=false&public_id=${publicId}&timestamp=1800000000&type=authenticatedtest-secret`
        )
        .digest('hex')
    );
    expect(form.get('api_key')).toBe('test-key');
    expect(form.has('api_secret')).toBe(false);
    expect(Buffer.from(await (form.get('file') as Blob).arrayBuffer())).toEqual(bytes);
  });
  it('reads via a signed short-lived server-side URL after a new instance starts', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const request = vi.fn<typeof fetch>().mockResolvedValue(imageResponse());
    vi.stubGlobal('fetch', request);
    expect(await new ProductMediaStorage(env).read(key)).toEqual(bytes);
    const target = request.mock.calls[0]![0];
    if (typeof target !== 'string') throw new Error('Expected a URL string');
    const url = new URL(target);
    expect(url.origin).toBe('https://api.cloudinary.com');
    expect(url.pathname).toBe('/v1_1/test-cloud/image/download');
    expect(url.searchParams.get('type')).toBe('authenticated');
    expect(url.searchParams.get('expires_at')).toBe('1800000060');
    expect(url.searchParams.get('signature')).toBe(
      createHash('sha256')
        .update(
          `expires_at=1800000060&format=webp&public_id=${publicId}&timestamp=1800000000&type=authenticatedtest-secret`
        )
        .digest('hex')
    );
    expect(url.href).not.toContain('test-secret');
  });
  it.each([401, 429, 500])('sanitizes upload failures (%s)', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('SECRET provider error', { status }))
    );
    await expect(new ProductMediaStorage(env).write(key, bytes)).rejects.toThrow(
      /^Envoi de la photo indisponible\. Veuillez réessayer\.$/
    );
  });
  it.each([
    { ...uploaded, type: 'upload' },
    { ...uploaded, public_id: 'unexpected' },
    { ...uploaded, format: 'svg' }
  ])('rejects mismatched upload responses (%#)', async (result) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(result)));
    await expect(new ProductMediaStorage(env).write(key, bytes)).rejects.toThrow(
      'Envoi de la photo indisponible'
    );
  });
  it('does not fall back to local storage when cloud credentials are absent', async () => {
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(new ProductMediaStorage({}).read(key)).rejects.toThrow(
      'Stockage des images indisponible'
    );
    expect(request).not.toHaveBeenCalled();
  });
  it('maps missing remote images to 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(new ProductMediaStorage(env).read(key)).rejects.toMatchObject({ status: 404 });
  });
  it('sanitizes network/timeout errors on upload and download', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('SECRET request URL')));
    const storage = new ProductMediaStorage(env);
    await expect(storage.write(key, bytes)).rejects.toThrow(
      /^Envoi de la photo indisponible\. Veuillez réessayer\.$/
    );
    await expect(storage.read(key)).rejects.toThrow(
      /^Chargement de la photo indisponible\. Veuillez réessayer\.$/
    );
  });
  it.each(['text/html', 'application/json'])('rejects non-image responses: %s', async (type) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('SECRET', { headers: { 'Content-Type': type } }))
    );
    await expect(new ProductMediaStorage(env).read(key)).rejects.toThrow(
      'Chargement de la photo indisponible'
    );
  });
  it('bounds download memory and rejects empty files', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(Buffer.alloc(5 * 1024 * 1024 + 1), {
          headers: { 'Content-Type': 'image/webp' }
        })
      )
      .mockResolvedValueOnce(new Response('', { headers: { 'Content-Type': 'image/webp' } }));
    vi.stubGlobal('fetch', request);
    const storage = new ProductMediaStorage(env);
    await expect(storage.read(key)).rejects.toThrow('Chargement de la photo indisponible');
    await expect(storage.read(key)).rejects.toThrow('Chargement de la photo indisponible');
  });
});
