# Electro Dougaz

## Sales, promotions and cash-on-delivery management

Admin layout standard: report fields use intrinsic-height labels and 46px controls; helper text
must never stretch neighbouring inputs or buttons. Reports and promotion forms have a separate
action row with compact desktop buttons and full-width phone actions. Promotion previews reuse
the existing theme, while sales cards use explicit responsive columns. Browser regression tests
check control height/width and overflow from 320px through 1920px in both themes.

Apply the centralized migrations with `pnpm db:migrate`, then restart the API and web server.
The new `/admin/rapports`, `/admin/promotions` and `/admin/historique` pages are linked in the sidebar.

- Reports aggregate **all matching orders**, independently of the 50-row order-list page.
  Filters support Tunisia-local inclusive dates, order/first-delivery/first-collection date,
  order and collection status, payment method, governorate, product, category, reference/phone.
  Product/category filters select whole orders containing matching items, not just matching line totals.
  Amounts include delivery. Delivered sales exclude returned/cancelled orders. Profit is not calculated.
  Current payment balances belong to the selected order cohort; they are **not bank cash flows within
  the selected period**. Daily charts show order values by the selected date, up to 366 days.
- Order details contain an append-only COD ledger: courier collection, receipt by the shop, and
  refunds out of shop receipts. Owner/manager permission is required for writing. Partial movements
  are supported; amounts cannot exceed the available balance. Row locking and unique retry keys
  prevent duplicate or excess payments. Notes identify the actual payment evidence. Recording a
  delivery never automatically records cash. Online-card reconciliation is deliberately rejected.
  Existing historical `paid` flags are not silently converted into ledger entries: reconcile them
  against actual evidence before using the new collection reports.
- CSV export is explicitly **the current filtered page (50 orders maximum)**, UTF-8, with spreadsheet
  formula injection protection. Order summaries and delivery notes use the browser print dialog's
  Save as PDF option. They are not fiscal invoices or automatic payment receipts.
- Activity history records actor and Tunisia-local timestamps. Product edits now record before/after
  variant prices/stock, stock adjustments record before/after quantities, and promotions/payments/
  accessory selections are audited. Old audit rows cannot reconstruct details that were not recorded.
- Promotion dates apply to all discounted options on the product: start inclusive, end exclusive.
  Empty boundaries mean no corresponding limit. Server/database time determines the effective price
  on catalogue, product detail, quote and checkout; inactive offers use the original price. No cron
  job or invented countdown is involved. Existing orders keep their original price snapshots.
- The homepage highlights available real offers. Product cards/details show percentage, crossed-out
  original price and savings. Recently viewed items store only up to five product slugs locally, can
  be cleared, and are refetched for current prices/visibility. No account or customer data is stored.
  Related products are category suggestions, not compatibility guarantees. Compatible accessories
  are explicitly selected (maximum eight) by a manager on an existing product's edit page; staff must
  verify compatibility. Hidden/draft accessory products never appear publicly.
- Mobile product pages include a price/quantity-navigation bar using the selected option, preserving
  the existing quantity picker and stock checks. No duplicate add action bypasses option selection.

Verification: `pnpm --filter @electro/api test:flow` uses a disposable PostgreSQL schema and exercises
real payments, retry protection, promotion pricing/schedules, reports and Tunisia date boundaries.
`pnpm --filter @electro/web exec playwright test commerce-management.spec.ts shopping-features.spec.ts`
checks phone/tablet/desktop light/dark layouts, CSV downloads, payment entry and printable documents
using isolated browser fixtures (not real customer payments). Unit tests cover amount/date validation,
CSV safety, promotion states and recent-history sanitization.

Before production: add tested backups and restore drills for PostgreSQL/media, error monitoring,
formal invoice requirements, accounting reconciliation/correction procedures and courier settlement
integration. Financial entries currently cannot be edited/deleted from the UI; investigate mistakes
and use an audited reconciliation procedure, never disguise a correction as a customer refund.

