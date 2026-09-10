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
pnpm dev
```

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
