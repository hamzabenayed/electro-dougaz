import { formatPrice } from '../lib/catalog';
import { getPromotion } from '../lib/promotion';

export function ProductPromotion({ price, oldPrice }: { price: number; oldPrice?: number }) {
  const promotion = getPromotion(price, oldPrice);
  return promotion ? (
    <span className="product-promotion" aria-label={`Promotion : ${promotion.label}`}>
      {promotion.label}
    </span>
  ) : null;
}

export function ProductPrice({
  price,
  oldPrice,
  detail = false
}: {
  price: number;
  oldPrice?: number;
  detail?: boolean;
}) {
  const promotion = getPromotion(price, oldPrice);
  return (
    <div className={`product-pricing${detail ? ' is-detail' : ''}`}>
      {promotion && (
        <p className="product-original-price">
          <span className="sr-only">Prix avant promotion : </span>
          <del>{formatPrice(oldPrice!)} DT</del>
        </p>
      )}
      <p className={detail ? 'detail-price' : 'price'}>
        <span className="sr-only">{promotion ? 'Prix promotionnel : ' : 'Prix : '}</span>
        <strong>{formatPrice(price)}</strong> <span>DT</span>
      </p>
      {promotion && (
        <p className="product-savings">
          Économisez {formatPrice(Math.round((oldPrice! - price) * 1000) / 1000)} DT
        </p>
      )}
    </div>
  );
}
