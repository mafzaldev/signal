import type { Flag, Ruleset } from '@signal/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, type ClientOptions, type FlagsClient } from './client.js';
import { fileStorage } from './node.js';
import { type FlagStorage, parseCache, serializeCache } from './storage.js';

function boolFlag(key: string, enabled: boolean, version = 1): Flag {
  return {
    key,
    version,
    salt: 'salt',
    enabled,
    variations: [{ value: true }, { value: false }],
    offVariation: 1,
    targets: [],
    rules: [],
    fallthrough: { variation: 0 },
  };
}

function ruleset(...flags: Flag[]): Ruleset {
  return { flags: Object.fromEntries(flags.map((f) => [f.key, f])), segments: {} };
}

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    get: () => value,
    set: vi.fn((next: string) => {
      value = next;
    }),
    read: () => value,
  } satisfies FlagStorage & { read(): string | null };
}

const SDK_KEY = 'sdk-resilience-test-key';
const user = { key: 'user-1' };
const quietLogger = { warn: () => {}, error: () => {} };
const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));
let client: FlagsClient | undefined;

function connect(options: Partial<ClientOptions>) {
  client = createClient({
    sdkKey: SDK_KEY,
    baseUrl: 'http://flags.test',
    logger: quietLogger,
    initialReconnectDelayMs: 1,
    maxReconnectDelayMs: 1,
    ...options,
  });
  return client;
}

const unreachable = vi.fn(async () => {
  throw new TypeError('fetch failed');
}) as unknown as typeof fetch;

/** Serves `/sdk/flags` from `current()`, honouring If-None-Match. */
function flagsServer(current: () => Ruleset) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (!String(url).endsWith('/sdk/flags')) return new Response('blocked', { status: 502 });
    const body = JSON.stringify(current());
    const etag = `"${body.length}-${body.includes('"enabled":true')}"`;
    const ifNoneMatch = (init?.headers as Record<string, string>)['if-none-match'];
    if (ifNoneMatch === etag) return new Response(null, { status: 304, headers: { etag } });
    return new Response(body, { status: 200, headers: { etag } });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

afterEach(async () => {
  await client?.close();
  client = undefined;
});

describe('persistent cache', () => {
  it('serves cached flags when the API is unreachable', async () => {
    const storage = memoryStorage(serializeCache(SDK_KEY, ruleset(boolFlag('f', true))));
    const flags = connect({ storage, fetch: unreachable });

    expect(await flags.waitForInitialization({ timeout: 100 })).toBe(true);
    expect(flags.getDataSource()).toBe('cache');
    expect(flags.boolVariation('f', user, false)).toBe(true);
  });

  it('ignores a cache saved for another key', async () => {
    const storage = memoryStorage(
      serializeCache('sdk-another-key-entirely', ruleset(boolFlag('f', true))),
    );
    const flags = connect({ storage, fetch: unreachable });

    expect(await flags.waitForInitialization({ timeout: 50 })).toBe(false);
    expect(flags.boolVariation('f', user, false)).toBe(false);
  });

  it('ignores an unreadable cache', async () => {
    const flags = connect({ storage: memoryStorage('{not json'), fetch: unreachable });
    expect(await flags.waitForInitialization({ timeout: 50 })).toBe(false);
  });

  it('replaces cached flags with server flags and saves them', async () => {
    const storage = memoryStorage(serializeCache(SDK_KEY, ruleset(boolFlag('f', false, 1))));
    const flags = connect({
      storage,
      streaming: false,
      fetch: flagsServer(() => ruleset(boolFlag('f', true, 2))),
    });
    const changes: string[] = [];
    flags.on('change', (key) => changes.push(key));

    await vi.waitFor(() => expect(flags.getDataSource()).toBe('server'));
    expect(flags.boolVariation('f', user, false)).toBe(true);
    expect(changes).toEqual(['f']);

    await flags.close();
    expect(parseCache(SDK_KEY, storage.read())?.flags.f?.version).toBe(2);
  });

  it('does not store the full SDK key', async () => {
    const storage = memoryStorage();
    connect({ storage, streaming: false, fetch: flagsServer(() => ruleset(boolFlag('f', true))) });
    await vi.waitFor(() => expect(storage.set).toHaveBeenCalled());
    expect(storage.read()).not.toContain(SDK_KEY);
  });
});

describe('fileStorage', () => {
  it('round-trips through a file and returns null when missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'flags-sdk-'));
    try {
      const storage = fileStorage(join(dir, 'nested', 'cache.json'));
      expect(await storage.get()).toBeNull();
      await storage.set('{"a":1}');
      expect(await storage.get()).toBe('{"a":1}');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('polling', () => {
  it('polls on an interval and sends the ETag', async () => {
    let current = ruleset(boolFlag('f', false, 1));
    const fetch = flagsServer(() => current);
    const flags = connect({ streaming: false, pollIntervalMs: 20, fetch });
    await flags.waitForInitialization();

    await tick(50);
    const etags = fetch.mock.calls.map(
      ([, init]) => ((init as RequestInit).headers as Record<string, string>)['if-none-match'],
    );
    expect(etags[0]).toBeUndefined();
    expect(etags.slice(1).every(Boolean)).toBe(true);

    current = ruleset(boolFlag('f', true, 2));
    await vi.waitFor(() => expect(flags.boolVariation('f', user, false)).toBe(true));
  });

  it('falls back to polling while the stream keeps failing', async () => {
    const fetch = flagsServer(() => ruleset(boolFlag('f', true)));
    const flags = connect({ fetch });

    expect(await flags.waitForInitialization({ timeout: 500 })).toBe(true);
    expect(flags.boolVariation('f', user, false)).toBe(true);
    const urls = fetch.mock.calls.map(([url]) => String(url));
    expect(urls.filter((u) => u.endsWith('/sdk/stream')).length).toBeGreaterThanOrEqual(2);
  });
});

describe('stalled streams', () => {
  it('reconnects when nothing arrives within the timeout', async () => {
    const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
        },
      });
      return new Response(body, { status: 200 });
    }) as unknown as typeof globalThis.fetch;
    connect({ fetch, streamTimeoutMs: 20 });

    await vi.waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThanOrEqual(3));
  });
});
