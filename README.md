<img src="apps/web/src/app/icon.svg" alt="" width="56" height="56">

# Signal

Signal is a self-hosted release control platform. Ship code dark, decide who sees it, roll it out by percentage and switch it off in under a second. Teams manage releases in a dashboard, and apps read them through a TypeScript SDK that evaluates in-process, updates live and keeps working when Signal is down.

- **Targeting**: turn flags on per environment, target individual users, write rules on user attributes ("country is PK and plan is not free"), and roll out by percentage with sticky, deterministic bucketing.
- **Live updates**: a change in the dashboard reaches running apps in under a second over Server-Sent Events, across any number of API instances.
- **Resilient SDK**: flags are evaluated in-process with no network call per check. If the API goes down, apps keep the flags they have and can even start from a disk cache.
- **Teams**: organizations with owner, admin, member and viewer roles, joined through emailed invitations; accounts verify their email address; every flag, project and key change is recorded in an audit log with before and after snapshots.
- **Typed end to end**: one evaluation engine and one set of Zod schemas shared by the API, the dashboard and the SDK.

## How it works

```text
┌───────────┐  manage flags  ┌──────────┐  change + audit row  ┌──────────┐
│ Dashboard │ ─────────────▶ │   API    │ ───────────────────▶ │ Postgres │
│  Next.js  │                │  NestJS  │                      └──────────┘
└───────────┘                └──────────┘
                              │   ▲    │      SSE stream       ┌────────────────┐
               publish change │   │    └─────────────────────▶ │ Your app + SDK │
                              ▼   │ to every API instance      └────────────────┘
                             ┌──────────┐
                             │  Redis   │
                             └──────────┘
```

The dashboard calls the API, which saves each change together with its audit entry, then publishes it through Redis. Every API instance forwards it to the SDKs connected to it, and each SDK evaluates flags locally from the rules it holds. [docs/architecture.md](docs/architecture.md) has the full picture.

## Quick start

Requires Node 24, pnpm 11 and Docker.

```sh
pnpm install
pnpm db:up      # Postgres on localhost:5433, Redis on localhost:6379, Mailpit on localhost:8025
```

Create `apps/api/.env`:

```sh
DATABASE_URL=postgres://signal:signal@localhost:5433/signal
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=   # at least 32 random characters, e.g. `openssl rand -base64 32`
BETTER_AUTH_URL=http://localhost:4000
TRUSTED_ORIGINS=http://localhost:3000

# Optional: send email (account verification, invitations). Without it, accounts don't
# need verifying and invitation links are copied from the dashboard instead.
SMTP_URL=smtp://localhost:1025   # Mailpit catches everything; see docs/development.md#email for real providers
EMAIL_FROM="Signal <signal@localhost>"
```

Apply migrations and start everything:

```sh
pnpm --filter @signal/api db:migrate
pnpm dev
```

Then try the demo storefronts: the same small shop, whose banner, products, checkout and theme come from flags, built two ways.

```sh
pnpm --filter @signal/demo seed           # creates a demo account, project, flags and both keys
pnpm --filter @signal/demo start          # React app with the browser SDK: http://localhost:4100
pnpm --filter @signal/demo start:server   # rendered on the server with the server SDK: http://localhost:4200
```

With email set up (`SMTP_URL`), the first seed creates `demo@signal.dev` unverified and stops. Open the verification email (in Mailpit, at http://localhost:8025, when sending there), then run the seed again.

1. Switch between the example shoppers (Ayesha and Bilal in Pakistan, Sara in the UAE, John in the US) and see each one get a different shop. The "What Signal served" panel shows every flag's value and why.
2. Sign in to the dashboard at http://localhost:3000 as `demo@signal.dev` / `signal-demo`, open the `shop` project and change a flag in `development`: turn on `dark-mode`, move the `button-color` rollout, add a rule. The open shop updates within a second, without reloading.
3. Compare the two in the browser's network tab. The React shop calls `POST /sdk/client/evaluate`, which returns only the shopper's values. The server-rendered shop makes no flag calls at all: its server evaluates every flag in-process and sends finished HTML. Stop the API and restart the server shop: it keeps serving the last flags it had, from its disk cache.

Running the seed again resets the flags to their starting point.

## Using the SDK

```ts
import { Signal } from '@mafzaldev/signal';
import { fileStorage } from '@mafzaldev/signal/node';

const signal = new Signal({
  sdkKey: process.env.SIGNAL_SDK_KEY!,
  baseUrl: 'http://localhost:4000',
  storage: fileStorage('.flags-cache.json'),
});
await signal.ready({ timeout: 3000 });

if (signal.bool('new-checkout', { key: user.id, country: user.country }, false)) {
  // new checkout
}
```

In the browser, use a **client key** and `@mafzaldev/signal/browser`. The API evaluates flags for the user you pass and sends back only their values, for flags with client-side access turned on:

```ts
import { SignalClient } from '@mafzaldev/signal/browser';

const signal = new SignalClient({
  clientKey: 'client-…', // public, safe to ship in a web page
  baseUrl: 'https://signal.example.com',
  context: { key: user.id, country: user.country },
});
await signal.ready({ timeout: 3000 });

if (signal.bool('new-checkout', false)) {
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
apps/demo       Demo storefronts: React with the browser SDK, server-rendered with the server SDK
packages/core   Evaluation engine, shared types and schemas
packages/sdk    The SDK
docs/           Documentation
```

## Scripts

| Command                              | Does                                      |
| ------------------------------------ | ----------------------------------------- |
| `pnpm dev`                           | Runs everything in watch mode             |
| `pnpm build`                         | Builds everything                         |
| `pnpm lint`                          | ESLint                                    |
| `pnpm typecheck`                     | TypeScript                                |
| `pnpm test`                          | Unit tests                                |
| `pnpm --filter @signal/api test:e2e` | API end-to-end tests (needs `pnpm db:up`) |
| `pnpm format`                        | Prettier                                  |
| `pnpm db:down`                       | Stops Postgres and Redis                  |

If `pnpm dev` fails with a file watcher error, see [Troubleshooting](docs/development.md#troubleshooting).

## Status

Done: the evaluation engine, the API with authentication, roles and the audit log, the dashboard (including members and invitations), email (account verification and invitations through any SMTP provider), SDK keys, live updates, the SDK's offline cache and fallbacks, and the browser SDK with client keys. Next: publishing the SDK to npm and segments, then deployment and load testing. A/B testing with AI-written result summaries comes after that. See [PLAN.md](PLAN.md).
