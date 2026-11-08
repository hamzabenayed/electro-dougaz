/** Calculate from integer millimes. Round the displayed discount down, never up. */
export function getPromotion(price: number, originalPrice?: number) {
  const current = Math.round(price * 1000);
  const original = Math.round((originalPrice ?? 0) * 1000);
  if (
    !Number.isSafeInteger(current) ||
    !Number.isSafeInteger(original) ||
    current < 0 ||
    original <= current
  )
    return null;
  const percent = Math.floor(((original - current) * 1000) / original) / 10;
  return {
    percent,
    label: percent > 0 ? `−${String(percent).replace('.', ',')} %` : 'Remise < 0,1 %'
  };
}