### Saving the guest order reference

After checkout, a dedicated confirmation screen asks customers to copy their reference
before enabling tracking/home navigation. No email or SMS is sent. Clipboard failures
offer manual copying or a screenshot followed by an explicit saved-reference confirmation.
The screen requests a browser unload warning while unsaved; browser back, closing and
reload cannot be reliably blocked on every device. No customer details are persisted
by this reminder. The order remains recorded regardless of clipboard success.

Production-oriented foundation for a Tunisian electronics e-commerce platform with online payment, cash on delivery, product variants, inventory, order management, and a protected administration area.

## Architecture

The project starts as a modular monolith. This keeps deployment and operations affordable while preserving boundaries that can be scaled independently later.

```text
Browser
  -> Nginx / WAF
     -> Next.js storefront + admin
     -> NestJS API
        -> PostgreSQL
        -> background worker
        -> local media adapter (S3-compatible adapter later)
        -> ClicToPay adapter (production credentials supplied by merchant)
```

### Workspace layout

```text
apps/
  api/                 NestJS/Fastify HTTP API
  web/                 Next.js storefront and protected admin UI
  worker/              NestJS background-process entry point
  shared/migrations/   centralized SQL database migrations
packages/
  contracts/           shared validated API contracts
  database/            PostgreSQL connection and migration tooling
infrastructure/
  nginx/               reverse-proxy configuration
public/logo/            client-provided source logo assets
```

Database schema changes must always be added to `apps/shared/migrations`. Sensitive data, payment credentials, and production secrets must never be committed.

## Prerequisites

- Node.js 20.9 or newer
- pnpm 10
- Docker with Compose

## Local development

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm db:migrate
pnpm --filter @electro/api admin:create
pnpm dev
```

Copy `.env.example` to `.env` first, then set `DATABASE_URL`, `ADMIN_EMAIL`, and a unique `ADMIN_PASSWORD` containing at least 12 characters. If PostgreSQL already runs locally, you can skip `pnpm infra:up`; create the `electro_dougaz` database and ensure the account in `DATABASE_URL` owns it.

The checked-in example matches the local Docker Compose database (`electro` / `local-development-only`) and resolves migrations and media relative to their package working directories. These credentials are development-only and must be replaced with secret-managed values in every deployed environment. The real `.env` is ignored by Git.

The PostgreSQL 18 container mounts its named volume at `/var/lib/postgresql`, allowing the image to manage its major-version-specific data directory. Do not change this back to `/var/lib/postgresql/data`; upgrades require an explicit backup/restore or `pg_upgrade` procedure.

Services:

- Storefront/admin: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- API documentation: `http://localhost:4000/docs`
- Health endpoint: `http://localhost:4000/api/v1/health`
- Database readiness: `http://localhost:4000/api/v1/health/ready`
- Swagger API reference: `http://localhost:4000/docs`

## Implemented API foundation

- Database-backed administrator login, hashed/revocable bearer sessions, logout, and current-user lookup.
- Public categories, product search/detail, idempotent checkout, and private order tracking by reference plus phone.
- Authenticated product/category management, inventory corrections with audit history, order search/detail, and validated status transitions.
- Transactional stock reservation during checkout and automatic stock release when an eligible order is cancelled.
- Integer millimes for all monetary values; prices supplied by the browser are ignored and recalculated from PostgreSQL.

The NestJS API imports the `pg` driver directly because it runs as CommonJS in development. The `@electro/database` package remains responsible for migration tooling; do not expose its raw ESM TypeScript source as a CommonJS runtime dependency.

Swagger is hosted by the Fastify adapter and therefore requires the API's explicit `@fastify/static` runtime dependency; production smoke tests must start the compiled process in addition to running TypeScript checks.

Create orders with a new UUID in the `Idempotency-Key` header. Admin requests use `Authorization: Bearer <token>` returned by `POST /api/v1/admin/auth/login`. The `online_card` checkout path is disabled and returns HTTP 400 until bank integration is ready. A verified ClicToPay server callback and payment-session adapter are still required before enabling online payment in production.

