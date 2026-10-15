---
title: SDK HTTP API
description: The endpoints the SDKs use, for building a client in another language.
order: 9
section: Reference
---

The SDKs talk to four endpoints. You only need this page to write an SDK for another language; otherwise use the [server](/docs/server-sdk) or [browser](/docs/browser-sdk) SDK.

Send the key as `Authorization: <key>` or `Authorization: Bearer <key>`. Every endpoint serves the key's environment. A missing, unknown or revoked key gets `401`; a key of the wrong kind gets `403`.

## Server endpoints

Use a server key.

### GET /sdk/flags

Returns the environment's rules:

```json
{
  "flags": {
    "new-checkout": {
      "key": "new-checkout",
      "version": 3,
      "salt": "4f6c…",
      "enabled": true,
      "variations": [{ "value": true }, { "value": false }],
      "offVariation": 1,
      "targets": [],
      "rules": [],
      "fallthrough": { "variation": 0 }
    }
  },
  "segments": {}
}
```

The response has an `ETag`. Send it back as `If-None-Match` and the API answers `304 Not Modified` until something changes.

### GET /sdk/stream

Server-Sent Events:

| Event    | Data               | What to do                                                 |
| -------- | ------------------ | ---------------------------------------------------------- |
| `put`    | The whole rule set | Replace everything. Always the first event on a connection |
| `patch`  | `{ flag }`         | Replace that flag if its `version` is newer than yours     |
| `delete` | `{ key, version }` | Remove the flag if `version` is newer than yours           |
| `ping`   | empty              | Heartbeat every 20 seconds                                 |

Each connection starts with a fresh `put`, so a reconnecting client is up to date. Reconnect with backoff, and stop on `401` or `403`.

## Browser endpoints

Use a client key. These two endpoints accept requests from any website.

### POST /sdk/client/evaluate

Evaluates every flag with client-side access for the context in the body:

```json
// Request
{ "context": { "key": "user-42", "country": "PK" } }

// Response
{
  "flags": {
    "new-checkout": {
      "value": true,
      "variationIndex": 0,
      "reason": { "kind": "RULE_MATCH", "ruleIndex": 0, "ruleId": "pk-users" }
    }
  }
}
```

`context.key` is required. Other attributes can be strings, numbers, booleans or arrays of them, up to 100 attributes. Anything else gets `400`.

### GET /sdk/client/stream

Server-Sent Events with no flag data:

| Event    | What to do                                                                       |
| -------- | -------------------------------------------------------------------------------- |
| `ping`   | Sent first on each connection, then every 20 seconds. Evaluate once on the first |
| `change` | A flag changed: call `POST /sdk/client/evaluate` again                           |
