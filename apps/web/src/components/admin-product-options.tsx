'use client';
import { useState } from 'react';
import type { ApiProduct } from '../lib/api';

export function AdminProductOptions({ product }: { product?: ApiProduct }) {
  const [options, setOptions] = useState(() =>
    (product?.variants?.slice(1) ?? []).map((v) => ({ ...v, key: v.id }))
  );
  return (
    <section className="admin-panel admin-form-section">
      <h2>Options du produit</h2>
      <p>
        Une option correspond à une combinaison précise : par exemple « Noir · 256 Go ». Chaque
        option possède sa référence, son prix et son stock.
      </p>
      <label>
        Nom de l’option principale
        <input
          name="variantName"
          required
          maxLength={100}
          defaultValue={product?.variant.name ?? 'Standard'}
        />
      </label>
      {options.map((option, index) => (
        <fieldset key={option.key} className="option-editor">
          <legend>Option {index + 2}</legend>
          <input type="hidden" name="optionId" value={option.id} />
          <div className="admin-form-grid">
            <label>
              Combinaison
              <input
                name="optionName"
                required
                maxLength={100}
                defaultValue={option.name}
                placeholder="Noir · 256 Go"
              />
            </label>
            <label>
              Référence unique
              <input name="optionSku" required maxLength={80} defaultValue={option.sku} />
            </label>
            <label>
              Prix de vente (DT)
              <input
                name="optionPrice"
                type="number"
                min="0"
                max="100000"
                step="0.001"
                required
                defaultValue={option.priceMillimes / 1000}
              />
            </label>
            <label>
              Prix avant promotion (facultatif)
              <input
                name="optionOldPrice"
                type="number"
                min="0"
                max="100000"
                step="0.001"
                defaultValue={
                  option.compareAtPriceMillimes ? option.compareAtPriceMillimes / 1000 : ''
                }
              />
              <small>Supérieur au prix de vente pour activer la remise.</small>
            </label>
            <label>
              Stock
              <input
                name="optionStock"
                type="number"
                min="0"
                max="1000000"
                step="1"
                required
                defaultValue={option.stockQuantity}
              />
            </label>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setOptions((current) => current.filter((v) => v.key !== option.key))}
          >
            Retirer cette option
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="secondary-button"
        disabled={options.length >= 19}
        onClick={() =>
          setOptions((current) => [
            ...current,
            {
              key: crypto.randomUUID(),
              id: '',
              sku: '',
              name: '',
              priceMillimes: 0,
              stockQuantity: 0,
              lowStockThreshold: 3
            }
          ])
        }
      >
        ＋ Ajouter une option
      </button>
      <p>
        Les options retirées sont désactivées après enregistrement. Les anciennes commandes sont
        conservées.
      </p>
    </section>
  );
}