## Quality gates

Run these before opening a merge request:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Deployment baseline

The initial production target is one Linux VPS with Nginx and Docker Compose. PostgreSQL is private and is never exposed through Nginx. Product media uses a persistent volume initially; the storage interface will allow migration to Tunisian S3-compatible object storage later.

Production requires off-server encrypted backups, tested restoration, WAF/anti-DDoS protection, monitoring, admin MFA, and merchant-owned ClicToPay credentials.

## Storefront UI standards

- The brand system uses the client-provided indigo-blue and crimson-red logo palette through shared CSS tokens.
- The header uses the enhanced transparent `public/logo/logo-enhanced.png` asset; retain the original JPEG as its source reference.
- Render the wide logo at its native approximate 2:1 aspect ratio on a contrast-safe surface; never force it into a square container.
- Shared cart controls own their complete layout and hide the quantity badge when empty, so nested page headers cannot expose raw or misleading values.
- Footer branding reuses the primary logo, brand palette, trust indicators, and accessible high-contrast navigation in both color schemes.
- Product discovery is search-first, with category shortcuts and a direct path to current offers.
- Interactive targets are at least 44px, mobile navigation respects bottom safe areas, and layouts support small phones through desktop screens.
- New screens must support light and dark color schemes, visible focus states, reduced motion, and explicit loading, empty, error, and success states where data is involved.
- Business and authorization rules remain in the API; hiding an admin control in the UI never replaces server-side permission checks.

## Implemented storefront journey

The responsive guest-shopping UI currently includes:

- Search results and category catalogues, including explicit empty states.
- Product detail pages with specifications, availability, add-to-cart, and direct checkout actions.
- A browser-persisted guest cart, quantity editing, order summary, and responsive checkout form.
- Cash-on-delivery and ClicToPay choices. ClicToPay redirection is intentionally a UI placeholder until the merchant credentials and server API are connected; card details are never collected by this application.
- Order tracking UI, delivery/returns guidance, contact routing, legal-content placeholders, and loading/error/not-found states.
- A compact footer with shopping, support, tracking, and legal navigation.

Primary routes are `/recherche`, `/categories/[slug]`, `/produits/[slug]`, `/panier`, `/commande`, and `/suivi-commande`. The homepage, search, category pages and product details read published products from the API with caching disabled. Legal text and merchant contact details are visibly marked for client validation before production.

## Administration workspace

The responsive administration workspace starts at `/admin/connexion`. It is designed for daily use by non-technical store staff and includes:

- An action-oriented dashboard with daily indicators, low-stock warnings, recent orders, and prioritized tasks.
- Searchable and filterable order management with a clear status workflow and payment visibility.
- Product listing, guided creation/editing, draft publishing, prices, inventory thresholds, and image selection.
- Product photos accept JPEG/JPG/JFIF, PNG, and WebP (5 MB each, eight per product). The authenticated upload API decodes files, limits decoded pixels, rejects animated/unsupported files, strips metadata, and stores optimized WebP images. Draft images require admin authentication.
- Fast stock correction, category organization, and store/payment/delivery settings.
- Desktop sidebar, tablet drawer, mobile safe-area navigation, light/dark themes, accessible touch targets, and explicit success/empty states.

Administrator login/logout, product creation/editing/listing, category creation, inventory adjustment, dashboard summaries, order lists/details/status updates and customer tracking use the database-backed API. Drafts remain admin-only; published products appear on all storefront catalogue pages. Store settings are editable by the owner; other staff see public settings read-only. The Équipe page and navigation entry have been removed; existing administrator accounts and server-side role permissions are unchanged. Selected photos are uploaded on save; local public/products files remain a fallback. Before production, MFA, account recovery, durable shared media storage/backups, and complete role-aware UI handling are still required. ClicToPay credentials must remain in server-side secret storage and must never be exposed to the browser or committed to source control.

