/** Public availability intentionally omits the exact inventory quantity. */
export function ProductAvailability({ available }: Readonly<{ available: boolean }>) {
  return (
    <span className={`product-availability ${available ? 'is-available' : 'is-unavailable'}`}>
      <svg
        viewBox="0 0 20 20"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="7.5" />
        {available ? <path d="m6 10 2.5 2.5L14 7" /> : <path d="m7 7 6 6m0-6-6 6" />}
      </svg>
      {available ? 'Disponible' : 'Rupture de stock'}
    </span>
  );
}
