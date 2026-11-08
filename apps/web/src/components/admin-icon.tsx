import type { ReactNode } from 'react';

export type AdminIconName =
  | 'close'
  | 'logout'
  | 'shield'
  | 'eye'
  | 'eye-off'
  | 'check'
  | 'refresh'
  | 'truck'
  | 'mail'
  | 'clock'
  | 'image'
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'stock'
  | 'categories'
  | 'settings'
  | 'users'
  | 'menu'
  | 'search'
  | 'plus'
  | 'arrow'
  | 'bell'
  | 'store';

export function AdminIcon({ name, size = 20 }: Readonly<{ name: AdminIconName; size?: number }>) {
  const paths: Record<AdminIconName, ReactNode> = {
    close: <path d="m6 6 12 12M6 18 18 6" />,
    logout: <path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h10" />,
    shield: <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6" />,
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    'eye-off': (
      <>
        <path d="m3 3 18 18M10 5h2c6 0 10 7 10 7l-3 4M6 6c-3 2-4 6-4 6s4 7 10 7h3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    refresh: <path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M18 18a8 8 0 0 1-14-6" />,
    truck: (
      <path d="M3 5h11v12H3zM14 9h4l3 4v4h-7M6 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4" />
    ),
    mail: <path d="M3 5h18v14H3zM3 5l9 8 9-8" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    image: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="8" cy="8" r="1" />
        <path d="m3 17 5-5 4 4 4-6 5 7" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    orders: (
      <>
        <path d="M6 3h12l2 4-2 14H6L4 7Z" />
        <path d="M9 10h6M9 14h6" />
      </>
    ),
    products: (
      <>
        <path d="m12 3 9 5-9 5-9-5Z" />
        <path d="m3 8 9 5 9-5v8l-9 5-9-5Z" />
      </>
    ),
    stock: (
      <>
        <path d="M4 5h16v14H4zM8 9h8M8 13h5" />
      </>
    ),
    categories: (
      <>
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a2 2 0 0 0 .4 2.2l.1.1-2.6 2.6-.1-.1A2 2 0 0 0 15 19.4a2 2 0 0 0-1.2 1.8V21h-3.6v-.2A2 2 0 0 0 9 19.4a2 2 0 0 0-2.2.4l-.1.1-2.6-2.6.1-.1A2 2 0 0 0 4.6 15a2 2 0 0 0-1.8-1.2H3v-3.6h.2A2 2 0 0 0 4.6 9a2 2 0 0 0-.4-2.2l-.1-.1 2.6-2.6.1.1A2 2 0 0 0 9 4.6a2 2 0 0 0 1.2-1.8V3h3.6v.2A2 2 0 0 0 15 4.6a2 2 0 0 0 2.2-.4l.1-.1 2.6 2.6-.1.1A2 2 0 0 0 19.4 9a2 2 0 0 0 1.8 1.2h.2v3.6h-.2A2 2 0 0 0 19.4 15Z" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a5 5 0 0 1 10 0v2M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 4v2" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    search: <path d="m21 21-4.3-4.3m2.3-5.2A7.5 7.5 0 1 1 4 11.5a7.5 7.5 0 0 1 15 0Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="m9 18 6-6-6-6" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    store: (
      <>
        <path d="M3 10h18M5 10v10h14V10M4 4h16l1 6H3Z" />
        <path d="M9 14h6v6" />
      </>
    )
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
