# @mafzaldev/signal

TypeScript SDK for Signal, the self-hosted release control platform. On servers, it downloads an environment's flags, keeps them up to date over Server-Sent Events, and evaluates them in your process, so checking a flag never makes a network call. If Signal goes down, your app keeps serving the last flags it had, even across restarts. In browsers, [`@mafzaldev/signal/browser`](#in-the-browser) gets one user's values from Signal and keeps them live, without ever receiving the rules.

- No dependencies
- ESM and CommonJS, with TypeScript types
- Node 18+

## Install

```sh
npm install @mafzaldev/signal
```

## Quick start

Create an SDK key for an environment in the dashboard (project settings → SDK keys), then:

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

const color = signal.string('button-color', user, 'blue');

signal.on('change', (key) => console.log(`${key} changed`));
```

Create one client when your app starts and reuse it. Call `await signal.close()` on shutdown.

## Contexts

A context describes who a flag is evaluated for. `key` is required and should be stable for that user, account or device: percentage rollouts hash it, so the same key always gets the same answer. Add any attributes your targeting rules use:

```ts
{ key: 'user-42', country: 'PK', plan: 'pro', age: 31, groups: ['beta', 'staff'] }
```

Values can be strings, numbers, booleans, or arrays of those.

## Options

```ts
new Signal(options);
```

| Option                    | Default        | Description                                                                                                                                                |
| ------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sdkKey`                  | required       | The environment's SDK key                                                                                                                                  |
| `baseUrl`                 | required       | URL of the flags API                                                                                                                                       |
| `storage`                 | none           | Where to keep the last known flags so the app can start while the API is down. Use `fileStorage(path)` from `@mafzaldev/signal/node`, or your own adapter. |
| `streaming`               | `true`         | Receive changes live over SSE. When `false`, poll every `pollIntervalMs` instead.                                                                          |
| `pollIntervalMs`          | `30000`        | Polling interval when `streaming` is `false`                                                                                                               |
| `streamTimeoutMs`         | `60000`        | Reconnect if nothing, not even a heartbeat, arrives for this long                                                                                          |
| `initialReconnectDelayMs` | `1000`         | First reconnect delay                                                                                                                                      |
| `maxReconnectDelayMs`     | `30000`        | Longest reconnect delay                                                                                                                                    |
| `fetch`                   | global `fetch` | Custom fetch implementation                                                                                                                                |
| `logger`                  | `console`      | Receives `warn` and `error` messages                                                                                                                       |

## Reading flags

Each method takes the flag key, a context and a default value, and **never throws**. You get the default when:

- flags haven't loaded yet,
- the flag doesn't exist,
- the flag's value is a different type than the method returns,
- something unexpected goes wrong.

| Method                                  | Returns                             |
| --------------------------------------- | ----------------------------------- |
| `bool(key, context, default: boolean)`  | `boolean`                           |
| `string(key, context, default: string)` | `string`                            |
| `number(key, context, default: number)` | `number`                            |
| `json(key, context, default)`           | any JSON value                      |
| `value(key, context, default)`          | any flag value                      |
| `detail(key, context, default)`         | `{ value, variationIndex, reason }` |

`detail` explains the result:

| `reason.kind`  | Meaning                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `OFF`          | The flag is off                                                                                                                   |
| `TARGET_MATCH` | The context key is individually targeted                                                                                          |
| `RULE_MATCH`   | A targeting rule matched (`ruleIndex`, `ruleId`)                                                                                  |
| `FALLTHROUGH`  | No rule matched; the default rule applied                                                                                         |
| `ERROR`        | The default was served; `errorKind` says why: `CLIENT_NOT_READY`, `FLAG_NOT_FOUND`, `WRONG_TYPE`, `MALFORMED_FLAG` or `EXCEPTION` |

## Lifecycle

