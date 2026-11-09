import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi } from 'vitest';
import type { DatabaseService } from '../src/database/database.service.js';
import type { SettingsService } from '../src/modules/settings/settings.service.js';
import { CatalogService } from '../src/modules/catalog/catalog.service.js';
import { InventoryService } from '../src/modules/inventory/inventory.service.js';
import { OrdersService } from '../src/modules/orders/orders.service.js';

function database() {
  const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const client = { query };
  const db = {
    query,
    transaction: (work: (connection: typeof client) => unknown) => work(client)
  } as unknown as DatabaseService;
  return { db, query };
}
describe('Category safety and stock filtering', () => {
  it('hides without deleting products and records the actor', async () => {
    const { db, query } = database();
    query.mockResolvedValueOnce({ rows: [{ id: 'category' }], rowCount: 1 });
    expect(await new CatalogService(db).categoryVisibility('category', false, 'owner')).toEqual({
      id: 'category',
      isVisible: false
    });
    expect(query.mock.calls[0]?.[1]).toEqual(['category', false]);
    expect(query.mock.calls[1]?.[0]).toContain('audit_logs');
    expect(query.mock.calls.some(([sql]) => typeof sql === 'string' && /DELETE/.test(sql))).toBe(
      false
    );
  });
  it('refuses deleting a populated category', async () => {
    const { db, query } = database();
    query
      .mockResolvedValueOnce({ rows: [{ name: 'Phones' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'product' }] });
    await expect(new CatalogService(db).deleteCategory('category', 'owner')).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('rejects unknown categories', async () => {
    const { db } = database();
    await expect(new CatalogService(db).deleteCategory('missing', 'owner')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
  it('filters across active variants before pagination and parameterizes user search', async () => {
    const { db, query } = database();
    await new CatalogService(db).adminProducts({
      q: "' OR true --",
      stock: 'out_of_stock',
      sort: 'newest',
      limit: 30,
      offset: 30
    });
    expect(query.mock.calls[0]?.[1]).toEqual(["' OR true --", 30, 30, 'out_of_stock']);
    expect(query.mock.calls[0]?.[0]).toContain("$4='out_of_stock' AND NOT EXISTS");
    expect(query.mock.calls[0]?.[0]).toContain('s.is_active AND s.stock_quantity>0');
  });
});
describe('Stock ledger', () => {
  it('rejects zero changes and whitespace-only explanations before writing', async () => {
    const { db, query } = database();
    const service = new InventoryService(db);
    await expect(
      service.adjust({ variantId: 'v', quantity: 0, note: 'Count' }, 'a')
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.adjust({ variantId: 'v', quantity: 1, note: '  ' }, 'a')
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
  it('replays an identical adjustment without applying it twice', async () => {
    const { db, query } = database();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [
        {
          variant_id: 'v',
          quantity_delta: 3,
          note: 'Supplier',
          actor_user_id: 'a',
          current_stock: 6
        }
      ]
    });
    expect(
      await new InventoryService(db).adjust(
        { variantId: 'v', quantity: 3, note: 'Supplier', requestKey: 'key' },
        'a'
      )
    ).toEqual({ variantId: 'v', stockQuantity: 6 });
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('rejects a retry key reused for a different quantity', async () => {
    const { db, query } = database();
    query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [{ variant_id: 'v', quantity_delta: 3, note: 'Supplier', actor_user_id: 'a' }]
    });
    await expect(
      new InventoryService(db).adjust(
        { variantId: 'v', quantity: 4, note: 'Supplier', requestKey: 'key' },
        'a'
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('validates real calendar dates and bounds history pages', async () => {
    const { db, query } = database();
    const service = new InventoryService(db);
    await expect(
      service.history({ from: '2026-02-30', direction: 'all', offset: 0 })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
    await service.history({ from: '2026-11-01', to: '2026-11-09', direction: 'add', offset: 50 });
    expect(query.mock.calls[0]?.[0]).toContain('LIMIT 50 OFFSET $5');
    expect(query.mock.calls[0]?.[0]).toContain("AT TIME ZONE 'Africa/Tunis'");
    expect(query.mock.calls[0]?.[1]).toEqual([null, 'add', '2026-11-01', '2026-11-09', 50]);
  });
});
describe('Bulk delivery documents', () => {
  it('rejects empty, duplicate, oversized or mixed selections without querying', async () => {
    const { db, query } = database();
    const service = new OrdersService(db, {} as SettingsService);
    for (const ids of [[], ['a', 'a'], Array.from({ length: 51 }, (_, i) => `${i}`)])
      await expect(service.deliveryNotes({ mode: 'selection', ids })).rejects.toBeInstanceOf(
        BadRequestException
      );
    await expect(
      service.deliveryNotes({ mode: 'selection', ids: ['a'], from: '2026-11-01' })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });
  it('requires valid, ordered dates', async () => {
    const { db, query } = database();
    const service = new OrdersService(db, {} as SettingsService);
    for (const dates of [
      {},
      { from: '2026-11-09' },
      { from: '2026-02-30', to: '2026-11-09' },
      { from: '2026-11-10', to: '2026-11-09' }
    ])
      await expect(service.deliveryNotes({ mode: 'dates', ...dates })).rejects.toBeInstanceOf(
        BadRequestException
      );
    expect(query).not.toHaveBeenCalled();
  });
  it('never silently truncates a date range', async () => {
    const { db, query } = database();
    query.mockResolvedValue({ rows: Array.from({ length: 51 }, () => ({})) });
    await expect(
      new OrdersService(db, {} as SettingsService).deliveryNotes({
        mode: 'dates',
        from: '2026-11-01',
        to: '2026-11-09'
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects missing selected orders rather than silently omitting them', async () => {
    const { db } = database();
    await expect(
      new OrdersService(db, {} as SettingsService).deliveryNotes({
        mode: 'selection',
        ids: ['missing']
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
