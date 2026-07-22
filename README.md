# Stockroom - Tier 3 Warehouse Routing Engine

A complete Tier 3 submission for the developer assessment brief. Stockroom is a full-stack Next.js warehouse app with authentication, inventory management, concurrency-safe order fulfillment, and a capacity-aware delivery rate optimizer.

## What is included

- End-to-end sign-up, sign-in, persistent session, and logout
- Passwords hashed with bcrypt (cost factor 12); hashes never leave the server
- Signed JWT stored in an HTTP-only, same-site cookie
- Protected dashboard in both middleware and the server-rendered page
- Ownership checks on every product API query and mutation
- Create, edit, delete, search, and filter products
- Client- and server-side Zod validation for every form
- Unique SKUs per user, non-negative whole-number stock, and clear API errors
- Low-stock dashboard metrics, alerts, empty states, loading states, and responsive UI
- Multi-SKU order requests with varying quantities
- Atomic PostgreSQL transactions with deterministic row locks to prevent overselling
- Partial fulfillment that deducts available stock and backorders the remainder
- Immutable order-item snapshots and a chronological audit log
- Pincode-based warehouse zones with an explicit, symmetric zone-rate matrix
- Actual-versus-volumetric weight calculation with auditable billing increments
- Exhaustive fleet-combination optimization under per-warehouse capacity limits
- Cheapest viable route selection with cost breakdown, alternatives, and a written justification
- Persistent, user-scoped delivery quote history
- Unit tests for important validation edge cases

## Stack

- Next.js 14 App Router, React, and strict TypeScript
- Next.js route handlers (full-stack, same-origin API)
- Prisma ORM with PostgreSQL (Neon-compatible)
- bcryptjs, jose, and Zod
- Plain CSS with no UI component dependency

## Run locally

Requirements: Node.js 18.17+ and pnpm (npm also works).

```bash
cp .env.example .env
# Replace JWT_SECRET with a random value of at least 32 characters.
pnpm install
pnpm db:push
pnpm dev
```

Open `http://localhost:3000`, create an account, and add your first product.

Optional demo data:

```bash
pnpm db:seed
```

Then sign in with `demo@stockroom.app` / `Demo1234`.

## Verification

```bash
pnpm test
pnpm lint
pnpm build
pnpm verify:orders
pnpm verify:concurrency
pnpm verify:routing
```

The three verification scripts use the configured PostgreSQL database, create isolated temporary users, assert persisted state, and clean up afterward. `verify:orders` covers partial fulfillment, zero stock, unknown-SKU rollback, totals, and audit history. `verify:concurrency` submits two competing orders simultaneously and proves total fulfillment cannot exceed starting stock. `verify:routing` covers actual and volumetric billing, warehouse selection, multi-vehicle capacity splitting, persisted quote snapshots, and rejection of unroutable shipments.

## Fulfillment model

Each order is processed in one PostgreSQL transaction. Requested product rows are selected for the signed-in user and locked in stable ID order with `FOR UPDATE`. Fulfillment is calculated only after those locks are acquired, stock deductions and the complete order record are written together, and any error rolls the transaction back.

- `FULFILLED`: all requested units were available.
- `PARTIALLY_FULFILLED`: some units were deducted and the rest were backordered.
- `BACKORDERED`: no requested units were available.

Order items retain SKU and product-name snapshots, so history remains readable even if inventory changes later. Audit entries record order creation, each stock deduction, and each backordered line.

## Routing model and assumptions

The routing engine evaluates five configured warehouse hubs: Delhi, Mumbai, Chennai, Kolkata, and Guwahati. Each has a source pincode, zone, handling charge, and finite fleet. Destination pincodes map to `NORTH`, `WEST`, `SOUTH`, `EAST`, `NORTHEAST`, or `REMOTE`; the exact prefix ranges and complete rate matrix live in `src/lib/routing.ts`.

- Dimensions are entered in centimetres and weight in kilograms.
- Volumetric weight is `length × width × height / 5,000`.
- The higher of actual and volumetric weight is rounded up to the next 0.5 kg billing increment.
- Route cost is chargeable weight times the zone-lane rate, plus warehouse handling and vehicle dispatch charges.
- The optimizer exhaustively enumerates every permitted mini-van, box-truck, and heavy-truck combination at each warehouse. A combination is viable only when its capacity covers the chargeable weight.
- The cheapest total is selected. Equal totals prefer fewer vehicles, then less unused capacity, then a stable warehouse ID order.
- Money is calculated and stored in integer paise. The chosen route, fleet allocation, alternatives, and explanation are persisted as a quote snapshot.

All configured warehouses are assumed able to dispatch the shipment; product-location inventory and live fleet telemetry are outside this assessment scope. Fleet availability is deterministic configuration rather than a reservation system.

## Security and workflow notes

- The password limit is 72 characters to match bcrypt's input boundary.
- Auth failures intentionally return the same message for unknown emails and bad passwords.
- Sessions expire after seven days. The cookie uses `Secure` in production.
- Product IDs alone never authorize access: every update and delete also filters by the signed-in user ID.
- A product is flagged when `quantity < lowStockThreshold`, matching the brief's “below” wording. Zero is valid stock; negative and fractional values are rejected.
- PostgreSQL is used for durable production-ready storage; the included connection placeholder is compatible with managed Neon databases.
- Order validation rejects empty orders, duplicate SKUs, non-positive/fractional quantities, and more than 50 lines before fulfillment begins.
- Rate inputs require a configured six-digit pincode and positive, bounded measurements. Unroutable weights fail without saving a quote.
- Quote APIs and history are user-scoped and protected by the same signed session as inventory and orders.

## Structure

```text
src/app/api/          Auth, product, order, and rate route handlers
src/app/dashboard/    Protected inventory workspace
src/app/orders/       Protected order workspace
src/app/routing/      Protected rate and routing workspace
src/components/       Auth, inventory, order, and routing workflows
src/lib/              Auth, validation, fulfillment, and routing optimizer
src/middleware.ts     Early route protection and auth-page redirects
prisma/               Schema and optional demo seed
scripts/              Live PostgreSQL verification harnesses
```

## If I had more time

- Add Playwright browser tests and run integration tests against a dedicated disposable database
- Add pagination and backorder release when stock is replenished
- Connect warehouse selection to SKU-level inventory and reserve fleet capacity transactionally
- Replace the static lane matrix with versioned carrier contracts and distance/service-level inputs
- Add password reset, email verification, session revocation, and rate limiting
- Add CI and deploy a production preview
