import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { DatabaseService } from '../../database/database.service.js';
import type { ProductImageDto } from './catalog.dto.js';

export async function normalizeProductImage(data: string): Promise<Buffer> {
  const source = Buffer.from(data, 'base64');
  if (!source.length || source.length > 5 * 1024 * 1024)
    throw new BadRequestException('Photo limitée à 5 Mo');
  try {
    const decoder = sharp(source, { limitInputPixels: 25_000_000, failOn: 'warning' });
    const metadata = await decoder.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages ?? 1) > 1)
      throw new Error('Unsupported image');
    return await decoder
      .rotate()
      .resize(1800, 1800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new BadRequestException('Photo invalide : utilisez JPG, JFIF, PNG ou WebP non animé');
  }
}

@Injectable()
export class MediaService {
  private readonly directory = resolve(
    process.env.MEDIA_DIRECTORY || process.env.MEDIA_ROOT || 'uploads/products'
  );
  constructor(private readonly database: DatabaseService) {}
  async upload(productId: string, input: ProductImageDto, actorId: string) {
    const bytes = await normalizeProductImage(input.data);
    const key = `${createHash('sha256').update(bytes).digest('hex')}.webp`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(resolve(this.directory, key), bytes, { flag: 'wx' }).catch((error: unknown) => {
      if ((error as { code?: string }).code !== 'EEXIST') throw error;
    });
    return await this.database.transaction(async (client) => {
      const product = await client.query('SELECT id FROM products WHERE id=$1 FOR UPDATE', [
        productId
      ]);
      if (!product.rowCount) throw new NotFoundException('Produit introuvable');
      const existing = await client.query<{ id: string }>(
        'SELECT id FROM product_media WHERE product_id=$1 AND object_key=$2',
        [productId, key]
      );
      if (existing.rows[0]) return existing.rows[0];
      const count = await client.query<{ count: number; next: number }>(
        'SELECT count(*)::integer AS count,COALESCE(max(sort_order),-1)+1 AS next FROM product_media WHERE product_id=$1',
        [productId]
      );
      if (count.rows[0]!.count >= 8) throw new BadRequestException('Maximum 8 photos par produit');
      const saved = await client.query<{ id: string }>(
        'INSERT INTO product_media(product_id,object_key,alt_text,sort_order) VALUES ($1,$2,$3,$4) RETURNING id',
        [productId, key, input.alt, count.rows[0]!.next]
      );
      await client.query(
        "INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id) VALUES ($1,'product.image_added','product',$2)",
        [actorId, productId]
      );
      return saved.rows[0]!;
    });
  }
  async read(id: string, admin = false) {
    const result = await this.database.query<{ object_key: string }>(
      `SELECT m.object_key FROM product_media m JOIN products p ON p.id=m.product_id JOIN categories c ON c.id=p.category_id WHERE m.id=$1 AND ($2::boolean OR (p.status='published' AND c.is_visible=true))`,
      [id, admin]
    );
    const key = result.rows[0]?.object_key;
    if (!key || !/^[a-f0-9]{64}\.webp$/.test(key)) throw new NotFoundException('Image introuvable');
    try {
      return await readFile(resolve(this.directory, key));
    } catch {
      throw new NotFoundException('Image introuvable');
    }
  }
  async remove(productId: string, id: string, actorId: string) {
    // Keep the file for recoverability; only unlink its catalogue association.
    await this.database.transaction(async (client) => {
      const product = await client.query('SELECT id FROM products WHERE id=$1 FOR UPDATE', [
        productId
      ]);
      if (!product.rowCount) throw new NotFoundException('Produit introuvable');
      const result = await client.query(
        'DELETE FROM product_media WHERE product_id=$1 AND id=$2 RETURNING id',
        [productId, id]
      );
      if (!result.rowCount) return;
      await client.query(
        "INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id) VALUES ($1,'product.image_removed','product',$2)",
        [actorId, productId]
      );
    });
    return { id };
  }
}
