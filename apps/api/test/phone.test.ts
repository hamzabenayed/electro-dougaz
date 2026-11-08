import { describe, it, expect } from 'vitest';
import { normalizePhone } from '../src/modules/orders/phone.js';
describe('Guest phone normalization', () => {
  it.each(['22000148', '22 000 148', '+216 22 000 148', '0021622000148', '21622000148'])(
    'normalizes %s consistently',
    (input) => {
      expect(normalizePhone(input)).toBe('22000148');
    }
  );
});
