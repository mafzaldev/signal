# Feature Flags

A feature-flag service: a NestJS API, a Next.js dashboard, and a TypeScript SDK. See [PLAN.md](PLAN.md).

## Layout

```
apps/api        NestJS API (port 4000)
apps/web        Next.js dashboard (port 3000)
apps/demo       Node script that prints a flag live via the SDK
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
REDIS_URL=redis://localhost:6379
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

## Using the SDK

Create an SDK key in the dashboard (project settings → SDK keys), then:

```ts
import { createClient } from '@feature-flags/sdk';

const flags = createClient({
  sdkKey: process.env.FLAGS_SDK_KEY!,
  baseUrl: 'http://localhost:4000',
});
await flags.waitForInitialization({ timeout: 3000 });

if (flags.boolVariation('new-checkout', { key: user.id, country: user.country }, false)) {
  // new checkout
}
flags.on('change', (key) => console.log(`${key} changed`));
```

Flags are evaluated locally from a ruleset the SDK downloads and keeps up to date over Server-Sent Events. Until it loads, or for unknown flags and values of the wrong type, each call returns the default you pass.

To try it, run `FLAGS_SDK_KEY=<key> pnpm --filter @feature-flags/demo start` and toggle `new-checkout` in the dashboard.

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
