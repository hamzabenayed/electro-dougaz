export function formText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