| Method                | Description                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `ready({ timeout? })` | Resolves `true` once flags are available, from the cache or the server, or `false` on timeout or an invalid key. Never rejects. |
| `isReady()`           | Whether flags are available                                                                                                     |
| `dataSource()`        | `'none'`, `'cache'` or `'server'`: where the flags being served came from                                                       |
| `on(event, listener)` | Adds a listener and returns a function that removes it                                                                          |
| `close()`             | Stops streaming or polling and resolves once pending cache writes finish. Flags stay readable.                                  |

| Event    | Listener                 | When                                                  |
| -------- | ------------------------ | ----------------------------------------------------- |
| `ready`  | `() => void`             | Flags first became available                          |
| `change` | `(key: string) => void`  | A flag was added, changed or removed                  |
| `error`  | `(error: Error) => void` | The SDK key was rejected; the client stops connecting |

## When Signal is unavailable

- **While running**, the SDK keeps serving the flags it already has and reconnects with exponential backoff and jitter. If the stream keeps failing, for example behind a proxy that blocks SSE, it also fetches flags between attempts, sending an ETag so unchanged flags cost almost nothing.
- **On startup**, with `storage` set, it loads the last saved flags before connecting, so `ready()` resolves with those flags even if the service is down. When the service answers, its flags replace the cached ones and `change` fires for anything that differs.
- **Quiet connections** that miss heartbeats for `streamTimeoutMs` are reopened.
- **An invalid or revoked key** stops the client and emits `error`. Flags already loaded stay readable.

The cache stores the flags and the first 12 characters of the SDK key, never the full key. A cache saved for a different key is ignored.

## Custom storage

Any object with `get` and `set` works; both can be sync or async:

```ts
import type { FlagStorage } from '@mafzaldev/signal';

const redisStorage: FlagStorage = {
  get: () => redis.get('signal-flags-cache'),
  set: (value) => redis.set('signal-flags-cache', value).then(() => {}),
};
```

`fileStorage(path)` writes to a temporary file and renames it into place, so a crash never leaves a half-written cache.

## In the browser

Browser code uses its own client and a **client key**. Signal evaluates flags on its side for the context you pass and sends back only the results, so rules and the user keys they list never reach the page. A client key is public: it's safe to ship in a web page, because all it can do is ask for values.

Create a client key in the dashboard (project settings → SDK keys → New key → Client), and turn on **Client-side access** in each flag's settings that browsers should read. Flags without it are left out of the results.

```ts
import { SignalClient } from '@mafzaldev/signal/browser';

const signal = new SignalClient({
  clientKey: 'client-…',
  baseUrl: 'https://signal.example.com',
  context: { key: 'user-42', country: 'PK', plan: 'pro' },
});

await signal.ready({ timeout: 3000 });

if (signal.bool('new-checkout', false)) {
  // new checkout
}

// After sign-in, or when the user changes
await signal.identify({ key: 'user-77', country: 'AE' });

signal.on('change', (key) => console.log(`${key} changed`));
```

The methods match the server client, without the context argument: `bool`, `string`, `number`, `json`, `value` and `detail(key, defaultValue)`, plus `allFlags()`, `context()`, `identify(context)`, `ready()`, `isReady()`, `dataSource()`, `on('ready' | 'change' | 'error')` and `close()`. When a flag changes, Signal tells the page over a stream and the client fetches its values again, so `change` fires within a second.

`identify(context)` resolves `true` once Signal's values for the new context arrive, `false` if Signal couldn't be reached. Switching to a different key drops the previous context's values at once, so they're never shown to someone else.

The client saves the last values it got in `localStorage`, for the same user only, so a reload while Signal is down shows those instead of defaults; `dataSource()` returns `'cache'` then. Pass `storage: null` to keep nothing, or any object with `getItem` and `setItem`.

Options: `clientKey`, `baseUrl` and `context` are required; `storage` is optional as above; `streamTimeoutMs`, `fetch`, `logger`, `initialReconnectDelayMs` and `maxReconnectDelayMs` work as on the server client.

## Security

The server client (`Signal`) receives each flag's full targeting rules, including any user keys they list. Use it, and its SDK key, only on servers you control, never in browser code. In browsers, use `SignalClient` with a client key: Signal refuses client keys on the ruleset endpoints and SDK keys on the browser ones.
