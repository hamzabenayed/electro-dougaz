'use client';

import { AdminIcon } from './admin-icon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { apiRequest, toSlug, type ApiCategory, type ApiProduct } from '../lib/api';
import { getAdminToken } from '../lib/admin-session';
import { ProductPrice, ProductPromotion } from './product-promotion';
import { getPromotion } from '../lib/promotion';
import { AdminProductOptions } from './admin-product-options';
import { formText } from '../lib/form-text';
import { AdminSavedImage } from './admin-saved-image';
import { AdminAccessories } from './admin-accessories';

interface ImagePreview {
  id: string;
  file: File;
  url: string;
}

const maximumImageBytes = 5 * 1024 * 1024;
const maximumImageCount = 8;
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const acceptedImageExtension = /\.(?:jpe?g|jfif|png|webp)$/i;

export function AdminProductForm({
  mode = 'create',
  product
}: Readonly<{ mode?: 'create' | 'edit'; product?: ApiProduct }>) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(product?.category.id ?? '');
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [imageError, setImageError] = useState('');
  const initialPromotion =
    !!product && (product.variant.compareAtPriceMillimes ?? 0) > product.variant.priceMillimes;
  const [promotionEnabled, setPromotionEnabled] = useState(initialPromotion);
  const [regularPrice, setRegularPrice] = useState(
    product
      ? String(
          (initialPromotion
            ? product.variant.compareAtPriceMillimes!
            : product.variant.priceMillimes) / 1000
        )
      : ''
  );
  const [salePrice, setSalePrice] = useState(
    initialPromotion ? String(product.variant.priceMillimes / 1000) : ''
  );
  const promotionValid =
    regularPrice !== '' &&
    salePrice !== '' &&
    !!getPromotion(Number(salePrice), Number(regularPrice));
  const objectUrls = useRef<string[]>([]);
  const savedId = useRef(product?.id);
  const savedVariants = useRef<Array<{ id: string; sku: string }>>([]);
  const uploadedIds = useRef(new Set<string>());
  const [storedImages, setStoredImages] = useState(product?.images ?? []);
  const [removedImages, setRemovedImages] = useState<string[]>([]);

  useEffect(() => {
    apiRequest<ApiCategory[]>('/admin/categories', {
      headers: { Authorization: `Bearer ${getAdminToken()}` }
    })
      .then(setCategories)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Impossible de charger les catégories.')
      );
    return () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';
    setImageError('');
    if (images.length + storedImages.length + selectedFiles.length > maximumImageCount) {
      setImageError(`Vous pouvez ajouter jusqu’à ${maximumImageCount} photos.`);
      return;
    }
    const invalidFormat = selectedFiles.find(
      (file) => !acceptedImageTypes.has(file.type) && !acceptedImageExtension.test(file.name)
    );
    if (invalidFormat) {
      setImageError(`${invalidFormat.name} n’est pas un format JPG, JFIF, PNG ou WebP valide.`);
      return;
    }
    const oversized = selectedFiles.find((file) => file.size > maximumImageBytes);
    if (oversized) {
      setImageError(`${oversized.name} dépasse la limite de 5 Mo.`);
      return;
    }
    const previews = selectedFiles.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      return { id: crypto.randomUUID(), file, url };
    });
    setImages((current) => [...current, ...previews]);
  }

  function removeImage(image: ImagePreview) {
    URL.revokeObjectURL(image.url);
    objectUrls.current = objectUrls.current.filter((url) => url !== image.url);
    setImages((current) => current.filter((item) => item.id !== image.id));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const token = getAdminToken();
    if (!token) return setError('Votre session a expiré. Reconnectez-vous avant d’enregistrer.');
    const data = new FormData(event.currentTarget);
    const nameValue = data.get('name');
    const name = typeof nameValue === 'string' ? nameValue.trim() : '';
    const specifications = formText(data.get('specifications'))
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        const separator = line.indexOf(':');
        return {
          label: separator < 0 ? '' : line.slice(0, separator).trim(),
          value: line.slice(separator + 1).trim()
        };
      });
    if (specifications.some((item) => !item.label || !item.value))
      return setError(
        'Caractéristiques : utilisez une ligne « Nom : Valeur » par caractéristique.'
      );
    const additionalVariants = data.getAll('optionName').map((value, index) => ({
      ...(data.getAll('optionId')[index] ||
      savedVariants.current.find(
        (v) => v.sku === formText(data.getAll('optionSku')[index]).trim().toUpperCase()
      )?.id
        ? {
            id:
              data.getAll('optionId')[index] ||
              savedVariants.current.find(
                (v) => v.sku === formText(data.getAll('optionSku')[index]).trim().toUpperCase()
              )?.id
          }
        : {}),
      name: formText(value).trim(),
      sku: formText(data.getAll('optionSku')[index]).trim(),
      priceMillimes: Math.round(Number(data.getAll('optionPrice')[index]) * 1000),
      ...(data.getAll('optionOldPrice')[index]
        ? {
            compareAtPriceMillimes: Math.round(Number(data.getAll('optionOldPrice')[index]) * 1000)
          }
        : {}),
      stockQuantity: Number(data.getAll('optionStock')[index]),
      lowStockThreshold: 3
    }));
    if (
      additionalVariants.some(
        (v) => v.compareAtPriceMillimes !== undefined && v.compareAtPriceMillimes <= v.priceMillimes
      )
    )
      return setError('Le prix avant promotion de chaque option doit dépasser son prix de vente.');
    if (promotionEnabled && !promotionValid)
      return setError('Indiquez un prix promotionnel inférieur au prix avant promotion.');
    setSubmitting(true);
    try {
      const saved = await apiRequest<{
        id: string;
        variantIds?: Array<{ id: string; sku: string }>;
      }>(savedId.current ? `/admin/products/${savedId.current}` : '/admin/products', {
        method: savedId.current ? 'PUT' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          categoryId: data.get('categoryId'),
          name,
          slug: data.get('slug') || product?.slug || toSlug(name),
          description: data.get('description'),
          status: data.get('visibility'),
          sku: data.get('sku'),
          variantName: data.get('variantName'),
          warranty: data.get('warranty'),
          specifications,
          additionalVariants,
          priceMillimes: Math.round(Number(promotionEnabled ? salePrice : regularPrice) * 1000),
          ...(promotionEnabled
            ? { compareAtPriceMillimes: Math.round(Number(regularPrice) * 1000) }
            : {}),
          stockQuantity: Number(data.get('stock')),
          lowStockThreshold: Number(data.get('lowStock'))
        })
      });
      savedId.current = saved.id;
      savedVariants.current = saved.variantIds ?? [];
      for (const id of removedImages) {
        await apiRequest(`/admin/products/${saved.id}/images/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        setRemovedImages((current) => current.filter((value) => value !== id));
      }
      setRemovedImages([]);
      for (const image of images) {
        if (uploadedIds.current.has(image.id)) continue;
        const encoded = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(formText(reader.result).split(',')[1]!);
          reader.onerror = () => reject(new Error('Lecture de la photo impossible'));
          reader.readAsDataURL(image.file);
        });
        await apiRequest(`/admin/products/${saved.id}/images`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ data: encoded, alt: name })
        });
        uploadedIds.current.add(image.id);
      }
      router.push('/admin/produits?created=1');
      router.refresh();
    } catch (reason) {
      setError(
        `${savedId.current && images.length ? 'Le produit est enregistré ; vérifiez les photos puis réessayez. ' : ''}${reason instanceof Error ? reason.message : 'Le produit n’a pas pu être enregistré.'}`
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <>
      <form className="admin-editor" onSubmit={(event) => void submit(event)}>
        {error ? (
          <div className="admin-image-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="admin-editor-main">
          <section className="admin-panel admin-form-section">
            <header>
              <div>
                <h2>
                  <AdminIcon name="products" /> Informations principales
                </h2>
                <p>Les informations visibles par les clients.</p>
              </div>
            </header>
            <div className="admin-form-grid">
              <label className="full-field">
                Nom du produit
                <input
                  name="name"
                  defaultValue={product?.name ?? ''}
                  placeholder="Ex. Smartphone Nova X12 5G"
                  required
                />
              </label>
              <label>
                Adresse du produit (slug)
                <input
                  name="slug"
                  defaultValue={product?.slug ?? ''}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="Ex. samsung-a55 (généré si vide)"
                />
              </label>
              <label>
                Catégorie
                <select
                  name="categoryId"
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  required
                  disabled={!categories.length}
                >
                  <option value="">Sélectionner une catégorie</option>
                  {categories.map((category) => (
                    <option value={category.id} key={category.id}>
                      {category.name}
                      {category.isVisible === false ? ' — masquée dans la boutique' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Référence interne
                <input
                  name="sku"
                  defaultValue={product?.variant.sku ?? ''}
                  placeholder="Ex. NOVA-X12-256"
                  required
                />
              </label>
              <label className="full-field">
                Description
                <textarea
                  name="description"
                  rows={5}
                  defaultValue={product?.description ?? ''}
                  placeholder="Décrivez simplement les avantages et caractéristiques du produit."
                  required
                />
              </label>
            </div>
          </section>
          <section className="admin-panel admin-form-section">
            <header>
              <div>
                <h2>
                  <AdminIcon name="stock" /> Prix et stock
                </h2>
                <p>Utilisez trois décimales pour les montants en dinars.</p>
              </div>
            </header>
            <div className="admin-form-grid">
              <label>
                {promotionEnabled ? 'Prix avant promotion (DT)' : 'Prix de vente (DT)'}
                <input
                  name="price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.001"
                  max="100000"
                  value={regularPrice}
                  onChange={(event) => setRegularPrice(event.target.value)}
                  required
                />
              </label>
              <label>
                Quantité en stock
                <input
                  name="stock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  defaultValue={product?.variant.stockQuantity ?? 0}
                  required
                />
              </label>
              <label>
                Alerte de stock faible
                <input
                  name="lowStock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  defaultValue={product?.variant.lowStockThreshold ?? 3}
                  required
                />
              </label>
            </div>
          </section>
          <AdminProductOptions product={product} />
          <section className="admin-panel admin-form-section">
            <h2>Caractéristiques et garantie</h2>
            <label>
              Caractéristiques
              <textarea
                name="specifications"
                rows={5}
                maxLength={10000}
                defaultValue={product?.specifications
                  ?.map((s) => `${s.label} : ${s.value}`)
                  .join('\n')}
                placeholder={'Écran : 6,5 pouces\nStockage : 256 Go'}
              />
              <small>Une ligne « Nom : Valeur » par caractéristique (30 maximum).</small>
            </label>
            <label>
              Garantie
              <textarea
                name="warranty"
                maxLength={500}
                rows={2}
                defaultValue={product?.warranty ?? ''}
                placeholder="Indiquez uniquement la garantie réellement proposée."
              />
            </label>
          </section>
          <section className="admin-panel admin-form-section admin-promotion-section">
            <header>
              <div>
                <h2>
                  <AdminIcon name="products" /> Promotion du produit
                </h2>
                <p>Une remise claire, visible sur la fiche et dans le catalogue.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={promotionEnabled}
                aria-label="Activer la promotion"
                className="admin-promotion-switch"
                disabled={submitting}
                onClick={() => setPromotionEnabled((value) => !value)}
              >
                <span aria-hidden="true" />
                {promotionEnabled ? 'Activée' : 'Désactivée'}
              </button>
            </header>
            {promotionEnabled ? (
              <>
                <div className="admin-form-grid">
                  <label>
                    Prix promotionnel (DT)
                    <input
                      name="salePrice"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      max="100000"
                      step="0.001"
                      required
                      value={salePrice}
                      onChange={(event) => setSalePrice(event.target.value)}
                      placeholder="Ex. : 899.000"
                    />
                    <small>Doit être inférieur au prix avant promotion indiqué plus haut.</small>
                  </label>
                  <div className="admin-promotion-preview" aria-live="polite">
                    <span>Aperçu de l’offre</span>
                    {promotionValid ? (
                      <>
                        <ProductPromotion
                          price={Number(salePrice)}
                          oldPrice={Number(regularPrice)}
                        />
                        <ProductPrice price={Number(salePrice)} oldPrice={Number(regularPrice)} />
                      </>
                    ) : (
                      <p>Renseignez deux prix valides pour afficher la remise.</p>
                    )}
                  </div>
                </div>
                <p className="admin-settings-note">
                  <AdminIcon name="shield" />
                  Le pourcentage est calculé automatiquement. Le panier et la commande utilisent le
                  prix promotionnel.
                </p>
              </>
            ) : (
              <p>Activez la promotion pour proposer un prix réduit sur cet article.</p>
            )}
            <p className="field-help">
              En désactivant la promotion puis en enregistrant, le prix avant promotion redevient le
              prix de vente. Utilisez uniquement un prix de référence réel.
            </p>
          </section>
          <section className="admin-panel admin-form-section">
            <header>
              <div>
                <h2>
                  <AdminIcon name="image" /> Photos
                </h2>
                <p>
                  Ajoutez des images nettes sur fond clair. La première sera l’image principale.
                </p>
              </div>
            </header>
            <label className="admin-upload" htmlFor="product-images">
              <span>＋</span>
              <strong>Ajouter des photos</strong>
              <small>JPG, JFIF, PNG ou WebP · 5 Mo maximum · 8 photos</small>
              <input
                id="product-images"
                className="sr-only"
                type="file"
                accept="image/jpeg,.jpg,.jpeg,.jfif,image/png,.png,image/webp,.webp"
                multiple
                aria-describedby="product-images-help"
                onChange={selectImages}
              />
            </label>
            <p className="field-help" id="product-images-help">
              Les photos sont envoyées à l’enregistrement. La première photo est l’image principale.
              Les fichiers locaux restent utilisés si aucune photo n’est enregistrée.
            </p>
            {storedImages.map((photo, index) => (
              <div className="saved-photo" key={photo.id}>
                <AdminSavedImage id={photo.id} alt={photo.alt || 'Produit'} />
                <span>
                  Photo enregistrée {index + 1} — {photo.alt || 'Produit'}
                </span>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setStoredImages((current) => current.filter((item) => item.id !== photo.id));
                    setRemovedImages((current) => [...current, photo.id]);
                  }}
                >
                  Retirer à l’enregistrement
                </button>
              </div>
            ))}
            {imageError ? (
              <p className="admin-image-error" role="alert">
                {imageError}
              </p>
            ) : null}
            {images.length > 0 ? (
              <div className="admin-image-grid" aria-label="Photos sélectionnées">
                {images.map((image, index) => (
                  <article className="admin-image-preview" key={image.id}>
                    <div className="admin-image-frame">
                      {/* Browser-generated blob URL; files are not uploaded at this stage. */}
                      <img src={image.url} alt={`Aperçu de ${image.file.name}`} />
                      {index === 0 ? <span>Image principale</span> : null}
                    </div>
                    <div>
                      <strong title={image.file.name}>{image.file.name}</strong>
                      <small>{(image.file.size / 1024 / 1024).toFixed(2)} Mo</small>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImage(image)}
                      aria-label={`Supprimer ${image.file.name}`}
                    >
                      Supprimer
                    </button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
        <aside className="admin-editor-aside">
          <section className="admin-panel admin-form-section">
            <header>
              <div>
                <h2>
                  <AdminIcon name="eye" /> Publication
                </h2>
              </div>
            </header>
            <label>
              Visibilité
              <select name="visibility" defaultValue={product?.status ?? 'draft'}>
                <option value="draft">Brouillon — invisible</option>
                <option value="published">Publié — visible</option>
              </select>
            </label>
            <p className="field-help">
              Enregistrez en brouillon si les informations ou photos ne sont pas prêtes.
            </p>
          </section>
          <div className="admin-sticky-actions">
            <button
              className="admin-primary-button"
              type="submit"
              disabled={submitting || !categories.length}
            >
              {submitting
                ? 'Enregistrement…'
                : mode === 'create'
                  ? 'Créer le produit'
                  : 'Enregistrer les modifications'}
            </button>
            <Link className="admin-secondary-button" href="/admin/produits">
              Annuler
            </Link>
          </div>
        </aside>
      </form>
      {product && <AdminAccessories id={product.id} />}
    </>
  );
}
