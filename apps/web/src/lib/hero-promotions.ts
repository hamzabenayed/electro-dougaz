import type { CatalogProduct } from './catalog';
import { getPromotion } from './promotion';

/** The API supplies active offers; sample without replacement on the server. */
export function selectHeroPromotions(products: readonly CatalogProduct[], random = Math.random) {
  const seen = new Set<string>();
  const eligible = products.filter((product) => {
    if (
      seen.has(product.slug) ||
      product.stock <= 0 ||
      !getPromotion(product.price, product.oldPrice)
    )
      return false;
    seen.add(product.slug);
    return true;
  });
  for (let index = eligible.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [eligible[index], eligible[other]] = [eligible[other]!, eligible[index]!];
  }
  return eligible.slice(0, 3);
}
