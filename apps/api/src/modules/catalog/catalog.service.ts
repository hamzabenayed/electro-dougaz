import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { PoolClient } from 'pg';
import type {
  CatalogQueryDto,
  CreateCategoryDto,
  CreateProductDto,
  UpdateProductDto
} from './catalog.dto.js';

interface ProductRow {
  promotion_starts_at: Date | null;
  promotion_ends_at: Date | null;
  specifications: Array<{ label: string; value: string }>;
  warranty: string;
  variants: Array<{
    id: string;
    name: string;
    sku: string;
    priceMillimes: number;
    compareAtPriceMillimes: number | null;
    stockQuantity: number;
    lowStockThreshold: number;
  }>;
  images: Array<{ id: string; alt: string }>;
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  variant_id: string;
  sku: string;
  variant_name: string;
  price_millimes: number;
  compare_at_price_millimes: number | null;
  stock_quantity: number;
  low_stock_threshold: number;
}
const mapProduct = (row: ProductRow) => ({
  promotionStartsAt: row.promotion_starts_at,
  promotionEndsAt: row.promotion_ends_at,
  specifications: row.specifications,
  warranty: row.warranty,
  variants: row.variants,
  images: row.images,
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description,
  status: row.status,
  category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
  variant: {
    id: row.variant_id,
    sku: row.sku,
    name: row.variant_name,
    priceMillimes: row.price_millimes,
    compareAtPriceMillimes: row.compare_at_price_millimes,
    stockQuantity: row.stock_quantity,
    lowStockThreshold: row.low_stock_threshold
  }
});
const productSelect = `SELECT p.id, p.name, p.slug, p.description, p.status, p.specifications, p.warranty,p.promotion_starts_at,p.promotion_ends_at,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'alt',m.alt_text) ORDER BY m.sort_order,m.created_at,m.id) FROM product_media m WHERE m.product_id=p.id),'[]') AS images,
  (SELECT jsonb_agg(jsonb_build_object('id',a.id,'sku',a.sku,'name',a.name,'priceMillimes',a.price_millimes,'compareAtPriceMillimes',a.compare_at_price_millimes,'stockQuantity',a.stock_quantity,'lowStockThreshold',a.low_stock_threshold) ORDER BY a.sort_order,a.created_at,a.id) FROM product_variants a WHERE a.product_id=p.id AND a.is_active=true) AS variants,
  c.id AS category_id, c.name AS category_name, c.slug AS category_slug, v.id AS variant_id, v.sku, v.name AS variant_name, v.price_millimes, v.compare_at_price_millimes, v.stock_quantity, v.low_stock_threshold FROM products p JOIN categories c ON c.id = p.category_id JOIN LATERAL (SELECT * FROM product_variants WHERE product_id=p.id AND is_active=true ORDER BY sort_order,created_at,id LIMIT 1) v ON true`;

