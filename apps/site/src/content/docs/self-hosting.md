---
title: Self-hosting
description: Run the Signal API and dashboard with Postgres and Redis, and configure them for production.
order: 2
section: Start here
---

Signal is a monorepo with two services to run, the **API** and the **dashboard**, plus Postgres and Redis.

## Requirements

- Node.js 24 or later and pnpm
- Postgres 17 and Redis 7 (the repository's Docker Compose file starts both for local use)
- Optionally, an SMTP server or email provider for verification and invitation emails

## Run it locally

```sh
git clone https://github.com/mafzaldev/signal.git
cd signal
pnpm install
pnpm db:up                                # Postgres, Redis and a local mail catcher
pnpm --filter @signal/api db:migrate      # creates the tables
pnpm dev                                  # API on :4000, dashboard on :3000
```

Create `apps/api/.env` first (see below), then open `http://localhost:3000` and sign up. The first account creates an organization and becomes its owner.

## Configuration

The API reads its settings from environment variables, or from `apps/api/.env`. It checks them on startup and refuses to start if one is missing or invalid.

| Variable             | Required | Description                                                                                         |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | yes      | Postgres connection string                                                                          |
| `REDIS_URL`          | yes      | Redis connection string                                                                             |
| `BETTER_AUTH_SECRET` | yes      | A random string of at least 32 characters that signs sessions. Generate one and keep it private     |
| `BETTER_AUTH_URL`    | yes      | The API's public URL                                                                                |
| `TRUSTED_ORIGINS`    | yes      | Comma-separated origins allowed to sign in, normally just the dashboard's URL                       |
| `PORT`               | no       | HTTP port, default `4000`                                                                           |
| `SMTP_URL`           | no       | Where to send email, e.g. `smtp://user:password@smtp.example.com:587`. Without it, no email is sent |
| `EMAIL_FROM`         | no       | Sender address; it must be verified with your email provider                                        |
| `DASHBOARD_URL`      | no       | The dashboard's public URL, used for links in emails. Defaults to the first trusted origin          |

A local `.env` looks like this. Use your own secret, never this placeholder:

```sh
DATABASE_URL=postgres://signal:signal@localhost:5433/signal
REDIS_URL=redis://localhost:6379
BETTER_AUTH_SECRET=<a random string of 32 or more characters>
BETTER_AUTH_URL=http://localhost:4000
TRUSTED_ORIGINS=http://localhost:3000
```

The dashboard reads one variable, `API_URL`, the address it uses to reach the API (default `http://localhost:4000`).

## Email

Email is optional. With `SMTP_URL` set:

- new accounts must verify their address before they can sign in,
- inviting someone sends them a link to join.

Without it, accounts don't need verifying and invitation links are copied from the Members page by hand. A failed email is logged and never fails the action that sent it.

## Production

- **Build** with `pnpm build`, then run `node dist/main.js` in `apps/api` and `pnpm exec next start` in `apps/web`.
- **Set `API_URL` when building the dashboard**, not only when running it: `API_URL=https://api.example.com pnpm build`. Sign-in requests are routed to the API through an address fixed at build time.
- **Run migrations** with `pnpm --filter @signal/api db:migrate` before starting a new version.
- **Scale the API** by running more instances behind a load balancer. They share Redis, so a change made through one instance reaches apps connected to any of them.
- **Keep connections open.** Apps hold long-lived streaming connections to the API. Configure your proxy so it doesn't buffer or cut off idle responses on `/sdk/stream` and `/sdk/client/stream`; Signal sends a heartbeat every 20 seconds.
- **Use HTTPS** for both services, and keep `BETTER_AUTH_SECRET` and server SDK keys in your secret manager.
