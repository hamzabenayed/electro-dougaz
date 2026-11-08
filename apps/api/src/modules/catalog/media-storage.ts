import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const FILE_KEY = /^[a-f0-9]{64}\.webp$/;
const CLOUD_PREFIX = 'cloudinary:';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

type CloudCredentials = { cloud: string; apiKey: string; secret: string };

/** Fixed provider endpoints and opaque keys: never fetch a URL supplied by a customer or the DB. */
export class ProductMediaStorage {
  private readonly driver: 'local' | 'cloudinary';
  private readonly directory: string;
  private readonly cloud?: CloudCredentials;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    const driver = env.MEDIA_DRIVER || 'local';
    if (driver !== 'local' && driver !== 'cloudinary') {
      throw new Error('MEDIA_DRIVER must be local or cloudinary');
    }
    this.driver = driver;
    this.directory = resolve(env.MEDIA_DIRECTORY || env.MEDIA_ROOT || 'uploads/products');
    if (env.CLOUDINARY_URL) {
      try {
        const url = new URL(env.CLOUDINARY_URL);
        const apiKey = decodeURIComponent(url.username);
        const secret = decodeURIComponent(url.password);
        if (
          url.protocol !== 'cloudinary:' ||
          !/^[a-z0-9_-]+$/.test(url.hostname) ||
          !apiKey ||
          !secret ||
          url.port ||
          url.search ||
          url.hash ||
          (url.pathname && url.pathname !== '/')
        )
          throw new Error();
        this.cloud = { cloud: url.hostname, apiKey, secret };
      } catch {
        // Never include the URL or original parser error: both can contain credentials.
        throw new Error('CLOUDINARY_URL must contain valid Cloudinary credentials');
      }
    }
    if (driver === 'cloudinary' && !this.cloud) {
      throw new Error('CLOUDINARY_URL is required when MEDIA_DRIVER=cloudinary');
    }
  }

  keyFor(bytes: Buffer): string {
    const filename = `${createHash('sha256').update(bytes).digest('hex')}.webp`;
    return this.driver === 'cloudinary' ? `${CLOUD_PREFIX}${filename}` : filename;
  }

  private parseKey(key: string): { remote: boolean; filename: string } {
    const remote = key.startsWith(CLOUD_PREFIX);
    const filename = remote ? key.slice(CLOUD_PREFIX.length) : key;
    if (!FILE_KEY.test(filename)) throw new NotFoundException('Image introuvable');
    return { remote, filename };
  }

  private credentials(): CloudCredentials {
    if (!this.cloud) throw new ServiceUnavailableException('Stockage des images indisponible');
    return this.cloud;
  }

  private signedParameters(parameters: Record<string, string>): URLSearchParams {
    const { secret, apiKey } = this.credentials();
    const canonical = Object.keys(parameters)
      .sort()
      .map((key) => `${key}=${parameters[key]}`)
      .join('&');
    const signature = createHash('sha256')
      .update(canonical + secret)
      .digest('hex');
    return new URLSearchParams({ ...parameters, api_key: apiKey, signature });
  }

  private endpoint(action: 'upload' | 'download'): string {
    return `https://api.cloudinary.com/v1_1/${this.credentials().cloud}/image/${action}`;
  }

  private publicId(filename: string): string {
    return `electro-dougaz/products/${filename.slice(0, -5)}`;
  }

  async write(key: string, bytes: Buffer): Promise<void> {
    const { remote, filename } = this.parseKey(key);
    if (!remote) {
      await mkdir(this.directory, { recursive: true });
      await writeFile(resolve(this.directory, filename), bytes, { flag: 'wx' }).catch(
        (error: unknown) => {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
      );
      return;
    }
    const publicId = this.publicId(filename);
    const parameters = this.signedParameters({
      public_id: publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: 'authenticated',
      overwrite: 'false'
    });
    const form = new FormData();
    parameters.forEach((value, name) => form.append(name, value));
    form.append('file', new Blob([new Uint8Array(bytes)], { type: 'image/webp' }), filename);
    try {
      const response = await fetch(this.endpoint('upload'), {
        method: 'POST',
        body: form,
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!response.ok) throw new Error();
      const result = (await response.json()) as {
        public_id?: string;
        type?: string;
        format?: string;
      };
      if (
        result.public_id !== publicId ||
        result.type !== 'authenticated' ||
        result.format !== 'webp'
      ) {
        throw new Error();
      }
    } catch {
      // Provider responses/errors may contain credentials or signed URLs; do not log/return them.
      throw new ServiceUnavailableException('Envoi de la photo indisponible. Veuillez réessayer.');
    }
  }

  async read(key: string): Promise<Buffer> {
    const { remote, filename } = this.parseKey(key);
    if (!remote) {
      try {
        return await readFile(resolve(this.directory, filename));
      } catch {
        throw new NotFoundException('Image introuvable');
      }
    }
    const now = Math.floor(Date.now() / 1000);
    const parameters = this.signedParameters({
      public_id: this.publicId(filename),
      format: 'webp',
      type: 'authenticated',
      timestamp: String(now),
      expires_at: String(now + 60)
    });
    try {
      // This short-lived URL stays server-side. Visibility is checked by MediaService first.
      const response = await fetch(`${this.endpoint('download')}?${parameters}`, {
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (response.status === 404) throw new NotFoundException('Image introuvable');
      if (
        !response.ok ||
        !response.body ||
        response.headers.get('content-type')?.split(';')[0] !== 'image/webp'
      )
        throw new Error();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          length += chunk.value.byteLength;
          if (length > MAX_IMAGE_BYTES) throw new Error();
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel();
      }
      if (!length) throw new Error();
      return Buffer.concat(chunks, length);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new ServiceUnavailableException(
        'Chargement de la photo indisponible. Veuillez réessayer.'
      );
    }
  }
}
