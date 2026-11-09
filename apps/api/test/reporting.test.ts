import { describe, it, expect } from 'vitest';
import { reportDates, validatePayment } from '../src/modules/orders/reporting.service.js';
describe('payment ledger safeguards', () => {
  it('allows collection, remittance and partial refunds within their balances', () => {
    expect(() => validatePayment('collected', 1000, 2000, 0, 0, 0)).not.toThrow();
    expect(() => validatePayment('received', 500, 2000, 1000, 0, 0)).not.toThrow();
    expect(() => validatePayment('refunded', 250, 2000, 1000, 500, 0)).not.toThrow();
  });
  it.each([0, -1, 0.5, Infinity, NaN])('rejects invalid amount %s', (amount) =>
    expect(() => validatePayment('collected', amount, 1000, 0, 0, 0)).toThrow()
  );
  it('does not permit overcollection, premature remittance or excess refunds', () => {
    expect(() => validatePayment('collected', 501, 1000, 500, 0, 0)).toThrow();
    expect(() => validatePayment('received', 501, 1000, 500, 0, 0)).toThrow();
    expect(() => validatePayment('refunded', 301, 1000, 1000, 500, 200)).toThrow();
  });
  it('validates date bounds and real calendar dates', () => {
    expect(() => reportDates('2026-02-30')).toThrow();
    expect(() => reportDates('0000-01-01')).toThrow();
    expect(() => reportDates('2026-10-23', '2026-10-22')).toThrow();
    expect(() => reportDates('2026-10-22', '2026-10-22')).not.toThrow();
  });
});
