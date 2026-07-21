# Stockroom - Tier 1 Warehouse Stock Manager

A complete Tier 1 submission for the developer assessment brief. Stockroom is a full-stack Next.js inventory app with real authentication, protected routes, product CRUD, and low-stock visibility.

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
```

## Security and workflow notes

- The password limit is 72 characters to match bcrypt's input boundary.
- Auth failures intentionally return the same message for unknown emails and bad passwords.
- Sessions expire after seven days. The cookie uses `Secure` in production.
- Product IDs alone never authorize access: every update and delete also filters by the signed-in user ID.
- A product is flagged when `quantity < lowStockThreshold`, matching the brief's “below” wording. Zero is valid stock; negative and fractional values are rejected.
- PostgreSQL is used for durable production-ready storage; the included connection placeholder is compatible with managed Neon databases.

## Structure

```text
src/app/api/          Auth and product route handlers
src/app/dashboard/    Protected server-rendered dashboard route
src/components/       Auth and inventory client workflows
src/lib/              Database, auth, JWT, and validation boundaries
src/middleware.ts     Early route protection and auth-page redirects
prisma/               Schema and optional demo seed
```

## If I had more time

- Add Playwright browser tests and API integration tests against a disposable database
- Add paginated inventory history and audit events
- Add password reset, email verification, session revocation, and rate limiting
- Move to managed PostgreSQL, add CI, and deploy a production preview

Scope is intentionally limited to Tier 1; order fulfillment and routing are not included.
