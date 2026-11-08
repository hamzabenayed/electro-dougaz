import { BadRequestException } from '@nestjs/common';
import type { SettingsService } from '../src/modules/settings/settings.service.js';
import { describe, expect, it } from 'vitest';
import type { DatabaseService } from '../src/database/database.service.js';
import { OrdersService } from '../src/modules/orders/orders.service.js';

describe('OrdersService', () => {
  it('rejects checkout without a valid idempotency key before querying PostgreSQL', async () => {
    const database = {} as DatabaseService;
    const service = new OrdersService(database, {} as SettingsService);
    await expect(
      service.create(
        {
          firstName: 'Amira',
          lastName: 'Ben Salah',
          phone: '22000148',
          governorate: 'Tunis',
          address: '10 rue de la République',
          paymentMethod: 'cash_on_delivery',
          items: [{ variantId: 'f7f68345-9c78-49cb-8447-757f9a782bb7', quantity: 1 }]
        },
        'not-a-uuid'
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
