import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { AdjustStockDto } from './inventory.dto.js';
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
    return this.database.transaction(async (client) => {
      const result = await client.query<{ stock_quantity: number }>(
        'UPDATE product_variants SET stock_quantity=stock_quantity+$2,updated_at=now() WHERE id=$1 AND stock_quantity+$2>=0 RETURNING stock_quantity',
        [input.variantId, input.quantity]
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException('Variante introuvable ou stock insuffisant');
      await client.query(
        `INSERT INTO stock_movements(variant_id,quantity_delta,reason,note,actor_user_id) VALUES ($1,$2,'manual_adjustment',$3,$4)`,
        [input.variantId, input.quantity, input.note.trim(), actorId]
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
}
