import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  HttpException
} from '@nestjs/common';
import { SettingsService } from '../settings/settings.service.js';
import { normalizePhone } from './phone.js';
import { DatabaseService } from '../../database/database.service.js';
import type { CreateOrderDto, OrderQueryDto, TrackOrderDto, QuoteOrderDto } from './orders.dto.js';

interface VariantRow {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  price_millimes: number;
  stock_quantity: number;
}
interface OrderRow {
  id: string;
  reference: string;
  customer_first_name: string;
  customer_last_name: string;
  phone: string;
  governorate: string;
  address: string;
  status: string;
  payment_method: string;
  payment_status: string;
  subtotal_millimes: number;
  delivery_millimes: number;
  total_millimes: number;
  created_at: Date;
}
const mapOrder = (row: OrderRow) => ({
  id: row.id,
  reference: row.reference,
  customer: {
    firstName: row.customer_first_name,
    lastName: row.customer_last_name,
    phone: row.phone,
    governorate: row.governorate,
    address: row.address
  },
  status: row.status,
  paymentMethod: row.payment_method,
  paymentStatus: row.payment_status,
  subtotalMillimes: row.subtotal_millimes,
  deliveryMillimes: row.delivery_millimes,
  totalMillimes: row.total_millimes,
  createdAt: row.created_at
});
const allowed: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  awaiting_payment: ['confirmed', 'cancelled'],
  payment_failed: ['cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'delivery_failed'],
  delivery_failed: ['shipped', 'returned'],
  delivered: ['returned'],
  returned: [],
  cancelled: []
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService
  ) {}
  async options() {
    const { deliveryMillimes, deliveryEstimate } = await this.settings.publicSettings();
    return { deliveryMillimes, deliveryEstimate, paymentMethods: ['cash_on_delivery'] };
  }
  async quote(input: QuoteOrderDto) {
    const ids = input.items.map((item) => item.variantId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Option dupliquée');
    const result = await this.database.query<VariantRow>(
      `SELECT v.id,effective_price(v.price_millimes,v.compare_at_price_millimes,p.promotion_starts_at,p.promotion_ends_at) AS price_millimes,v.stock_quantity,p.name || ' — ' || v.name AS product_name FROM product_variants v JOIN products p ON p.id=v.product_id JOIN categories c ON c.id=p.category_id WHERE v.id=ANY($1::uuid[]) AND v.is_active=true AND p.status='published' AND c.is_visible=true`,
      [ids]
    );
    if (result.rows.length !== ids.length)
      throw new ConflictException('Un article est indisponible. Modifiez votre panier.');
    const items = input.items.map((item) => {
      const row = result.rows.find((v) => v.id === item.variantId)!;
      if (row.stock_quantity < item.quantity)
        throw new ConflictException(`Stock insuffisant pour ${row.product_name}`);
      return {
        variantId: row.id,
        name: row.product_name,
        quantity: item.quantity,
        unitPriceMillimes: row.price_millimes
      };
    });
    const subtotalMillimes = items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceMillimes,
      0
    );
    const { deliveryMillimes } = await this.settings.publicSettings();
    if (subtotalMillimes + deliveryMillimes > 2_147_483_647)
      throw new BadRequestException('Montant trop élevé');
    return {
      items,
      subtotalMillimes,
      deliveryMillimes,
      totalMillimes: subtotalMillimes + deliveryMillimes
    };
  }
  async create(input: CreateOrderDto, idempotencyKey: string) {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
        idempotencyKey
      )
    )
      throw new BadRequestException('En-tête Idempotency-Key UUID requis');
    if (input.paymentMethod !== 'cash_on_delivery')
      throw new BadRequestException('Paiement en ligne indisponible');
    const { deliveryMillimes } = await this.settings.publicSettings();
    return this.database.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [idempotencyKey]);
      const duplicate = await client.query<OrderRow>(
        'SELECT * FROM orders WHERE idempotency_key=$1',
        [idempotencyKey]
      );
      if (duplicate.rows[0]) {
        const previous = duplicate.rows[0];
        const previousItems = await client.query<{ variant_id: string; quantity: number }>(
          'SELECT variant_id,quantity FROM order_items WHERE order_id=$1',
          [previous.id]
        );
        if (
          normalizePhone(previous.phone) !== normalizePhone(input.phone) ||
          previous.customer_first_name !== input.firstName.trim() ||
          previous.customer_last_name !== input.lastName.trim() ||
          previous.governorate !== input.governorate.trim() ||
          previous.address !== input.address.trim() ||
          previous.payment_method !== input.paymentMethod ||
          previousItems.rows.length !== input.items.length ||
          input.items.some(
            (item) =>
              !previousItems.rows.some(
                (row) => row.variant_id === item.variantId && row.quantity === item.quantity
              )
          )
        ) {
          throw new ConflictException(
            'Cette tentative correspond à une autre commande. Rechargez le formulaire.'
          );
        }
        return mapOrder(previous);
      }
      const ids = input.items.map((item) => item.variantId);
      if (new Set(ids).size !== ids.length)
        throw new BadRequestException('Une variante ne peut apparaître qu’une fois');
      const variants = await client.query<VariantRow>(
        `SELECT v.id,v.product_id,p.name || CASE WHEN v.name='Standard' THEN '' ELSE ' — ' || v.name END AS product_name,v.sku,effective_price(v.price_millimes,v.compare_at_price_millimes,p.promotion_starts_at,p.promotion_ends_at) AS price_millimes,v.stock_quantity FROM product_variants v JOIN products p ON p.id=v.product_id JOIN categories c ON c.id=p.category_id WHERE c.is_visible=true AND v.id=ANY($1::uuid[]) AND v.is_active=true AND p.status='published' ORDER BY v.id FOR UPDATE OF v`,
        [ids]
      );
      if (variants.rows.length !== ids.length)
        throw new BadRequestException('Un ou plusieurs articles sont indisponibles');
      let subtotal = 0;
      for (const item of input.items) {
        const variant = variants.rows.find((row) => row.id === item.variantId)!;
        if (variant.stock_quantity < item.quantity)
          throw new ConflictException(`Stock insuffisant pour ${variant.product_name}`);
        subtotal += variant.price_millimes * item.quantity;
      }
      if (
        !Number.isSafeInteger(subtotal + deliveryMillimes) ||
        subtotal + deliveryMillimes > 2_147_483_647
      )
        throw new BadRequestException('Montant de commande trop élevé');
      if (
        input.expectedTotalMillimes !== undefined &&
        input.expectedTotalMillimes !== subtotal + deliveryMillimes
      )
        throw new ConflictException(
          'Le prix ou les frais ont changé. Actualisez le récapitulatif avant de confirmer.'
        );
      const reference = `ED-${new Date().getUTCFullYear()}-${randomBytes(12).toString('hex').toUpperCase()}`;
      const status = 'pending';
      const order = (
        await client.query<OrderRow>(
          `INSERT INTO orders(reference,customer_first_name,customer_last_name,phone,governorate,address,status,payment_method,subtotal_millimes,delivery_millimes,total_millimes,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
          [
            reference,
            input.firstName.trim(),
            input.lastName.trim(),
            normalizePhone(input.phone),
            input.governorate.trim(),
            input.address.trim(),
            status,
            input.paymentMethod,
            subtotal,
            deliveryMillimes,
            subtotal + deliveryMillimes,
            idempotencyKey
          ]
        )
      ).rows[0]!;
      for (const item of input.items) {
        const variant = variants.rows.find((row) => row.id === item.variantId)!;
        await client.query(
          'INSERT INTO order_items(order_id,product_id,variant_id,product_name,sku,unit_price_millimes,quantity,line_total_millimes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            order.id,
            variant.product_id,
            variant.id,
            variant.product_name,
            variant.sku,
            variant.price_millimes,
            item.quantity,
            variant.price_millimes * item.quantity
          ]
        );
        await client.query(
          'UPDATE product_variants SET stock_quantity=stock_quantity-$2,updated_at=now() WHERE id=$1',
          [variant.id, item.quantity]
        );
        await client.query(
          `INSERT INTO stock_movements(variant_id,order_id,quantity_delta,reason) VALUES ($1,$2,$3,'order_reserved')`,
          [variant.id, order.id, -item.quantity]
        );
      }
      await client.query('INSERT INTO order_status_history(order_id,to_status) VALUES ($1,$2)', [
        order.id,
        status
      ]);
      return mapOrder(order);
    });
  }
  async track(input: TrackOrderDto, ip?: string) {
    if (ip) {
      const key = createHash('sha256')
        .update(`track:${ip}:${Math.floor(Date.now() / 60000)}`)
        .digest('hex');
      await this.database.query('DELETE FROM public_rate_limits WHERE expires_at<now()');
      const limit = await this.database.query<{ hits: number }>(
        "INSERT INTO public_rate_limits(key,hits,expires_at) VALUES ($1,1,now()+interval '2 minutes') ON CONFLICT(key) DO UPDATE SET hits=public_rate_limits.hits+1 RETURNING hits",
        [key]
      );
      if (limit.rows[0]!.hits > 10)
        throw new HttpException('Trop de tentatives. Réessayez dans une minute.', 429);
    }
    const result = await this.database.query<OrderRow>(
      "SELECT * FROM orders WHERE upper(reference)=upper($1) AND regexp_replace(phone,'[[:space:]]','','g')=ANY($2::text[])",
      [
        input.reference.trim(),
        [
          normalizePhone(input.phone),
          ...['+216', '00216', '216'].map((prefix) => prefix + normalizePhone(input.phone))
        ]
      ]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Commande introuvable');
    const history = await this.database.query<{ status: string; at: Date }>(
      'SELECT to_status AS status,created_at AS at FROM order_status_history WHERE order_id=$1 ORDER BY created_at,id',
      [row.id]
    );
    return {
      reference: row.reference,
      status: row.status,
      paymentStatus: row.payment_status,
      createdAt: row.created_at,
      history: history.rows
    };
  }
  async list(query: OrderQueryDto) {
    const search = query.q?.trim() || null,
      status = query.status?.trim() || null;
    const result = await this.database.query<OrderRow>(
      `SELECT * FROM orders WHERE ($1::text IS NULL OR reference ILIKE '%'||$1||'%' OR customer_first_name ILIKE '%'||$1||'%' OR customer_last_name ILIKE '%'||$1||'%' OR phone ILIKE '%'||$1||'%') AND ($2::text IS NULL OR status=$2) ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [search, status, query.limit, query.offset]
    );
    return result.rows.map(mapOrder);
  }
  async detail(id: string) {
    const order = await this.database.query<OrderRow>('SELECT * FROM orders WHERE id=$1', [id]);
    const row = order.rows[0];
    if (!row) throw new NotFoundException('Commande introuvable');
    const items = await this.database.query(
      'SELECT id,product_name AS "productName",sku,unit_price_millimes AS "unitPriceMillimes",quantity,line_total_millimes AS "lineTotalMillimes" FROM order_items WHERE order_id=$1',
      [id]
    );
    const history = await this.database.query(
      'SELECT to_status AS status,created_at AS at FROM order_status_history WHERE order_id=$1 ORDER BY created_at,id',
      [id]
    );
    return { ...mapOrder(row), items: items.rows, history: history.rows };
  }
  async updateStatus(id: string, next: string, actorId: string) {
    return this.database.transaction(async (client) => {
      const result = await client.query<OrderRow>('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [
        id
      ]);
      const order = result.rows[0];
      if (!order) throw new NotFoundException('Commande introuvable');
      if (!(allowed[order.status] ?? []).includes(next))
        throw new ConflictException(`Transition ${order.status} vers ${next} interdite`);
      const updated = (
        await client.query<OrderRow>(
          'UPDATE orders SET status=$2,updated_at=now() WHERE id=$1 RETURNING *',
          [id, next]
        )
      ).rows[0]!;
      await client.query(
        'INSERT INTO order_status_history(order_id,from_status,to_status,actor_user_id) VALUES ($1,$2,$3,$4)',
        [id, order.status, next, actorId]
      );
      if (next === 'cancelled') {
        const items = await client.query<{ variant_id: string; quantity: number }>(
          'SELECT variant_id,quantity FROM order_items WHERE order_id=$1',
          [id]
        );
        for (const item of items.rows) {
          await client.query(
            'UPDATE product_variants SET stock_quantity=stock_quantity+$2,updated_at=now() WHERE id=$1',
            [item.variant_id, item.quantity]
          );
          await client.query(
            `INSERT INTO stock_movements(variant_id,order_id,quantity_delta,reason,actor_user_id) VALUES ($1,$2,$3,'order_cancelled',$4)`,
            [item.variant_id, id, item.quantity, actorId]
          );
        }
      }
      await client.query(
        `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES ($1,'order.status_changed','order',$2,jsonb_build_object('from',$3::text,'to',$4::text))`,
        [actorId, id, order.status, next]
      );
      const items = await client.query(
        'SELECT id,product_name AS "productName",sku,unit_price_millimes AS "unitPriceMillimes",quantity,line_total_millimes AS "lineTotalMillimes" FROM order_items WHERE order_id=$1',
        [id]
      );
      return { ...mapOrder(updated), items: items.rows };
    });
  }
}