For the current local prototype the bearer token is kept in `sessionStorage`, so it is cleared when the browser session ends. Production must move the admin session to a secure, `HttpOnly`, `SameSite` cookie with CSRF protection; browser JavaScript must not receive long-lived administrator credentials.

## Local cash-on-delivery test flow

The header and mobile cart controls open an accessible modal drawer without changing the
current URL. Customers can change quantities, remove items, review the subtotal, and close
the drawer to continue browsing. Checkout still navigates to `/commande`. The direct
`/panier` route remains available for existing bookmarks. The drawer uses native dialog
focus containment, Escape dismissal, backdrop dismissal on wider screens, body-scroll
locking, safe-area spacing and reduced-motion support; it shares the existing persisted cart.

Storefront product cards display a prominent **Disponible** or **Rupture de stock** badge
over the image; product details use the same badge without displaying inventory counts.
Availability is based on the current product stock (> 0). Sold-out purchase controls remain
disabled. Admin inventory quantities and customer purchase-quantity selection are unchanged.
This is presentation-only: stock quantities are still used by cart limits and API validation.
For the optional read-only catalogue browser check, start the local API with at least one
published product, build the web app, set `TEST_LIVE_CATALOG=1`, then run
`pnpm --filter @electro/web exec playwright test availability.spec.ts`. It checks badges on
phone/desktop layouts in both themes without changing products or stock.

Product details include a quantity selector and selected subtotal. Both “Ajouter au panier” and
“Acheter maintenant” add the selected number of units. The selector accounts for units already
in the cart and respects available stock and the API limit of 10 units per reference per order.
Quantities remain editable in the cart; checkout still validates current stock on the server.

Start PostgreSQL with `pnpm infra:up`, then apply existing migrations with `pnpm db:migrate`.
Run `pnpm --filter @electro/api dev` and `pnpm --filter @electro/web dev` in separate terminals.
Restart both after pulling changes. Admin credentials are the values used with `admin:create`;
editing the environment file alone does not reset an existing account password.

1. Sign in at /admin/connexion and edit or create a product with a positive stock quantity.
2. Set visibility to **Publié — visible**, then save. Keep the slug shown in the edit form.
3. Select photos in the product editor and save. Reopen the editor to verify persisted thumbnails.
   Published photos appear in listings, the product gallery and the cart. With no uploaded images,
   **public/products/<slug>.jpg** (also .jpeg, .jfif, .png, .webp) remains a local fallback;
   filenames must use lowercase slugs. Missing fallback images display the shop logo.
4. Visit /, /categories/smartphones, /recherche, and the product detail. Drafts and hidden categories are not public.
5. Add to the cart, enter delivery details at /commande, and choose cash on delivery.
   The API calculates prices and delivery charges; the UI shows the real order reference only after success.
   Failed requests keep the cart. Retries reuse an idempotency key; concurrent requests reserve stock once.
6. Open /admin/commandes, then confirm → prepare → ship → deliver the order.
   /suivi-commande requires the reference and matching phone number.
   Delivery status does not assert that cash was collected; payment remains non-encashed until a separate reconciliation workflow is implemented.
7. Test another order and cancel it before shipping. Its reserved stock is restored once.
   Check /admin/stock and its audited correction form.
8. Verify sold-out products, insufficient stock, invalid transitions, incorrect tracking phone,
   duplicate SKU/slug, API unavailable, expired login, and logout.

The cart storage version was advanced to discard obsolete demo product IDs. Reload the page and
add products again if you had an old demo cart. The API supports one default variant per product
in the current editor; advanced option/variant management remains outside this local test flow.

### Admin design and browser audit

#### Guided stock management

`/admin/stock` includes stock-health counters, name/SKU search, availability filters, and
per-product adjustment shortcuts. Choose **Ajouter du stock** or **Retirer du stock**, then enter
a positive quantity. The interface previews the resulting stock and blocks invalid quantities
and removals larger than the displayed availability. The server remains authoritative when
orders change stock concurrently. A successful adjustment updates the table from the returned
quantity without a second write or a potentially misleading refresh failure.

