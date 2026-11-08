import { describe, it, expect } from 'vitest';
import { csvText } from './report-export';
import { recentSlugs } from '../components/recent-products';
import { promotionState } from '../components/admin-promotions';
import type { ApiProduct } from './api';
describe('commerce enhancements', () => {
  it('quotes CSV and prevents spreadsheet formula execution', () => {
    expect(csvText([['=HYPERLINK("bad")', ' +1', 'normal;value']])).toContain(
      '"\'=HYPERLINK(""bad"")"'
    );
    expect(csvText([['normal;value']])).toContain('"normal;value"');
  });
  it('bounds and sanitizes local recently viewed slugs', () => {
    expect(recentSlugs(['phone', 'https://evil', 'phone', null, '<script>'], 'new')).toEqual([
      'new',
      'phone'
    ]);
    expect(recentSlugs('invalid', 'new')).toEqual(['new']);
    expect(recentSlugs(['a', 'b', 'c', 'd', 'e', 'f'], 'new')).toHaveLength(5);
  });
  it('distinguishes scheduled, active and expired promotions', () => {
    const p = {
      variant: { priceMillimes: 800, compareAtPriceMillimes: 1000 },
      promotionStartsAt: '2026-10-22T00:00:00Z',
      promotionEndsAt: '2026-10-23T00:00:00Z'
    } as ApiProduct;
    expect(promotionState(p, Date.parse('2026-10-21'))).toBe('Programmée');
    expect(promotionState(p, Date.parse('2026-10-22'))).toBe('Active');
    expect(promotionState(p, Date.parse('2026-10-23'))).toBe('Terminée');
  });
});
