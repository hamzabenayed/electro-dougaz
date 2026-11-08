import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import type { PaymentEventDto, ReportQueryDto } from './reporting.dto.js';

export function validatePayment(
  kind: string,
  amount: number,
  total: number,
  collected: number,
  received: number,
  refunded: number
) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new BadRequestException('Montant invalide');
  const remaining =
    kind === 'collected'
      ? total - collected
      : kind === 'received'
        ? collected - received
        : received - refunded;
  if (amount > remaining) throw new ConflictException('Le montant dépasse le solde disponible');
}
export function reportDates(from?: string, to?: string) {
  for (const date of [from, to]) {
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date)
    )
      throw new BadRequestException('Date invalide');
  }
  if (from && to && from > to) throw new BadRequestException('La date de début dépasse la fin');
}
const balances = `SELECT order_id,
 COALESCE(sum(amount_millimes) FILTER(WHERE kind='collected'),0)::bigint AS collected,
 COALESCE(sum(amount_millimes) FILTER(WHERE kind='received'),0)::bigint AS received,
 COALESCE(sum(amount_millimes) FILTER(WHERE kind='refunded'),0)::bigint AS refunded,
 min(created_at) FILTER(WHERE kind='collected') AS collection_at
 FROM order_payment_events GROUP BY order_id`;