The former **Motif** field is now **Pourquoi modifiez-vous le stock ?**, with understandable
reasons (supplier delivery, damaged item, loss, counting correction, etc.) and optional details.
**Autre raison** requires details. The reason and details are stored in the existing stock
movement record. No schema change is needed. Orders already reserve stock automatically;
do not manually remove stock again for a website order. Regression tests cover additions,
removals, over-removal, reasons, search and failed saves.

#### Editable store settings

Apply `pnpm db:migrate` before starting the updated API. The additive migration
`apps/shared/migrations/20261020010000_store_settings.sql` creates a singleton settings row.
Until the first save, delivery fees retain the `DELIVERY_FEE_MILLIMES` environment default.
After saving, the database is authoritative; changing the environment no longer overrides it.

At `/admin/parametres`, owners can edit phone, WhatsApp (international digits without `+`),
public email, address, opening hours, delivery fee in DT, estimated delivery time, and a private
notification email. The page provides section navigation, a live preview, save/cancel controls,
unsaved-change feedback, light/dark themes, and responsive layouts. Other roles cannot edit or
retrieve the private settings endpoint. Public contact details appear on `/contact`; delivery
information appears on `/livraison` and the saved fee is used by checkout and new orders.
Previously created orders retain their original delivery charge.

`GET /api/v1/settings` returns only public fields. Owner-only `GET/PUT /api/v1/admin/settings`
validates updates and uses a revision to reject stale saves with HTTP 409. On conflict, copy any
unsaved changes before reloading. Writes record the actor and revision in `audit_logs` in the
same transaction. No notification email is included in public responses or audit metadata.

**Email delivery is not connected:** the notification address is stored, but no automatic email
is sent. A server-side email provider and reliable delivery/retry processing are still required.
Payment credentials and ClicToPay activation remain outside this page.

Regression coverage includes save/cancel/conflict/read-only UI tests and isolated PostgreSQL
flow tests for permissions, validation, persistence, privacy, stale saves, auditing, and new
versus existing order delivery fees. The flow runner applies all centralized migrations to its
temporary schema and never writes test settings into the real shop.

#### Responsive browser checks

The admin login displays the logo and Electro Dougaz together on one line at desktop and
mobile sizes. The promotional headline and introductory paragraph were removed; the feature
list and login form remain, with “Se connecter” as the page heading.

The admin workspace uses shared, scoped styles in `apps/web/src/app/admin.css`:
consistent panel spacing, responsive table cards, icon-led actions, a mobile navigation
drawer with focus trapping and Escape dismissal, and light/dark themes. Subtle transitions
respect reduced-motion preferences. Product, order, stock, category and settings
screens share the same controls and spacing; unavailable backend features remain explicit.

Run the visual/interaction audit separately from the development server:

```powershell
pnpm --filter @electro/web exec playwright install chromium
pnpm --filter @electro/web build
pnpm --filter @electro/web test:ui
```

The audit starts an isolated production server on port 3100 (leave this port free).
It intercepts API calls with synthetic fixtures: it does not create products, modify orders,
or use real administrator credentials. It checks all 10 admin routes at 360, 768, 1024 and
1440 pixels in both themes for overflow, clipped controls, touch-target size and browser
errors, plus keyboard navigation, password visibility, landscape form actions and order
failure states. Screenshots are written to
`apps/web/test-results`; the report is in `apps/web/playwright-report`. These Chromium
checks supplement, rather than replace, real-device and live API acceptance testing.

### Product promotions

In **Produits → Ajouter / Modifier**, enable **Promotion du produit**, enter the original
price and a lower promotional price, then save. A live preview shows the calculated discount.
Public product cards and detail pages display a red percentage badge, the crossed-out
original price and the sale price. Discounts are rounded down to one decimal place to avoid
overstating savings. Use a genuine reference price.

