// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { GET } from './[slug]/route';
const fs = vi.hoisted(() => ({ readFile: vi.fn(), realpath: vi.fn() }));
vi.mock('node:fs/promises', () => fs);
afterEach(() => vi.resetAllMocks());
describe('local photo endpoint', () => {
  it('rejects path traversal before reading files', async () => {
    const response = await GET(new Request('http://localhost/local-images/test'), {
      params: Promise.resolve({ slug: '../.env' })
    });
    expect(response.status).toBe(404);
    expect(fs.readFile).not.toHaveBeenCalled();
  });
  it('serves a JFIF photo and uses the correct MIME type', async () => {
    const root = path.resolve('public');
    fs.realpath.mockImplementation((file: string) =>
      file.endsWith('.jpg') || file.endsWith('.jpeg')
        ? Promise.reject(new Error('Missing'))
        : Promise.resolve(file.includes('products') ? file : root)
    );
    fs.readFile.mockResolvedValue(new Uint8Array([255, 216, 255]));
    const response = await GET(new Request('http://localhost/local-images/phone'), {
      params: Promise.resolve({ slug: 'phone' })
    });
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(fs.readFile).toHaveBeenCalledWith(path.join(root, 'products', 'phone.jfif'));
  });
  it('falls back to the logo when no photo exists', async () => {
    const root = path.resolve('public');
    fs.realpath.mockResolvedValueOnce(root).mockRejectedValue(new Error('Missing'));
    fs.readFile.mockResolvedValue(new Uint8Array([137, 80, 78, 71]));
    const response = await GET(new Request('http://localhost/local-images/phone'), {
      params: Promise.resolve({ slug: 'phone' })
    });
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(fs.readFile).toHaveBeenCalledWith(path.join(root, 'logo/logo-enhanced.png'));
  });
});
