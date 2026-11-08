# Architecture decisions

## Modular monolith first

The storefront and administration UI share one Next.js deployment. Business rules live in a NestJS API organized by domain modules. PostgreSQL is the system of record. This avoids premature distributed-system complexity while allowing the API, worker, database, and media storage to scale separately.

Planned API modules are authentication, catalogue, inventory, cart, orders, payments, shipping, promotions, customers, notifications, and audit.

## Boundary rules

- UI code never talks directly to PostgreSQL.
- Payment providers are adapters behind a provider-neutral interface.
- Only verified server-to-server payment results may mark an order paid.
- Inventory changes and order transitions use database transactions and idempotency keys.
- Raw card data is never accepted, logged, or persisted.
- Media binaries stay outside PostgreSQL; the database stores stable object keys and metadata.
- Admin authorization is enforced by the API, not merely by hidden UI controls.
- Logs exclude secrets, authentication tokens, customer addresses, and payment payloads.

## Scaling sequence

1. One VPS: Nginx, web, API, worker, and private PostgreSQL.
2. Move PostgreSQL and media storage to dedicated services.
3. Add Redis only when distributed caching or queues are justified.
4. Add application replicas and a load balancer after measuring sustained demand.

Kubernetes and microservices are intentionally excluded from the initial architecture.
