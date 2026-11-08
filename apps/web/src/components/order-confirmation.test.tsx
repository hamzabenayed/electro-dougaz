import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OrderConfirmation } from './order-confirmation';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const reference = 'ED-2026-ABC123';
function setup(writeText?: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined
  });
  render(<OrderConfirmation reference={reference} totalMillimes={25000} />);
}
describe('guest reference reminder', () => {
  it('locks navigation and warns before leaving until clipboard success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setup(writeText);
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Suivre ma commande' }).disabled
    ).toBe(true);
    expect(screen.queryByRole('link')).toBeNull();
    const before = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Copier la référence' }));
    await screen.findByRole('link', { name: 'Suivre ma commande' });
    expect(writeText).toHaveBeenCalledWith(reference);
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });
  it.each([true, false])(
    'allows explicit manual saving when clipboard fails (available: %s)',
    async (available) => {
      setup(available ? vi.fn().mockRejectedValue(new Error('denied')) : undefined);
      fireEvent.click(screen.getByRole('button', { name: 'Copier la référence' }));
      await screen.findByRole('alert');
      expect(screen.queryByRole('link')).toBeNull();
      const input = screen.getByLabelText<HTMLInputElement>('Votre référence de commande');
      fireEvent.focus(input);
      expect(input.selectionEnd).toBe(reference.length);
      fireEvent.click(screen.getByRole('button', { name: 'J’ai conservé ma référence' }));
      await screen.findByRole('link', { name: 'Suivre ma commande' });
    }
  );
  it('does not unlock while copying is still pending', async () => {
    let resolve!: () => void;
    setup(
      vi.fn(
        () =>
          new Promise<void>((done) => {
            resolve = done;
          })
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'Copier la référence' }));
    expect(screen.queryByRole('link')).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: 'Copie en cours…' }).disabled
    ).toBe(true);
    resolve();
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2));
  });
});