@Injectable()
export class ReportingService {
  constructor(private readonly db: DatabaseService) {}
  async ledger(id: string) {
    const order = await this.db.query('SELECT id FROM orders WHERE id=$1', [id]);
    if (!order.rows.length) throw new NotFoundException('Commande introuvable');
    return (
      await this.db.query(
        `SELECT e.id,e.kind,e.amount_millimes AS "amountMillimes",e.note,e.created_at AS "createdAt",u.email AS actor FROM order_payment_events e JOIN admin_users u ON u.id=e.actor_user_id WHERE order_id=$1 ORDER BY e.created_at,e.id`,
        [id]
      )
    ).rows;
  }
  async record(id: string, input: PaymentEventDto, actor: string) {
    return this.db.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
        `payment:${input.requestKey}`
      ]);
      const order = (
        await client.query<{ payment_method: string; status: string; total_millimes: number }>(
          'SELECT * FROM orders WHERE id=$1 FOR UPDATE',
          [id]
        )
      ).rows[0];
      if (!order) throw new NotFoundException('Commande introuvable');
      const previous = (
        await client.query<{
          id: string;
          order_id: string;
          kind: string;
          amount_millimes: number;
          note: string;
        }>('SELECT * FROM order_payment_events WHERE request_key=$1', [input.requestKey])
      ).rows[0];
      if (previous) {
        if (
          previous.order_id !== id ||
          previous.kind !== input.kind ||
          previous.amount_millimes !== input.amountMillimes ||
          previous.note !== input.note.trim()
        )
          throw new ConflictException('Clé déjà utilisée');
        return { id: previous.id };
      }
      if (order.payment_method !== 'cash_on_delivery')
        throw new ConflictException(
          'Les paiements carte doivent être rapprochés par leur prestataire'
        );
      if (!['delivered', 'returned'].includes(order.status))
        throw new ConflictException('Enregistrez la livraison avant le paiement');
      const b = (
        await client.query<{ collected: string; received: string; refunded: string }>(
          `SELECT * FROM (${balances}) b WHERE order_id=$1`,
          [id]
        )
      ).rows[0];
      const collected = Number(b?.collected ?? 0),
        received = Number(b?.received ?? 0),
        refunded = Number(b?.refunded ?? 0);
      validatePayment(
        input.kind,
        input.amountMillimes,
        order.total_millimes,
        collected,
        received,
        refunded
      );
      if (input.note.trim().length < 3)
        throw new BadRequestException('Précisez la référence ou le motif');
      const event = (
        await client.query<{ id: string }>(
          `INSERT INTO order_payment_events(order_id,kind,amount_millimes,note,actor_user_id,request_key) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
          [id, input.kind, input.amountMillimes, input.note.trim(), actor, input.requestKey]
        )
      ).rows[0];
      if (!event) throw new ConflictException('Paiement non enregistré');
      const newCollected = collected + (input.kind === 'collected' ? input.amountMillimes : 0);
      const newRefunded = refunded + (input.kind === 'refunded' ? input.amountMillimes : 0);
      await client.query('UPDATE orders SET payment_status=$2,updated_at=now() WHERE id=$1', [
        id,
        newRefunded >= order.total_millimes
          ? 'refunded'
          : newCollected >= order.total_millimes
            ? 'paid'
            : 'pending'
      ]);
      await client.query(
        `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'payment.recorded','order',$2,$3)`,
        [
          actor,
          id,
          JSON.stringify({
            kind: input.kind,
            amountMillimes: input.amountMillimes,
            eventId: event.id
          })
        ]
      );
      return event;
    });
  }
  async report(q: ReportQueryDto) {
    reportDates(q.from, q.to);
    const dateColumn =
      q.basis === 'delivery'
        ? 'delivery_at'
        : q.basis === 'collection'
          ? 'collection_at'
          : 'created_at';
    const cte = `WITH enriched AS (SELECT o.*,COALESCE(b.collected,0) AS collected,COALESCE(b.received,0) AS received,COALESCE(b.refunded,0) AS refunded,b.collection_at,
      (SELECT min(created_at) FROM order_status_history WHERE order_id=o.id AND to_status='delivered') AS delivery_at,
      CASE WHEN COALESCE(b.refunded,0)>=o.total_millimes THEN 'refunded' WHEN COALESCE(b.refunded,0)>0 THEN 'partially_refunded' WHEN COALESCE(b.received,0)>=o.total_millimes THEN 'received' WHEN COALESCE(b.collected,0)>0 THEN 'collected' ELSE 'pending' END AS collection_status
      FROM orders o LEFT JOIN (${balances}) b ON b.order_id=o.id), filtered AS (SELECT * FROM enriched o WHERE
      ($1::date IS NULL OR ${dateColumn} >= ($1::date::timestamp AT TIME ZONE 'Africa/Tunis')) AND
      ($2::date IS NULL OR ${dateColumn} < (($2::date+1)::timestamp AT TIME ZONE 'Africa/Tunis')) AND
      ($3::text IS NULL OR status=$3) AND ($4::text IS NULL OR collection_status=$4) AND
      ($5::text IS NULL OR payment_method=$5) AND ($6::text IS NULL OR governorate=$6) AND
      ($7::uuid IS NULL OR EXISTS(SELECT 1 FROM order_items i JOIN product_variants v ON v.id=i.variant_id WHERE i.order_id=o.id AND v.product_id=$7)) AND
      ($8::uuid IS NULL OR EXISTS(SELECT 1 FROM order_items i JOIN product_variants v ON v.id=i.variant_id JOIN products p ON p.id=v.product_id WHERE i.order_id=o.id AND p.category_id=$8)) AND
      ($9::text IS NULL OR reference ILIKE '%'||$9||'%' OR phone ILIKE '%'||$9||'%'))`;
    const values = [
      q.from ?? null,
      q.to ?? null,
      q.status || null,
      q.payment || null,
      q.method || null,
      q.governorate || null,
      q.product || null,
      q.category || null,
      q.q?.trim() || null
    ];
    const result = await this.db.query(
      `${cte} SELECT
      (SELECT jsonb_build_object('count',count(*),'placed',COALESCE(sum(total_millimes),0),'delivered',COALESCE(sum(total_millimes) FILTER(WHERE status='delivered'),0),'received',COALESCE(sum(received),0),'collected',COALESCE(sum(collected),0),'refunded',COALESCE(sum(refunded),0),'awaitingRemittance',COALESCE(sum(collected-received),0),'awaitingCollection',COALESCE(sum(GREATEST(total_millimes-collected,0)) FILTER(WHERE status='delivered'),0),'cancelled',count(*) FILTER(WHERE status='cancelled'),'returned',count(*) FILTER(WHERE status='returned'),'average',COALESCE(round(avg(total_millimes) FILTER(WHERE status='delivered')),0)) FROM filtered) AS summary,
      (SELECT COALESCE(jsonb_agg(r),'[]') FROM (SELECT id,reference,status,collection_status AS "paymentStatus",total_millimes AS "totalMillimes",created_at AS "createdAt",collected,received,refunded FROM filtered ORDER BY created_at DESC,id LIMIT 50 OFFSET $10) r) AS orders,
      (SELECT COALESCE(jsonb_agg(d),'[]') FROM (SELECT (${dateColumn} AT TIME ZONE 'Africa/Tunis')::date AS day,count(*) AS count,sum(total_millimes) AS total FROM filtered WHERE ${dateColumn} IS NOT NULL GROUP BY day ORDER BY day DESC LIMIT 366) d) AS days,
      (SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT i.product_name AS name,sum(i.quantity) AS quantity,sum(i.line_total_millimes) AS total FROM order_items i JOIN filtered o ON o.id=i.order_id WHERE o.status='delivered' GROUP BY i.product_name ORDER BY sum(i.quantity) DESC LIMIT 10) t) AS top`,
      [...values, q.offset]
    );
    return result.rows[0];
  }
  async activity(q: ReportQueryDto) {
    reportDates(q.from, q.to);
    return (
      await this.db.query(
        `SELECT a.id,a.action,a.entity_type AS "entityType",a.entity_id AS "entityId",a.metadata,a.created_at AS "createdAt",u.email AS actor FROM audit_logs a LEFT JOIN admin_users u ON u.id=a.actor_user_id WHERE ($1::date IS NULL OR a.created_at >= ($1::date::timestamp AT TIME ZONE 'Africa/Tunis')) AND ($2::date IS NULL OR a.created_at < (($2::date+1)::timestamp AT TIME ZONE 'Africa/Tunis')) AND ($3::text IS NULL OR a.action ILIKE '%'||$3||'%') ORDER BY a.created_at DESC,a.id LIMIT 50 OFFSET $4`,
        [q.from ?? null, q.to ?? null, q.q?.trim() || null, q.offset]
      )
    ).rows;
  }
}
