import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { StoreSearch } from './store-search';
import { apiRequest } from '../lib/api';
import type * as ApiModule from '../lib/api';

vi.mock('../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  apiRequest: vi.fn()
}));
const request = vi.mocked(apiRequest);
const product = {
  id: 'p',
  name: 'Nova',
  slug: 'nova',
  category: { name: 'Téléphones' },
  variant: { id: 'v', priceMillimes: 800000, compareAtPriceMillimes: 1000000, stockQuantity: 2 }
};
beforeEach(() => {
  vi.useFakeTimers();
  request.mockReset();
  request.mockImplementation((path) =>
    Promise.resolve(
      path === '/categories' ? [{ id: 'c', name: 'Téléphones', slug: 'telephones' }] : [product]
    )
  );
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
async function advance(ms = 300) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

it('shows categories on focus and debounces live product suggestions', async () => {
  render(<StoreSearch />);
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  await advance();
  expect(screen.getByRole('option', { name: /Téléphones/ })).toBeTruthy();
  expect(request).toHaveBeenCalledTimes(1);
  fireEvent.change(input, { target: { value: 'n' } });
  fireEvent.change(input, { target: { value: 'nova' } });
  expect(screen.getByRole('status').textContent).toContain('en cours');
  await advance();
  expect(request).toHaveBeenCalledTimes(2);
  const option = screen.getByRole('option', { name: /Nova/ });
  expect(option.getAttribute('href')).toContain('option=v');
  expect(option.textContent).toContain('800,000');
  expect(option.textContent).toContain('−20 %');
  expect(option.textContent).not.toContain('2 unités');
});
it('matches category accents and supports arrows, Escape and outside dismissal', async () => {
  render(<StoreSearch />);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'tele' } });
  await advance();
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(
    screen.getByRole('option', { name: /Téléphones Catégorie/ }).getAttribute('aria-selected')
  ).toBe('true');
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.focus(input);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('listbox')).toBeNull();
});
it('keeps full search available for empty results and network errors', async () => {
  request.mockResolvedValue([]);
  render(<StoreSearch />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'missing' } });
  await advance();
  expect(screen.getByRole('status').textContent).toContain('Aucun résultat');
  expect(screen.getByRole('option').getAttribute('href')).toBe('/recherche?q=missing');
  request.mockRejectedValue(new Error('offline'));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'next' } });
  await advance();
  expect(screen.getByRole('status').textContent).toContain('indisponibles');
  expect(screen.getByRole('button', { name: 'Lancer la recherche' })).toBeTruthy();
});
it('ignores stale responses even when a transport ignores abort', async () => {
  let finish: (value: unknown) => void = () => {};
  request.mockImplementation(async (path) =>
    path === '/categories'
      ? []
      : path.includes('q=old')
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : [{ ...product, name: 'New' }]
  );
  render(<StoreSearch />);
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'old' } });
  await advance();
  fireEvent.change(input, { target: { value: 'new' } });
  await advance();
  await act(async () => {
    finish([product]);
    await Promise.resolve();
  });
  expect(screen.queryByRole('option', { name: /Nova/ })).toBeNull();
  expect(screen.getByRole('option', { name: /New/ })).toBeTruthy();
});
