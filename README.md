# Feature Flags

A self-hosted feature flag service. Teams create projects and flags in a dashboard, roll them out to specific users or a percentage of traffic, and apps read them through a TypeScript SDK that updates live and keeps working when the service is down.

- **Targeting**: turn flags on per environment, target individual users, write rules on user attributes ("country is PK and plan is not free"), and roll out by percentage with sticky, deterministic bucketing.
- **Live updates**: a change in the dashboard reaches running apps in under a second over Server-Sent Events, across any number of API instances.
- **Resilient SDK**: flags are evaluated in-process with no network call per check. If the API goes down, apps keep the flags they have and can even start from a disk cache.
- **Teams**: organizations with owner, admin, member and viewer roles; every change is recorded in an audit log with before and after snapshots.
- **Typed end to end**: one evaluation engine and one set of Zod schemas shared by the API, the dashboard and the SDK.

## How it works

```mermaid
flowchart LR
  dash["Dashboard<br/>Next.js"] -- "manage flags" --> api["API<br/>NestJS"]
  api -- "change + audit row" --> pg[("Postgres")]
  api -- "publish change" --> redis[("Redis")]
  redis -- "to every API instance" --> api
  api -- "SSE stream" --> sdk["Your app<br/>+ SDK"]
```

The dashboard calls the API, which saves each change together with its audit entry, then publishes it through Redis. Every API instance forwards it to the SDKs connected to it, and each SDK evaluates flags locally from the rules it holds. [docs/architecture.md](docs/architecture.md) has the full picture.

## Quick start

Requires Node 24, pnpm 11 and Docker.

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

Apply migrations and start everything:

```sh
pnpm --filter @feature-flags/api db:migrate
pnpm dev
```

Then:

1. Open http://localhost:3000, create an account and an organization.
2. Create a project, then a flag called `new-checkout`.
3. In the project's settings, create an SDK key for `production`.
4. Run the demo: `FLAGS_SDK_KEY=<key> pnpm --filter @feature-flags/demo start`
5. Toggle `new-checkout` in production. The demo prints the new values within a second.
6. Stop the API and start the demo again: it still prints the last values, from its cache.

## Using the SDK

```ts
import { createClient } from '@feature-flags/sdk';
import { fileStorage } from '@feature-flags/sdk/node';

const flags = createClient({
  sdkKey: process.env.FLAGS_SDK_KEY!,
  baseUrl: 'http://localhost:4000',
  storage: fileStorage('.flags-cache.json'),
});
await flags.waitForInitialization({ timeout: 3000 });

if (flags.boolVariation('new-checkout', { key: user.id, country: user.country }, false)) {
  // new checkout
}
```

See the [SDK README](packages/sdk/README.md) for every option and method.

## Documentation

| Document                             | Covers                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| [Glossary](docs/glossary.md)         | Plain definitions of every term used in the project                                                   |
| [Architecture](docs/architecture.md) | Components, tenancy and roles, how changes propagate, caching, streams, the SDK's connection handling |
| [Evaluation](docs/evaluation.md)     | The order of checks, condition operators, segments and percentage rollouts                            |
| [API reference](docs/api.md)         | Authentication, management endpoints, the audit log and the SDK protocol                              |
| [SDK](packages/sdk/README.md)        | Installing and using the SDK                                                                          |
| [Development](docs/development.md)   | Setup, environment variables, migrations, tests, CI and troubleshooting                               |
| [Plan](PLAN.md)                      | The roadmap and decisions behind the project                                                          |

## Repository layout

```
apps/api        NestJS API (port 4000)
apps/web        Next.js dashboard (port 3000)
apps/demo       Node script that prints a flag live via the SDK
packages/core   Evaluation engine, shared types and schemas
packages/sdk    The SDK
docs/           Documentation
```

## Scripts

| Command                                     | Does                                      |
| ------------------------------------------- | ----------------------------------------- |
| `pnpm dev`                                  | Runs everything in watch mode             |
| `pnpm build`                                | Builds everything                         |
| `pnpm lint`                                 | ESLint                                    |
| `pnpm typecheck`                            | TypeScript                                |
| `pnpm test`                                 | Unit tests                                |
| `pnpm --filter @feature-flags/api test:e2e` | API end-to-end tests (needs `pnpm db:up`) |
| `pnpm format`                               | Prettier                                  |
| `pnpm db:down`                              | Stops Postgres and Redis                  |

If `pnpm dev` fails with a file watcher error, see [Troubleshooting](docs/development.md#troubleshooting).

## Status

Done: the evaluation engine, the API with authentication, roles and the audit log, the dashboard, SDK keys, live updates, and the SDK's offline cache and fallbacks. Next: publishing the SDK to npm, segments and browser support, then deployment and load testing. A/B testing with AI-written result summaries comes after that. See [PLAN.md](PLAN.md).
