import { describe, expect, it } from 'vitest';
import { OrderStatusSchema } from './index.js';

describe('OrderStatusSchema', () => {
  it('rejects unknown order states', () => {
    expect(OrderStatusSchema.safeParse('paid-ish').success).toBe(false);
  });
});
