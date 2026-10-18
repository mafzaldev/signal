---
title: Server SDK
description: Read flags in your backend with in-memory evaluation, live updates and an offline cache.
order: 6
section: SDKs
---

The server SDK downloads an environment's rules, keeps them current over a live stream, and evaluates flags in your process. Checking a flag never makes a network call, and if Signal goes down your app keeps the flags it has, even across restarts.

- No dependencies
- ESM and CommonJS, with TypeScript types
- Node.js 18 or later

## Install

```sh
npm install @mafzaldev/signal
```

```sh
pnpm add @mafzaldev/signal
```

```sh
yarn add @mafzaldev/signal
```

```sh
bun add @mafzaldev/signal
```

The same package holds the [browser SDK](/docs/browser-sdk).

## Quick start

Create a **server key** for an environment in the dashboard (project settings → SDK keys), then:

```ts
import { Signal } from '@mafzaldev/signal';
import { fileStorage } from '@mafzaldev/signal/node';

const signal = new Signal({
  sdkKey: process.env.SIGNAL_SDK_KEY!,
  baseUrl: 'https://signal.example.com',
  storage: fileStorage('.flags-cache.json'),
});

await signal.ready({ timeout: 3000 });

const user = { key: 'user-42', country: 'PK', plan: 'pro' };

if (signal.bool('new-checkout', user, false)) {
  // new checkout
}
```

Create one client when your app starts and reuse it. Call `await signal.close()` on shutdown.

A server key can read every rule, including the user keys they list. Keep it secret and never use it in browser code.

## Options

| Option                    | Default        | Description                                                             |
| ------------------------- | -------------- | ----------------------------------------------------------------------- |
| `sdkKey`                  | required       | The environment's server key                                            |
| `baseUrl`                 | required       | URL of the Signal API                                                   |
| `storage`                 | none           | Where to keep the last known flags, e.g. `fileStorage(path)`            |
| `streaming`               | `true`         | Receive changes live. When `false`, poll every `pollIntervalMs` instead |
| `pollIntervalMs`          | `30000`        | Polling interval when not streaming                                     |
| `streamTimeoutMs`         | `60000`        | Reconnect if nothing, not even a heartbeat, arrives for this long       |
| `initialReconnectDelayMs` | `1000`         | First reconnect delay; it doubles after each failure                    |
| `maxReconnectDelayMs`     | `30000`        | Longest reconnect delay                                                 |
| `fetch`                   | global `fetch` | Custom fetch implementation                                             |
| `logger`                  | `console`      | Receives `warn` and `error` messages                                    |

## Reading flags

Each method takes the flag key, a context and a default value, and never throws. You get the default when flags haven't loaded yet, the flag doesn't exist, or its value is a different type than the method returns.

| Method                                  | Returns                             |
| --------------------------------------- | ----------------------------------- |
| `bool(key, context, default: boolean)`  | `boolean`                           |
| `string(key, context, default: string)` | `string`                            |
| `number(key, context, default: number)` | `number`                            |
| `json(key, context, default)`           | any JSON value                      |
| `value(key, context, default)`          | any flag value                      |
| `detail(key, context, default)`         | `{ value, variationIndex, reason }` |

`detail` says why a value was served:

| `reason.kind`  | Meaning                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `OFF`          | The flag is off                                                                                            |
| `TARGET_MATCH` | The context's key is individually targeted                                                                 |
| `RULE_MATCH`   | A rule matched (`ruleIndex`, `ruleId`)                                                                     |
| `FALLTHROUGH`  | No rule matched; the default rule applied                                                                  |
| `ERROR`        | The default was served; `errorKind` says why, such as `CLIENT_NOT_READY`, `FLAG_NOT_FOUND` or `WRONG_TYPE` |

## Lifecycle and events

| Method                | Description                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `ready({ timeout? })` | Resolves `true` once flags are available, or `false` on timeout or a rejected key. Never rejects |
| `isReady()`           | Whether flags are available                                                                      |
| `dataSource()`        | `'none'`, `'cache'` or `'server'`: where the flags being served came from                        |
| `on(event, listener)` | Adds a listener and returns a function that removes it                                           |
| `close()`             | Stops listening for changes and finishes pending cache writes. Flags stay readable               |

Events: `ready` when flags first become available, `change` with the key of a flag that was added, changed or removed, and `error` when the key is rejected.

## When Signal is unavailable

- **While running**, the SDK keeps serving the flags it has and reconnects with backoff. If streaming keeps failing, for example behind a proxy that blocks it, it fetches flags between attempts.
- **On startup**, with `storage` set, it loads the last saved flags before connecting, so `ready()` resolves even while Signal is down.
- **A revoked key** stops the client and emits `error`. Flags already loaded stay readable.

The cache stores the flags and only the first 12 characters of the key.

## Custom storage

Anything with `get` and `set` works, synchronous or async. For example, Redis shared by several instances:

```ts
const storage = {
  get: () => redis.get('signal-flags-cache'),
  set: (value: string) => redis.set('signal-flags-cache', value).then(() => {}),
};
```
