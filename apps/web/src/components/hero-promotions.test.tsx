import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { catalogProducts } from '../lib/catalog';
import { selectHeroPromotions } from '../lib/hero-promotions';
import { HeroPromotions } from './hero-promotions';

const offers = [catalogProducts[0]!, catalogProducts[1]!, catalogProducts[2]!] as const;
let reduced = false;
beforeEach(() => {
  vi.useFakeTimers();
  reduced = false;
  vi.stubGlobal('matchMedia', () => ({
    matches: reduced,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('selects at most three unique stocked discounts without mutating the input', () => {
  const input = [...catalogProducts, offers[0], { ...offers[1], slug: 'sold', stock: 0 }];
  const original = [...input];
  const selected = selectHeroPromotions(input, () => 0);
  expect(selected).toHaveLength(3);
  expect(new Set(selected.map((p) => p.slug)).size).toBe(3);
  expect(selected.every((p) => p.stock > 0 && p.oldPrice! > p.price)).toBe(true);
  expect(input).toEqual(original);
  expect(selectHeroPromotions([])).toEqual([]);
  expect(selectHeroPromotions([offers[0]])).toEqual([offers[0]]);
  expect(selectHeroPromotions(offers, () => 0)).not.toEqual(
    selectHeroPromotions(offers, () => 0.99)
  );
});
it('rotates one offer at a time and pauses on hover and manual navigation', () => {
  render(<HeroPromotions products={offers} />);
  expect(screen.getAllByRole('heading')).toHaveLength(1);
  void act(() => vi.advanceTimersByTime(6000));
  expect(screen.getByRole('heading').textContent).toBe(offers[1].name);
  const carousel = screen.getByRole('region');
  fireEvent.mouseEnter(carousel);
  void act(() => vi.advanceTimersByTime(12000));
  expect(screen.getByRole('heading').textContent).toBe(offers[1].name);
  fireEvent.mouseLeave(carousel);
  fireEvent.click(screen.getByRole('button', { name: 'Offre suivante' }));
  void act(() => vi.advanceTimersByTime(12000));
  expect(screen.getByRole('heading').textContent).toBe(offers[2].name);
  fireEvent.click(screen.getByRole('button', { name: 'Reprendre le défilement' }));
  void act(() => vi.advanceTimersByTime(6000));
  expect(screen.getByRole('heading').textContent).toBe(offers[0].name);
});
it('respects reduced motion, keeps manual controls, and preserves the product option', () => {
  reduced = true;
  render(<HeroPromotions products={offers} />);
  void act(() => vi.advanceTimersByTime(18000));
  expect(screen.getByRole('heading').textContent).toBe(offers[0].name);
  expect(screen.getByRole('link').getAttribute('href')).toContain(`option=${offers[0].id}`);
  fireEvent.click(screen.getByRole('button', { name: 'Offre précédente' }));
  expect(screen.getByRole('heading').textContent).toBe(offers[2].name);
});
it('pauses while keyboard focus is inside the carousel', () => {
  render(<HeroPromotions products={offers} />);
  fireEvent.focus(screen.getByRole('link'));
  void act(() => vi.advanceTimersByTime(12000));
  expect(screen.getByRole('heading').textContent).toBe(offers[0].name);
});
it('has no unnecessary controls for one offer and renders nothing for none', () => {
  const { rerender } = render(<HeroPromotions products={[offers[0]]} />);
  expect(screen.queryByRole('button')).toBeNull();
  rerender(<HeroPromotions products={[]} />);
  expect(screen.queryByRole('region')).toBeNull();
});
