'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode
} from 'react';

export interface CartProduct {
  imageId?: string;
  variantId?: string;
  stock?: number;
  id: string;
  slug: string;
  name: string;
  price: number;
}

export interface CartLine extends CartProduct {
  quantity: number;
}

interface CartContextValue {
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  lines: CartLine[];
  hydrated: boolean;
  count: number;
  total: number;
  add: (product: CartProduct, quantity?: number) => void;
  update: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const storageKey = 'electro-dougaz-cart-v2';

export function restoreCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const result: CartLine[] = [];
  for (const raw of value.slice(0, 30)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<CartLine>;
    if (
      typeof item.id !== 'string' ||
      typeof item.slug !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.price !== 'number' ||
      !Number.isFinite(item.price) ||
      item.price < 0 ||
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    )
      continue;
    const stock =
      typeof item.stock === 'number' && Number.isInteger(item.stock) && item.stock >= 0
        ? item.stock
        : 10;
    const id = typeof item.variantId === 'string' ? item.variantId : item.id;
    const existing = result.find((line) => line.id === id);
    const quantity = Math.min(10, stock, item.quantity + (existing?.quantity ?? 0));
    if (!quantity) continue;
    if (existing) existing.quantity = quantity;
    else
      result.push({
        id,
        slug: item.slug,
        name: item.name,
        price: item.price,
        stock,
        quantity,
        ...(typeof item.variantId === 'string' ? { variantId: item.variantId } : {}),
        ...(typeof item.imageId === 'string' ? { imageId: item.imageId } : {})
      });
  }
  return result;
}

export function remainingQuantity(product: CartProduct, lines: CartLine[]): number {
  const limit = Math.max(0, Math.min(product.stock ?? 10, 10));
  return Math.max(
    0,
    limit -
      (lines.find((line) => (line.variantId ?? line.id) === (product.variantId ?? product.id))
        ?.quantity ?? 0)
  );
}

export function CartProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [isOpen, setIsOpen] = useState(false);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) setLines(restoreCart(JSON.parse(stored)));
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(storageKey, JSON.stringify(lines));
  }, [hydrated, lines]);

  const value = useMemo<CartContextValue>(
    () => ({
      isOpen,
      openCart,
      closeCart,
      lines,
      hydrated,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      total: lines.reduce((sum, line) => sum + line.price * line.quantity, 0),
      add: (product, quantity = 1) =>
        setLines((current) => {
          if (!Number.isInteger(quantity) || quantity < 1) return current;
          if (quantity > remainingQuantity(product, current)) return current;
          const id = product.variantId ?? product.id;
          const existing = current.find((line) => (line.variantId ?? line.id) === id);
          return existing
            ? current.map((line) =>
                (line.variantId ?? line.id) === id
                  ? { ...line, ...product, id, quantity: line.quantity + quantity }
                  : line
              )
            : [...current, { ...product, id, quantity }];
        }),
      update: (id, quantity) =>
        setLines((current) =>
          quantity < 1
            ? current.filter((line) => line.id !== id)
            : current.map((line) =>
                line.id === id
                  ? {
                      ...line,
                      quantity: Math.min(Math.max(1, Math.floor(quantity)), line.stock ?? 10, 10)
                    }
                  : line
              )
        ),
      remove: (id) => setLines((current) => current.filter((line) => line.id !== id)),
      clear: () => setLines([])
    }),
    [hydrated, lines, isOpen, openCart, closeCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