@Injectable()
export class CatalogService {
  constructor(private readonly database: DatabaseService) {}
  async accessories(id: string) {
    return (
      await this.database.query(
        'SELECT p.id,p.name FROM product_accessories a JOIN products p ON p.id=a.accessory_id WHERE a.product_id=$1 ORDER BY p.name',
        [id]
      )
    ).rows;
  }
  async saveAccessories(id: string, ids: string[], actor: string) {
    if (ids.includes(id) || new Set(ids).size !== ids.length)
      throw new BadRequestException('Sélection invalide');
    return this.database.transaction(async (client) => {
      if (!(await client.query('SELECT id FROM products WHERE id=$1 FOR UPDATE', [id])).rows.length)
        throw new NotFoundException('Produit introuvable');
      if (
        (await client.query('SELECT id FROM products WHERE id=ANY($1::uuid[])', [ids])).rows
          .length !== ids.length
      )
        throw new BadRequestException('Accessoire introuvable');
      const before = (
        await client.query('SELECT accessory_id FROM product_accessories WHERE product_id=$1', [id])
      ).rows;
      await client.query('DELETE FROM product_accessories WHERE product_id=$1', [id]);
      for (const accessory of ids)
        await client.query(
          'INSERT INTO product_accessories(product_id,accessory_id) VALUES($1,$2)',
          [id, accessory]
        );
      await client.query(
        `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'product.accessories_updated','product',$2,$3)`,
        [actor, id, JSON.stringify({ before, after: ids })]
      );
      return { id };
    });
  }
  async publicAccessories(slug: string) {
    const source = await this.publicProduct(slug);
    const result = await this.database.query<ProductRow>(
      this.publicPrices(
        `${productSelect} WHERE p.id IN(SELECT accessory_id FROM product_accessories WHERE product_id=$1) AND p.status='published' AND c.is_visible=true ORDER BY p.name LIMIT 8`
      ),
      [source.id]
    );
    return result.rows.map(mapProduct);
  }
  private publicPrices(sql: string) {
    return sql
      .replaceAll(
        'a.price_millimes',
        'effective_price(a.price_millimes,a.compare_at_price_millimes,p.promotion_starts_at,p.promotion_ends_at)'
      )
      .replaceAll(
        'v.price_millimes',
        'effective_price(v.price_millimes,v.compare_at_price_millimes,p.promotion_starts_at,p.promotion_ends_at)'
      )
      .replace(
        'effective_price(v.price_millimes,v.compare_at_price_millimes,p.promotion_starts_at,p.promotion_ends_at), v.compare_at_price_millimes',
        'effective_price(v.price_millimes,v.compare_at_price_millimes,p.promotion_starts_at,p.promotion_ends_at) AS price_millimes, v.compare_at_price_millimes'
      );
  }
  async schedule(
    id: string,
    starts: string | null | undefined,
    ends: string | null | undefined,
    actor: string
  ) {
    if (
      [starts, ends].some((d) => d != null && Number.isNaN(Date.parse(d))) ||
      (starts && ends && new Date(starts) >= new Date(ends))
    )
      throw new BadRequestException('Dates de promotion invalides');
    return this.database.transaction(async (client) => {
      const before = (
        await client.query<{ promotion_starts_at: Date | null; promotion_ends_at: Date | null }>(
          'SELECT promotion_starts_at,promotion_ends_at FROM products WHERE id=$1 FOR UPDATE',
          [id]
        )
      ).rows[0];
      if (!before) throw new NotFoundException('Produit introuvable');
      await client.query(
        'UPDATE products SET promotion_starts_at=$2,promotion_ends_at=$3,updated_at=now() WHERE id=$1',
        [id, starts ?? null, ends ?? null]
      );
      await client.query(
        `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'promotion.scheduled','product',$2,$3)`,
        [
          actor,
          id,
          JSON.stringify({ before, after: { startsAt: starts ?? null, endsAt: ends ?? null } })
        ]
      );
      return { id };
    });
  }
  async categories(includeHidden = false) {
    const result = await this.database.query(
      'SELECT id, name, slug, description, is_visible AS "isVisible", sort_order AS "sortOrder" FROM categories WHERE ($1::boolean OR is_visible = true) ORDER BY sort_order, name',
      [includeHidden]
    );
    return result.rows;
  }
  async createCategory(input: CreateCategoryDto) {
    try {
      return (
        await this.database.query(
          'INSERT INTO categories(name, slug, description, is_visible) VALUES ($1,$2,$3,$4) RETURNING id, name, slug, description, is_visible AS "isVisible"',
          [input.name.trim(), input.slug, input.description?.trim() ?? null, input.isVisible]
        )
      ).rows[0];
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new ConflictException('Ce slug de catégorie existe déjà');
      throw error;
    }
  }
  async publicProducts(query: CatalogQueryDto) {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException('Le prix minimum dépasse le maximum');
    const sort =
      {
        newest: 'p.created_at DESC,p.id',
        price_asc: 'v.price_millimes ASC,p.id',
        price_desc: 'v.price_millimes DESC,p.id'
      }[query.sort] ?? 'p.created_at DESC,p.id';
    const search = query.q?.trim() || null;
    const category = query.category ?? null;
    const filteredSelect = productSelect.replace(
      'WHERE product_id=p.id AND is_active=true ORDER BY sort_order,created_at,id LIMIT 1',
      'WHERE product_id=p.id AND is_active=true AND ($5::integer IS NULL OR effective_price(price_millimes,compare_at_price_millimes,p.promotion_starts_at,p.promotion_ends_at) >= $5) AND ($6::integer IS NULL OR effective_price(price_millimes,compare_at_price_millimes,p.promotion_starts_at,p.promotion_ends_at) <= $6) AND (NOT $7::boolean OR stock_quantity>0) AND (NOT $8::boolean OR (compare_at_price_millimes>price_millimes AND promotion_active(p.promotion_starts_at,p.promotion_ends_at))) ORDER BY effective_price(price_millimes,compare_at_price_millimes,p.promotion_starts_at,p.promotion_ends_at),sort_order,id LIMIT 1'
    );
    const result = await this.database.query<ProductRow>(
      this.publicPrices(
        `${filteredSelect} WHERE p.status = 'published' AND c.is_visible = true AND ($1::text IS NULL OR c.slug = $1) AND ($2::text IS NULL OR p.name ILIKE '%' || $2 || '%' OR p.description ILIKE '%' || $2 || '%')
      AND EXISTS (SELECT 1 FROM product_variants f WHERE f.product_id=p.id AND f.is_active=true AND ($5::integer IS NULL OR f.price_millimes >= $5) AND ($6::integer IS NULL OR f.price_millimes <= $6) AND (NOT $7::boolean OR f.stock_quantity>0) AND (NOT $8::boolean OR f.compare_at_price_millimes>f.price_millimes))
      ORDER BY ${sort} LIMIT $3 OFFSET $4`
      ).replaceAll(
        'f.price_millimes',
        'effective_price(f.price_millimes,f.compare_at_price_millimes,p.promotion_starts_at,p.promotion_ends_at)'
      ),
      [
        category,
        search,
        query.limit,
        query.offset,
        query.minPrice ?? null,
        query.maxPrice ?? null,
        query.available === '1',
        query.promotion === '1'
      ]
    );
    return result.rows.map(mapProduct);
  }
  async adminProducts(query: CatalogQueryDto) {
    const search = query.q?.trim() || null;
    const result = await this.database.query<ProductRow>(
      `${productSelect} WHERE ($1::text IS NULL OR p.name ILIKE '%' || $1 || '%' OR v.sku ILIKE '%' || $1 || '%') ORDER BY p.updated_at DESC LIMIT $2 OFFSET $3`,
      [search, query.limit, query.offset]
    );
    return result.rows.map(mapProduct);
  }
  async adminProduct(id: string) {
    const result = await this.database.query<ProductRow>(`${productSelect} WHERE p.id=$1`, [id]);
    if (!result.rows[0]) throw new NotFoundException('Produit introuvable');
    return mapProduct(result.rows[0]);
  }
  async publicProduct(slug: string) {
    const result = await this.database.query<ProductRow>(
      this.publicPrices(
        `${productSelect} WHERE p.slug = $1 AND p.status = 'published' AND c.is_visible = true`
      ),
      [slug]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Produit introuvable');
    return mapProduct(row);
  }
  async createProduct(input: CreateProductDto, actorId: string) {
    this.validateProduct(input);
    try {
      return await this.database.transaction(async (client) => {
        const product = (
          await client.query<{ id: string }>(
            'INSERT INTO products(category_id,name,slug,description,status) VALUES ($1,$2,$3,$4,$5) RETURNING id',
            [
              input.categoryId,
              input.name.trim(),
              input.slug,
              input.description.trim(),
              input.status
            ]
          )
        ).rows[0]!;
        await client.query(
          'INSERT INTO product_variants(product_id,sku,name,price_millimes,compare_at_price_millimes,stock_quantity,low_stock_threshold) VALUES ($1,$2,$3,$4,$5,$6,$7)',
          [
            product.id,
            input.sku.trim().toUpperCase(),
            input.variantName.trim(),
            input.priceMillimes,
            input.compareAtPriceMillimes ?? null,
            input.stockQuantity,
            input.lowStockThreshold
          ]
        );
        await client.query(
          `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id) VALUES ($1,'product.created','product',$2)`,
          [actorId, product.id]
        );
        await this.saveDetails(client, product.id, input);
        const variants = await client.query<{ id: string; sku: string }>(
          'SELECT id,sku FROM product_variants WHERE product_id=$1 AND is_active=true',
          [product.id]
        );
        return { id: product.id, variantIds: variants.rows };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new ConflictException('Le slug ou la référence existe déjà');
      this.databaseError(error);
    }
  }
  private databaseError(error: unknown): never {
    const code = (error as { code?: string }).code;
    if (code === '23505') throw new ConflictException('Le slug ou la référence existe déjà');
    if (code === '23503') throw new BadRequestException('Catégorie introuvable');
    throw error;
  }
  private validateProduct(input: CreateProductDto) {
    const variants = input.additionalVariants ?? [];
    const skus = [input.sku, ...variants.map((v) => v.sku)].map((s) => s.trim().toUpperCase());
    if (new Set(skus).size !== skus.length || skus.some((s) => !s))
      throw new BadRequestException('Chaque option doit avoir une référence unique');
    for (const variant of variants) {
      if (
        !variant.name.trim() ||
        (variant.compareAtPriceMillimes != null &&
          variant.compareAtPriceMillimes <= variant.priceMillimes)
      )
        throw new BadRequestException('Option ou promotion invalide');
    }
    if (
      input.compareAtPriceMillimes !== undefined &&
      input.compareAtPriceMillimes !== null &&
      input.compareAtPriceMillimes <= input.priceMillimes
    )
      throw new BadRequestException(
        'Le prix avant promotion doit être strictement supérieur au prix promotionnel'
      );
  }
  async updateProduct(id: string, input: UpdateProductDto, actorId: string) {
    this.validateProduct(input);
    try {
      const found = await this.database.transaction(async (client) => {
        await client.query('SELECT id FROM products WHERE id=$1 FOR UPDATE', [id]);
        const before = (
          await client.query(
            'SELECT id,sku,price_millimes,compare_at_price_millimes,stock_quantity,is_active FROM product_variants WHERE product_id=$1 ORDER BY id',
            [id]
          )
        ).rows;
        const product = await client.query(
          'UPDATE products SET category_id=$2,name=$3,slug=$4,description=$5,status=$6,updated_at=now() WHERE id=$1 RETURNING id',
          [
            id,
            input.categoryId,
            input.name.trim(),
            input.slug,
            input.description.trim(),
            input.status
          ]
        );
        if (!product.rowCount) return false;
        await client.query(
          'UPDATE product_variants SET sku=$2,name=$3,price_millimes=$4,compare_at_price_millimes=$5,stock_quantity=$6,low_stock_threshold=$7,updated_at=now() WHERE id=(SELECT id FROM product_variants WHERE product_id=$1 AND is_active=true ORDER BY sort_order,created_at,id LIMIT 1)',
          [
            id,
            input.sku.trim().toUpperCase(),
            input.variantName.trim(),
            input.priceMillimes,
            input.compareAtPriceMillimes ?? null,
            input.stockQuantity,
            input.lowStockThreshold
          ]
        );
        await this.saveDetails(client, id, input);
        await client.query(
          `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES ($1,'product.updated','product',$2,$3)`,
          [
            actorId,
            id,
            JSON.stringify({
              before,
              after: (
                await client.query(
                  'SELECT id,sku,price_millimes,compare_at_price_millimes,stock_quantity,is_active FROM product_variants WHERE product_id=$1 ORDER BY id',
                  [id]
                )
              ).rows
            })
          ]
        );
        return true;
      });
      if (!found) throw new NotFoundException('Produit introuvable');
      const variants = await this.database.query<{ id: string; sku: string }>(
        'SELECT id,sku FROM product_variants WHERE product_id=$1 AND is_active=true',
        [id]
      );
      return { id, variantIds: variants.rows };
    } catch (error) {
      this.databaseError(error);
    }
  }
  private async saveDetails(client: PoolClient, id: string, input: CreateProductDto) {
    await client.query('UPDATE products SET specifications=$2::jsonb,warranty=$3 WHERE id=$1', [
      id,
      JSON.stringify(input.specifications),
      input.warranty
    ]);
    if (!input.additionalVariants) return;
    const primary = (
      await client.query<{ id: string }>(
        'SELECT id FROM product_variants WHERE product_id=$1 AND is_active=true ORDER BY sort_order,created_at,id LIMIT 1 FOR UPDATE',
        [id]
      )
    ).rows[0]!;
    const keep = [primary.id];
    for (const [index, variant] of input.additionalVariants.entries()) {
      if (variant.id === primary.id || (variant.id && keep.includes(variant.id)))
        throw new BadRequestException('Option dupliquée');
      const values = [
        id,
        variant.sku.trim().toUpperCase(),
        variant.name.trim(),
        variant.priceMillimes,
        variant.compareAtPriceMillimes ?? null,
        variant.stockQuantity,
        variant.lowStockThreshold,
        index + 1
      ];
      const saved = variant.id
        ? await client.query<{ id: string }>(
            'UPDATE product_variants SET sku=$2,name=$3,price_millimes=$4,compare_at_price_millimes=$5,stock_quantity=$6,low_stock_threshold=$7,sort_order=$8,updated_at=now() WHERE product_id=$1 AND id=$9 AND is_active=true RETURNING id',
            [...values, variant.id]
          )
        : await client.query<{ id: string }>(
            'INSERT INTO product_variants(product_id,sku,name,price_millimes,compare_at_price_millimes,stock_quantity,low_stock_threshold,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
            values
          );
      if (!saved.rows[0]) throw new BadRequestException('Option introuvable pour ce produit');
      keep.push(saved.rows[0].id);
    }
    await client.query(
      'UPDATE product_variants SET is_active=false WHERE product_id=$1 AND NOT(id=ANY($2::uuid[]))',
      [id, keep]
    );
  }
}