The cart and server-side checkout use the promotional price; existing orders keep their
recorded prices. Disable the promotion and save to restore the original price. Promotions
remain active until manually disabled (no scheduled expiry). Existing price fields are reused;
no database migration is required. The footer help/contact strip has been removed.

### Extended guest shopping experience

- `/recherche`, categories and `/promotions` share server-side price/category/availability/promotion
  filters, sorting, reset controls and pagination (24 products per page). Filters match a single
  active option, not unrelated prices/stock from different options. Cards link to the displayed option.
- Admin product editing supports a primary option and up to 19 additional combinations, each with
  its own SKU, price, optional promotion and stock. Removing an option deactivates it without deleting
  order history. Customers select a combination before purchase; cart lines are separate by option.
- Specifications use one `Label : Value` per line. Warranty text must reflect the actual offer.
  Product details show configured delivery estimates, payment availability and return-policy links.
- Galleries have thumbnails and a keyboard-dismissable zoom dialog. Uploads are sent individually
  after the product save; failures are shown explicitly and identical image retries are deduplicated.
  Removing an image removes its database association, not its retained file. There is no automatic
  orphan-file cleanup; arrange retention-aware housekeeping and backups before production.
- Checkout validates delivery fields inline, supports all 24 governorates, fetches a fresh server quote,
  and rejects a changed total at confirmation. Requests retain their idempotency key for network retries.
  The success screen offers reference copying; no customer account is created.
- Tracking uses reference plus phone and exposes only status/history, not the address or customer
  name. New references contain 96 random bits. PostgreSQL-backed throttling permits 10 requests per
  IP per minute. Behind a proxy, configure trusted client-IP handling deliberately; do not blindly
  trust forwarded headers. Statuses are admin updates, not live courier locations or SMS notifications.

Apply `pnpm db:migrate` before starting the updated API (new migration:
`apps/shared/migrations/20261021010000_product_details.sql`). `MEDIA_ROOT` is the image storage directory
resolved from the API working directory; the example uses `../../media-data`. Use an absolute path
and a persistent backed-up volume in production. `MEDIA_DIRECTORY` is an optional override used by
isolated tests. With `MEDIA_DRIVER=local` (the default), image bytes stay on disk, while PostgreSQL
stores image references and metadata. Multi-instance deployments must use shared storage or the
Cloudinary adapter described below; never rely on an ephemeral host's disk for uploaded photos.
The API JSON request limit is 8 MB to accommodate a single base64-encoded 5 MB image; configure the
reverse proxy accordingly and enforce HTTPS and upstream request limits in production.

### Cloudinary product images (free-hosting test deployment)

Set these **backend-only** environment variables in Render's Environment settings:

```dotenv
MEDIA_DRIVER=cloudinary
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
```

Replace placeholders privately with credentials from Cloudinary Settings > API Keys. URL-encode
credential characters if needed. Never commit the real URL, put it in `.env.example`, add a
`NEXT_PUBLIC_` prefix, or expose it in screenshots/logs. Keep local `.env` on `MEDIA_DRIVER=local`
unless deliberately testing Cloudinary. No unsigned upload preset or frontend credential is needed.
The API fails startup for an unknown driver, malformed URL or missing Cloudinary configuration.

- The existing manager-only upload endpoint validates/normalizes JPG/JFIF/PNG/WebP to metadata-free,
  bounded WebP before sending a signed HTTPS upload to Cloudinary. SVG and animated files stay rejected.
- Files use authenticated delivery, not public Cloudinary URLs. The existing API reads the bytes
  only after checking product/category visibility (or admin authentication), using a short-lived
  signed download URL that never reaches the browser. Draft/hidden images remain protected; image
  responses remain `no-store`. This intentionally uses API bandwidth and Cloudinary authenticated
  downloads (no CDN caching; Cloudinary documents double bandwidth usage for these downloads).
  Monitor both providers' allowances; this prioritizes existing privacy behavior for the test phase.
