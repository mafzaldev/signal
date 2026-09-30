# @feature-flags/sdk

Server-side TypeScript SDK for the feature flag service. It downloads an environment's flags, keeps them up to date over Server-Sent Events, and evaluates them in your process, so checking a flag never makes a network call. If the flag service goes down, your app keeps serving the last flags it had, even across restarts.

- No dependencies
- ESM and CommonJS, with TypeScript types
- Node 18+

## Install

```sh
npm install @feature-flags/sdk
```

## Quick start

Create an SDK key for an environment in the dashboard (project settings → SDK keys), then:

```ts
import { createClient } from '@feature-flags/sdk';
import { fileStorage } from '@feature-flags/sdk/node';

const flags = createClient({
  sdkKey: process.env.FLAGS_SDK_KEY!,
  baseUrl: 'https://flags.example.com',
  storage: fileStorage('.flags-cache.json'),
});

await flags.waitForInitialization({ timeout: 3000 });

const user = { key: 'user-42', country: 'PK', plan: 'pro' };

if (flags.boolVariation('new-checkout', user, false)) {
  // new checkout
}

const color = flags.stringVariation('button-color', user, 'blue');

flags.on('change', (key) => console.log(`${key} changed`));
```

Create one client when your app starts and reuse it. Call `await flags.close()` on shutdown.

## Contexts

A context describes who a flag is evaluated for. `key` is required and should be stable for that user, account or device: percentage rollouts hash it, so the same key always gets the same answer. Add any attributes your targeting rules use:

```ts
{ key: 'user-42', country: 'PK', plan: 'pro', age: 31, groups: ['beta', 'staff'] }
```

Values can be strings, numbers, booleans, or arrays of those.

## Options

```ts
createClient(options);
```

| Option                    | Default        | Description                                                                                                                                                 |
| ------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sdkKey`                  | required       | The environment's SDK key                                                                                                                                   |
| `baseUrl`                 | required       | URL of the flags API                                                                                                                                        |
| `storage`                 | none           | Where to keep the last known flags so the app can start while the API is down. Use `fileStorage(path)` from `@feature-flags/sdk/node`, or your own adapter. |
| `streaming`               | `true`         | Receive changes live over SSE. When `false`, poll every `pollIntervalMs` instead.                                                                           |
| `pollIntervalMs`          | `30000`        | Polling interval when `streaming` is `false`                                                                                                                |
| `streamTimeoutMs`         | `60000`        | Reconnect if nothing, not even a heartbeat, arrives for this long                                                                                           |
| `initialReconnectDelayMs` | `1000`         | First reconnect delay                                                                                                                                       |
| `maxReconnectDelayMs`     | `30000`        | Longest reconnect delay                                                                                                                                     |
| `fetch`                   | global `fetch` | Custom fetch implementation                                                                                                                                 |
| `logger`                  | `console`      | Receives `warn` and `error` messages                                                                                                                        |

## Reading flags

Each method takes the flag key, a context and a default value, and **never throws**. You get the default when:

- flags haven't loaded yet,
- the flag doesn't exist,
- the flag's value is a different type than the method returns,
- something unexpected goes wrong.

| Method                                           | Returns                             |
| ------------------------------------------------ | ----------------------------------- |
| `boolVariation(key, context, default: boolean)`  | `boolean`                           |
| `stringVariation(key, context, default: string)` | `string`                            |
| `numberVariation(key, context, default: number)` | `number`                            |
| `jsonVariation(key, context, default)`           | any JSON value                      |
| `variation(key, context, default)`               | any flag value                      |
| `variationDetail(key, context, default)`         | `{ value, variationIndex, reason }` |

`variationDetail` explains the result:

| `reason.kind`  | Meaning                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `OFF`          | The flag is off                                                                                                                   |
| `TARGET_MATCH` | The context key is individually targeted                                                                                          |
| `RULE_MATCH`   | A targeting rule matched (`ruleIndex`, `ruleId`)                                                                                  |
| `FALLTHROUGH`  | No rule matched; the default rule applied                                                                                         |
| `ERROR`        | The default was served; `errorKind` says why: `CLIENT_NOT_READY`, `FLAG_NOT_FOUND`, `WRONG_TYPE`, `MALFORMED_FLAG` or `EXCEPTION` |

## Lifecycle

| Method                                | Description                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `waitForInitialization({ timeout? })` | Resolves `true` once flags are available, from the cache or the server, or `false` on timeout or an invalid key. Never rejects. |
| `isInitialized()`                     | Whether flags are available                                                                                                     |
| `getDataSource()`                     | `'none'`, `'cache'` or `'server'`: where the flags being served came from                                                       |
| `on(event, listener)`                 | Adds a listener and returns a function that removes it                                                                          |
| `close()`                             | Stops streaming or polling and resolves once pending cache writes finish. Flags stay readable.                                  |

| Event    | Listener                 | When                                                  |
| -------- | ------------------------ | ----------------------------------------------------- |
| `ready`  | `() => void`             | Flags first became available                          |
| `change` | `(key: string) => void`  | A flag was added, changed or removed                  |
| `error`  | `(error: Error) => void` | The SDK key was rejected; the client stops connecting |

## When the flag service is unavailable

- **While running**, the SDK keeps serving the flags it already has and reconnects with exponential backoff and jitter. If the stream keeps failing, for example behind a proxy that blocks SSE, it also fetches flags between attempts, sending an ETag so unchanged flags cost almost nothing.
- **On startup**, with `storage` set, it loads the last saved flags before connecting, so `waitForInitialization()` resolves with those flags even if the service is down. When the service answers, its flags replace the cached ones and `change` fires for anything that differs.
- **Quiet connections** that miss heartbeats for `streamTimeoutMs` are reopened.
- **An invalid or revoked key** stops the client and emits `error`. Flags already loaded stay readable.

The cache stores the flags and the first 12 characters of the SDK key, never the full key. A cache saved for a different key is ignored.

## Custom storage

Any object with `get` and `set` works; both can be sync or async:

```ts
import type { FlagStorage } from '@feature-flags/sdk';

const redisStorage: FlagStorage = {
  get: () => redis.get('feature-flags-cache'),
  set: (value) => redis.set('feature-flags-cache', value).then(() => {}),
};
```

`fileStorage(path)` writes to a temporary file and renames it into place, so a crash never leaves a half-written cache.

## Security

The SDK receives each flag's full targeting rules, including any user keys they list. Use it only on servers you control, never in browser code. Browser support, with keys that only receive evaluated values, is planned.
