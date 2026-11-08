import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ProductPrice, ProductPromotion } from './product-promotion';
import { getPromotion } from '../lib/promotion';

afterEach(cleanup);
describe('Product promotions', () => {
  it('calculates the discount and displays original and sale prices', () => {
    expect(getPromotion(800, 1000)?.percent).toBe(20);
    const { container } = render(
      <>
        <ProductPromotion price={800} oldPrice={1000} />
        <ProductPrice price={800} oldPrice={1000} />
      </>
    );
    expect(screen.getByText('−20 %')).toBeTruthy();
    expect(container.querySelector('del')?.textContent?.replace(/\s/g, '')).toContain('1000,000');
    expect(container.querySelector('.price')?.textContent).toContain('800,000');
  });
  it.each([
    [100, undefined],
    [100, 100],
    [100, 50],
    [NaN, 100],
    [-1, 100]
  ])('does not advertise invalid discounts (%s, %s)', (price, oldPrice) => {
    expect(getPromotion(price, oldPrice)).toBeNull();
  });
  it('never rounds a discount up and handles tiny discounts without a false zero-percent offer', () => {
    expect(getPromotion(2, 3)?.percent).toBe(33.3);
    expect(getPromotion(999.999, 1000)?.label).toBe('Remise < 0,1 %');
  });
});
