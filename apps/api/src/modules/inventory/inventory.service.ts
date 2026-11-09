import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { AdjustStockDto, StockHistoryQueryDto } from './inventory.dto.js';
import { reportDates } from '../orders/reporting.service.js';
@Injectable()
export class InventoryService {
  constructor(private readonly database: DatabaseService) {}
  async list() {
    const result = await this.database.query(
      `SELECT v.id AS "variantId", p.id AS "productId", p.name || CASE WHEN v.name='Standard' THEN '' ELSE ' — ' || v.name END AS "productName", v.sku, v.stock_quantity AS "stockQuantity", v.low_stock_threshold AS "lowStockThreshold", (v.stock_quantity <= v.low_stock_threshold) AS "isLow" FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.is_active=true ORDER BY "isLow" DESC, p.name`
    );
    return result.rows;
  }
  async adjust(input: AdjustStockDto, actorId: string) {
    if (input.quantity === 0) throw new BadRequestException('La correction ne peut pas être zéro');
    if (!input.note.trim()) throw new BadRequestException('Indiquez la raison du changement');
    return this.database.transaction(async (client) => {
      if (input.requestKey) {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          input.requestKey
        ]);
        const prior = (
          await client.query<{
            variant_id: string;
            quantity_delta: number;
            note: string;
            actor_user_id: string;
            current_stock: number;
          }>(
            'SELECT m.variant_id,m.quantity_delta,m.note,m.actor_user_id,v.stock_quantity AS current_stock FROM stock_movements m JOIN product_variants v ON v.id=m.variant_id WHERE m.request_key=$1',
            [input.requestKey]
          )
        ).rows[0];
        if (prior) {
          if (
            prior.variant_id !== input.variantId ||
            prior.quantity_delta !== input.quantity ||
            prior.note !== input.note.trim() ||
            prior.actor_user_id !== actorId
          )
            throw new ConflictException('Cette clé de modification a déjà été utilisée');
          // A later order may have consumed stock since the original adjustment.
          return { variantId: input.variantId, stockQuantity: prior.current_stock };
        }
      }
      const result = await client.query<{ stock_quantity: number }>(
        'UPDATE product_variants SET stock_quantity=stock_quantity+$2,updated_at=now() WHERE id=$1 AND is_active=true AND stock_quantity::bigint+$2 BETWEEN 0 AND 2147483647 RETURNING stock_quantity',
        [input.variantId, input.quantity]
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException('Variante introuvable ou stock insuffisant');
      await client.query(
        `INSERT INTO stock_movements(variant_id,quantity_delta,reason,note,actor_user_id,request_key) VALUES ($1,$2,'manual_adjustment',$3,$4,$5)`,
        [input.variantId, input.quantity, input.note.trim(), actorId, input.requestKey ?? null]
      );
      await client.query(
        `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES ($1,'stock.adjusted','variant',$2,jsonb_build_object('quantityDelta',$3::integer,'before',$4::integer,'after',$5::integer))`,
        [
          actorId,
          input.variantId,
          input.quantity,
          row.stock_quantity - input.quantity,
          row.stock_quantity
        ]
      );
      return { variantId: input.variantId, stockQuantity: row.stock_quantity };
    });
  }
  async history(query: StockHistoryQueryDto) {
    reportDates(query.from, query.to);
    return (
      await this.database.query(
        `SELECT m.id,m.created_at AS "createdAt",p.name AS "productName",v.name AS "variantName",v.sku,
        m.quantity_delta AS "quantityDelta",m.stock_before AS "stockBefore",m.stock_after AS "stockAfter",
        m.reason,m.note,u.email AS actor,o.reference AS "orderReference"
       FROM stock_movements m JOIN product_variants v ON v.id=m.variant_id JOIN products p ON p.id=v.product_id
       LEFT JOIN admin_users u ON u.id=m.actor_user_id LEFT JOIN orders o ON o.id=m.order_id
       WHERE ($1::text IS NULL OR p.name ILIKE '%'||$1||'%' OR v.sku ILIKE '%'||$1||'%')
       AND ($2='all' OR ($2='add' AND m.quantity_delta>0) OR ($2='remove' AND m.quantity_delta<0))
       AND ($3::date IS NULL OR m.created_at >= ($3::date::timestamp AT TIME ZONE 'Africa/Tunis'))
       AND ($4::date IS NULL OR m.created_at < (($4::date+1)::timestamp AT TIME ZONE 'Africa/Tunis'))
       ORDER BY m.created_at DESC,m.id DESC LIMIT 50 OFFSET $5`,
        [
          query.q?.trim() || null,
          query.direction ?? 'all',
          query.from ?? null,
          query.to ?? null,
          query.offset
        ]
      )
    ).rows;
  }
}