- Provider calls have 20-second timeouts, fixed HTTPS destinations, no redirects, bounded download
  size and sanitized errors. Credentials and upstream error bodies are not returned or logged.
- Content-hash keys and non-overwriting uploads make retries safe. A product-row lock serializes
  uploads/limit checks; it may be held for the provider timeout. Eight photos per product remain
  the limit. Failed storage writes do not create image associations. A successful upload followed
  by a database failure can leave an unlinked asset; arrange retention-aware housekeeping later.
- PostgreSQL `object_key` stores `cloudinary:<sha256>.webp` for remote files; old hash-only keys
  continue to use local disk. **No schema migration is required for this adapter.** Switching drivers
  does not transfer old images. For the new hosted test shop, re-upload photos through its admin UI.
  Keep the same Cloudinary product environment across redeployments. Local records still need their
  original files; switching back to local does not download remote assets automatically.
- Removing a photo unlinks its database association only; the stored asset is retained for recovery,
  just like local files. Do not bulk-delete Cloudinary assets without checking DB references/backups.

Verification (no live Cloudinary account used by automated tests):

```powershell
pnpm --filter @electro/api test
pnpm --filter @electro/api typecheck
pnpm --filter @electro/api build
pnpm --filter @electro/api test:flow
```

`test:flow` requires local PostgreSQL and forces local media storage in an isolated schema/temp
directory; it never uploads to Cloudinary. Mocked adapter/service tests cover signing, privacy gates,
retries, persistence across instances, validation, remote failures and credential redaction.
After setting real secrets, smoke-test the hosted service: upload a draft photo (admin preview works,
public image endpoint returns 404), publish and view it in the shop, restart/redeploy the API and
check it again, then hide/remove it and confirm the public endpoint returns 404. Confirm no provider
secret or signed Cloudinary URL appears in browser responses. Live provider verification requires
your configured account; mocked tests cannot establish that the account credentials/quotas work.

`API_INTERNAL_BASE_URL` optionally overrides the server-side API address. Browser requests still use
`NEXT_PUBLIC_API_BASE_URL`; neither value contains credentials. UI tests run a synthetic catalogue
server on port 4101 and Next.js on port 3100, without modifying shop records. Keep both ports free.
Use `TEST_LIVE_CATALOG=1` only for the existing opt-in live catalogue check.

```powershell
pnpm --filter @electro/web test
pnpm --filter @electro/api test
pnpm --filter @electro/api test:flow
pnpm --filter @electro/web build
pnpm --filter @electro/web exec playwright test shopping-features.spec.ts
```

The expanded isolated API flow covers option CRUD/stock, server quotes, stale-total rejection,
promotion filters, upload validation/persistence/draft privacy, image removal and tracking throttling.
Browser journeys cover gallery selection/zoom, sold-out options, checkout errors/confirmation,
filters and tracking at 360, 768 and 1440 pixels in both themes. Real-device and courier/bank acceptance
testing are still needed before launch.

### Regression commands

Browser requests use the explicit CORS policy in `apps/api/src/config/cors.ts`.
`CORS_ORIGINS` must list the frontend origins (including the port). The policy allows
PUT for product edits and PATCH for order status/stock updates, as well as the authorization,
JSON and idempotency headers. Restart the API after changing this configuration.
The API tests include real Fastify preflight checks and rejection of untrusted origins;
HTTP-only flow tests do not by themselves verify browser CORS behavior.

```powershell
pnpm --filter @electro/web test
pnpm --filter @electro/api test
pnpm --filter @electro/api test:flow
```

The opt-in `test:flow` command builds the API and runs real HTTP-handler/database checks using a
random `commerce_test_<uuid>` PostgreSQL schema on localhost. It creates its own administrator,
products and orders, then drops only that test schema. Shop data is untouched. The local database
user needs permission to create/drop a schema. Tests cover authorization, draft/publish/edit,
search/category/detail, totals, concurrent idempotency, stock reservation, order processing,
tracking privacy, cancellation, stock adjustments, categories and logout.
