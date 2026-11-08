/** Canonical Tunisian phone used by guest checkout and tracking, including legacy rows. */
export function normalizePhone(value: string): string {
  return value.replace(/\s/g, '').replace(/^(?:\+216|00216|216)(?=\d{8}$)/, '');
}
