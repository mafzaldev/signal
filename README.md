# Feature Flags

A feature-flag service: a NestJS API, a Next.js dashboard, and a TypeScript SDK. See [PLAN.md](PLAN.md).

## Layout

```
apps/api        NestJS API (port 4000)
apps/web        Next.js dashboard (port 3000)
packages/core   flag evaluation engine + shared types
packages/sdk    npm SDK
```

## Getting started

Requires Node 24, pnpm 11, and Docker.

```sh
pnpm install
pnpm db:up      # Postgres on localhost:5433, Redis on localhost:6379
```

Create `apps/api/.env`:

```sh
DATABASE_URL=postgres://flags:flags@localhost:5433/flags
BETTER_AUTH_SECRET=   # at least 32 random characters, e.g. `openssl rand -base64 32`
BETTER_AUTH_URL=http://localhost:4000
TRUSTED_ORIGINS=http://localhost:3000
```

Then apply migrations and start everything:

```sh
pnpm --filter @feature-flags/api db:migrate
pnpm dev
```

Open http://localhost:3000, create an account and an organization. The dashboard proxies `/api/auth/*` to the API and reads `API_URL` (default `http://localhost:4000`) to reach it.

## Scripts

| Command                                     | Does                                    |
| ------------------------------------------- | --------------------------------------- |
| `pnpm dev`                                  | Run every app and package in watch mode |
| `pnpm build`                                | Build everything                        |
| `pnpm lint`                                 | ESLint                                  |
| `pnpm typecheck`                            | TypeScript                              |
| `pnpm test`                                 | Unit tests (Vitest)                     |
| `pnpm --filter @feature-flags/api test:e2e` | API end-to-end tests                    |
| `pnpm format`                               | Prettier                                |
| `pnpm db:down`                              | Stop Postgres and Redis                 |
