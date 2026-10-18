---
title: Browser SDK
description: Read flags in web pages with a public client key. Pages get each user's values, never the rules.
order: 7
section: SDKs
---

Browser code can't be trusted with targeting rules: a list of user keys or an email-domain rule is private. So in the browser, Signal evaluates flags on its side and sends back only the results for the user you pass.

## Install

It's part of the same package as the server SDK, imported from `@mafzaldev/signal/browser`:

```sh
npm install @mafzaldev/signal
```

Bundlers such as Vite, webpack and Next.js include only the browser client, so the server-side evaluation code stays out of your page.

## Setup

1. In project settings → SDK keys, create a key and choose **Client**. Client keys start with `client-` and are safe to ship in a web page: all they can do is ask for values.
2. On each flag the page should read, turn on **Client-side access** in the flag's settings. Flags without it are left out of the results.

## Quick start

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
```

When a flag changes, Signal tells the page over a stream and the client fetches its values again, so `change` fires within a second.

## Switching users

The context is set once, so methods don't take one. When the user signs in or changes, call `identify`:

```ts
await signal.identify({ key: 'user-77', country: 'AE' });
```

It resolves `true` once the new user's values have arrived from Signal, or `false` if Signal couldn't be reached. If `identify` is called again before that, only the latest user's values are applied.

Switching to a different `key` drops the previous user's values straight away, so one person's flags are never shown to another. Until the new user's values arrive, reads return their saved values if this browser has them, otherwise your defaults. Changing only attributes, with the same `key`, keeps the current values until the new ones arrive.

## When Signal is unavailable

- **While the page is open**, flags keep their last values and the client reconnects with backoff. When Signal is back, it fetches fresh values and `change` fires for anything that differs.
- **On a reload**, the client starts from the values it saved in `localStorage` for the same user, so the page doesn't fall back to defaults during an outage. `dataSource()` tells you which you have: `'server'`, `'cache'` or `'none'`.
- **On a first visit with Signal down**, there's nothing saved, so every read returns your default. Make defaults the safe, existing behaviour.

The saved entry holds the last user's evaluated values, never rules, under a key that includes the start of your client key, so environments don't mix. Values are only served back to the same user `key`. Pass `storage: null` to keep nothing, or your own object with `getItem` and `setItem`.

## Methods

| Method                                   | Description                                                                 |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| `bool(key, default)`                     | A boolean flag's value                                                      |
| `string(key, default)`                   | A string flag's value                                                       |
| `number(key, default)`                   | A number flag's value                                                       |
| `json(key, default)`                     | A JSON flag's value                                                         |
| `value(key, default)`                    | Any flag value                                                              |
| `detail(key, default)`                   | `{ value, variationIndex, reason }`, as in the server SDK                   |
| `allFlags()`                             | Every flag's value for the current user                                     |
| `context()` / `identify(ctx)`            | Read or change the current user                                             |
| `ready({ timeout? })`                    | Resolves `true` once values arrive, or `false` on timeout or a rejected key |
| `isReady()`                              | Whether there are values for the current user, from Signal or the cache     |
| `dataSource()`                           | `'server'`, `'cache'` or `'none'`: where the current values came from       |
| `on('ready' \| 'change' \| 'error', fn)` | Adds a listener; returns a function that removes it                         |
| `close()`                                | Stops listening for changes. Values stay readable                           |

Like the server SDK, every read returns your default until values arrive, for flags without client-side access, and for values of the wrong type.

## Options

| Option                    | Default        | Description                                                       |
| ------------------------- | -------------- | ----------------------------------------------------------------- |
| `clientKey`               | required       | A client key for the environment                                  |
| `baseUrl`                 | required       | URL of the Signal API                                             |
| `context`                 | required       | The first user to evaluate for                                    |
| `storage`                 | `localStorage` | Where to save the last values; `null` saves nothing               |
| `streamTimeoutMs`         | `60000`        | Reconnect if nothing, not even a heartbeat, arrives for this long |
| `initialReconnectDelayMs` | `1000`         | First reconnect delay                                             |
| `maxReconnectDelayMs`     | `30000`        | Longest reconnect delay                                           |
| `fetch`                   | global `fetch` | Custom fetch implementation                                       |
| `logger`                  | `console`      | Receives `warn` and `error` messages                              |

## Using it with React

Create one client outside your components and re-render when values change:

```tsx
const signal = new SignalClient({ clientKey, baseUrl, context: currentUser });

function useFlags() {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const rerender = () => setVersion((v) => v + 1);
    const off = [signal.on('ready', rerender), signal.on('change', rerender)];
    return () => off.forEach((remove) => remove());
  }, []);
  return signal;
}

function Checkout() {
  const flags = useFlags();
  return flags.bool('new-checkout', false) ? <OneClickCheckout /> : <ClassicCheckout />;
}
```

## Server or browser?

|                     | Server SDK                                  | Browser SDK                                 |
| ------------------- | ------------------------------------------- | ------------------------------------------- |
| Key                 | Server key, kept secret                     | Client key, public                          |
| Receives            | Every rule, evaluated in memory             | One user's values                           |
| Which flags         | All of them                                 | Only those with client-side access          |
| When Signal is down | Serves the last rules, even after a restart | Serves the last values, even after a reload |

If your page is rendered on a server you control, reading flags there with the server SDK keeps even the values off the network.
