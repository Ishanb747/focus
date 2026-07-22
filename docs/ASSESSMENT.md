# Assessment evidence

This document maps the assessment brief to concrete code and reproducible evidence. It is intentionally concise so a reviewer can validate the important claims quickly.

## Tier 1 - Foundation

| Brief requirement | Code | Evidence |
| --- | --- | --- |
| Signup and signin work end to end | `src/app/api/auth`, `src/components/AuthForm.tsx` | Register, refresh, logout, and sign back in |
| Passwords are hashed | `src/app/api/auth/register/route.ts` | bcrypt cost 12; hashes never appear in responses |
| Session/JWT and protected routes | `src/lib/session.ts`, `src/middleware.ts` | Logged-out visits to dashboard, orders, or routing redirect to login |
| Product CRUD with validation | `src/app/api/products`, `src/lib/validation.ts` | Client and server share the Zod product schema |
| Low-stock dashboard | `src/components/InventoryDashboard.tsx` | Low and out-of-stock filters, metrics, and alerts |
| Error and loading states | Route loading files and client forms | Disabled submit states, spinners, inline errors, empty states, toast feedback |

## Tier 2 - Logic

| Brief requirement | Code | Evidence |
| --- | --- | --- |
| Multiple SKUs and quantities | `src/components/OrdersDashboard.tsx` | Add/remove lines with unique normalized SKUs |
| Atomic deduction | `src/lib/order-service.ts` | One transaction and `SELECT ... FOR UPDATE` in stable ID order |
| No overselling | `scripts/verify-concurrency.ts` | 10 stock, two concurrent requests for 8, exactly 10 fulfilled |
| Partial fulfillment | `src/lib/fulfillment.ts` | Pure deterministic planner stores fulfilled and backordered amounts |
| History and audits | `Order`, `OrderItem`, `OrderAudit` models | Item snapshots plus creation, deduction, and backorder events |

### Fulfillment edge cases

- Zero stock produces a fully backordered order without a negative quantity.
- Insufficient stock produces `PARTIALLY_FULFILLED` with exact totals.
- Unknown SKUs throw inside the transaction and roll everything back.
- Duplicate SKUs, empty orders, fractional quantities, and non-positive quantities fail validation.
- Concurrent requests recalculate after row-lock acquisition from the latest committed stock.

## Tier 3 - Hard

| Brief requirement | Code | Evidence |
| --- | --- | --- |
| Pincode warehouse zones | `zoneForPincode` in `src/lib/routing.ts` | Tests cover every configured zone and invalid ranges |
| Simple zone-rate matrix | `ZONE_RATE_MATRIX` | Unit test verifies symmetry across every lane |
| Dimensional versus actual weight | `calculateRoutingQuote` | Uses the higher weight and rounds upward to 0.5 kg |
| Vehicle capacity splitting | `optimizeFleet` | Exhaustive finite combination search; 1,800 kg uses multiple vehicles |
| Cheapest viable option | Sorted `RouteOption` values | Total, tie-break rules, three alternatives, and explanation returned |
| Non-trivial data model | `DeliveryQuote` | Persists input, billing weights, selected warehouse, costs, fleet, alternatives, and justification |

### Routing edge cases

- Invalid or unmapped six-digit pincodes fail without a quote.
- Zero, negative, non-finite, and excessive measurements fail Zod validation.
- Volumetric weight can dominate actual weight.
- Fleet combinations may mix vehicle types.
- Shipments beyond every configured fleet fail with `NoViableRouteError` and are not persisted.
- Cost uses integer paise to avoid floating-point money errors.

## Verification record

Run from the repository root:

```bash
pnpm test
pnpm lint
pnpm build
pnpm verify:orders
pnpm verify:concurrency
pnpm verify:routing
```

Current automated coverage includes 23 unit tests plus three live PostgreSQL harnesses. The integration harnesses are self-cleaning and safe to run repeatedly against the configured assessment database.

## Manual review checklist

- [ ] Register a new user, refresh, logout, and sign back in.
- [ ] Create, edit, search, filter, and delete a product.
- [ ] Submit a two-SKU order where one line exceeds available stock.
- [ ] Expand the saved order audit log.
- [ ] Calculate a dimensional-weight route and compare alternatives.
- [ ] Calculate an 1,800 kg route and confirm multiple vehicles are shown.
- [ ] Refresh the routing page and confirm quote history persists.
- [ ] Check the three workspaces at desktop and mobile widths.

## Honest scope notes

- The submission completes the specified behavior for all three tiers.
- The rate matrix and fleet are deterministic business configuration, not live carrier or telematics data.
- Warehouse selection does not yet consider SKU-level placement.
- Integration tests use isolated users in the configured database; a dedicated ephemeral CI database would be preferable at scale.
- Deployment credentials and the production URL belong to the reviewer/deployer environment and are not stored in the repository.
