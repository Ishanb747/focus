# Deployment runbook

The application is designed for Vercel plus a managed PostgreSQL provider such as Neon. It can also run on any Node.js host that supports Next.js.

Use Node.js 22 or newer, matching the automated CI environment and the pinned pnpm runtime.

## Required configuration

Create these production environment variables in the hosting dashboard:

```text
DATABASE_URL=postgresql://...
JWT_SECRET=<random value of at least 32 characters>
```

Use a pooled PostgreSQL URL when the provider recommends one for serverless workloads. Require TLS in production. Never place real values in `.env.example`, GitHub Actions, screenshots, or issue text.

Generate a suitable signing secret locally:

```bash
openssl rand -base64 48
```

## Vercel and Neon

1. Create a Neon PostgreSQL project.
2. Import `Ishanb747/focus` into Vercel as a Next.js project.
3. Add `DATABASE_URL` and `JWT_SECRET` to Production, Preview, and Development as appropriate.
4. Install dependencies with `pnpm install --frozen-lockfile`.
5. Apply the schema from a trusted local or CI environment:

   ```bash
   pnpm db:push
   ```

6. Deploy with the default build command, `pnpm build`.
7. Do not run `pnpm db:seed` against a real customer database. It is only for an assessment/demo environment.

## Generic Node host

```bash
pnpm install --frozen-lockfile
pnpm db:push
pnpm build
pnpm start
```

The host must expose the port selected by Next.js and terminate HTTPS before requests reach the application. The session cookie automatically uses `Secure` when `NODE_ENV=production`.

## Production smoke test

After deployment:

1. Register a new account over HTTPS.
2. Refresh a protected page and confirm the session persists.
3. Logout and confirm direct protected URLs redirect to login.
4. Create and update a product.
5. Submit a partial order and inspect its audit history.
6. Calculate a route, refresh, and confirm quote history persists.
7. Inspect browser console and hosting logs for errors.

## Pre-deployment gates

```bash
pnpm test
pnpm lint
pnpm build
pnpm verify:orders
pnpm verify:concurrency
pnpm verify:routing
```

The final three commands mutate only isolated temporary records and clean them up afterward. Run them against a non-customer database whenever possible.

## Rollback

- Keep the previous Vercel deployment available for immediate traffic rollback.
- Schema changes in this submission are additive. Before future destructive schema changes, take a Neon branch or backup and use reviewed migrations.
- Application rollback does not automatically reverse database changes.
