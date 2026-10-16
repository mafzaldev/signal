import type { ClientEvaluation, Context, FlagValue } from '@signal/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SignalClient, type ValueStorage } from './browser.js';

/**
 * A fake API: `/sdk/client/evaluate` answers from `values`, which the test may change per
 * context key, and `/sdk/client/stream` sends whatever the test pushes.
 */
function fakeServer(values: (context: Context) => Record<string, FlagValue>) {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const evaluations: Context[] = [];
  let status = 200;

  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (status !== 200) return new Response('nope', { status });
    if (String(url).endsWith('/sdk/client/evaluate')) {
      const { context } = JSON.parse(String(init?.body)) as { context: Context };
      evaluations.push(context);
      const flags: ClientEvaluation['flags'] = Object.fromEntries(
        Object.entries(values(context)).map(([key, value]) => [
          key,
          { value, variationIndex: 0, reason: { kind: 'FALLTHROUGH' } },
        ]),
      );
      return Response.json({ flags });
    }
    const body = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
        c.enqueue(encoder.encode('event: ping\ndata: \n\n'));
      },
    });
    init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
    return new Response(body, { status: 200 });
  }) as unknown as typeof globalThis.fetch;

  return {
    fetch,
    evaluations,
    setStatus: (s: number) => (status = s),
    change: () => controller.enqueue(encoder.encode('event: change\ndata: \n\n')),
  };
}

const quietLogger = { warn: () => {}, error: () => {} };
let client: SignalClient | undefined;

/** An in-memory stand-in for `localStorage`. */
function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

function connect(
  server: ReturnType<typeof fakeServer>,
  context: Context = { key: 'ayesha' },
  storage: ValueStorage | null = null,
  clientKey = 'client-test',
) {
  client = new SignalClient({
    clientKey,
    baseUrl: 'http://flags.test/',
    context,
    storage,
    fetch: server.fetch,
    logger: quietLogger,
    initialReconnectDelayMs: 1,
    maxReconnectDelayMs: 1,
  });
  return client;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

afterEach(() => client?.close());

describe('SignalClient', () => {
  it('serves defaults until the first results arrive', () => {
    const flags = connect(fakeServer(() => ({ 'new-checkout': true })));
    expect(flags.bool('new-checkout', false)).toBe(false);
    expect(flags.detail('new-checkout', false).reason).toEqual({
      kind: 'ERROR',
      errorKind: 'CLIENT_NOT_READY',
    });
  });

  it('sends the context and serves only the returned values', async () => {
    const server = fakeServer(() => ({ 'new-checkout': true, color: 'green', size: 12 }));
    const flags = connect(server, { key: 'ayesha', country: 'PK' });
    expect(await flags.ready({ timeout: 500 })).toBe(true);

    expect(server.evaluations[0]).toEqual({ key: 'ayesha', country: 'PK' });
    expect(flags.bool('new-checkout', false)).toBe(true);
    expect(flags.string('color', 'blue')).toBe('green');
    expect(flags.number('size', 6)).toBe(12);
    expect(flags.allFlags()).toEqual({ 'new-checkout': true, color: 'green', size: 12 });
  });

  it('returns the default for unknown flags and wrong types', async () => {
    const flags = connect(fakeServer(() => ({ color: 'green' })));
    await flags.ready({ timeout: 500 });
    expect(flags.detail('missing', 'x').reason).toEqual({
      kind: 'ERROR',
      errorKind: 'FLAG_NOT_FOUND',
    });
    expect(flags.bool('color', false)).toBe(false);
    const isBoolean = (v: FlagValue): v is boolean => typeof v === 'boolean';
    expect(flags.detail('color', false, isBoolean).reason).toEqual({
      kind: 'ERROR',
      errorKind: 'WRONG_TYPE',
    });
  });

  it('evaluates again on a change event and reports changed flags', async () => {
    let on = false;
    const server = fakeServer(() => ({ 'new-checkout': on, color: 'blue' }));
    const flags = connect(server);
    await flags.ready({ timeout: 500 });
    const changed: string[] = [];
    flags.on('change', (key) => changed.push(key));

    on = true;
    server.change();
    await vi.waitFor(() => expect(flags.bool('new-checkout', false)).toBe(true));
    expect(changed).toEqual(['new-checkout']);
  });

  it('switches context with identify', async () => {
    const server = fakeServer((context) => ({ 'new-checkout': context.key === 'bilal' }));
    const flags = connect(server);
    await flags.ready({ timeout: 500 });
    expect(flags.bool('new-checkout', true)).toBe(false);

    await flags.identify({ key: 'bilal' });
    expect(flags.context()).toEqual({ key: 'bilal' });
    expect(flags.bool('new-checkout', false)).toBe(true);
  });

  it('applies only the latest context when identify is called quickly', async () => {
    const server = fakeServer((context) => ({ who: context.key }));
    const flags = connect(server);
    await flags.ready({ timeout: 500 });

    void flags.identify({ key: 'bilal' });
    await flags.identify({ key: 'sara' });
    expect(flags.string('who', '')).toBe('sara');
  });

  it('stops and reports an error for a rejected key', async () => {
    const server = fakeServer(() => ({}));
    server.setStatus(403);
    const flags = connect(server);
    const error = new Promise<string>((resolve) => flags.on('error', (e) => resolve(e.message)));
    expect(await flags.ready()).toBe(false);
    expect(await error).toBe('Invalid client key');

    const calls = vi.mocked(server.fetch).mock.calls.length;
    await tick();
    expect(vi.mocked(server.fetch).mock.calls.length).toBe(calls);
  });

  it('sends the client key and talks to the client endpoints', async () => {
    const server = fakeServer(() => ({}));
    const flags = connect(server);
    await flags.ready({ timeout: 500 });
    const calls = vi.mocked(server.fetch).mock.calls;
    const urls = calls.map(([url]) => String(url));
    expect(urls).toContain('http://flags.test/sdk/client/stream');
    expect(urls).toContain('http://flags.test/sdk/client/evaluate');
    for (const [, init] of calls) {
      expect((init?.headers as Record<string, string>).authorization).toBe('client-test');
    }
  });

  describe('when Signal is down', () => {
    it("drops the previous user's values when switching user", async () => {
      const server = fakeServer((context) => ({ who: context.key }));
      const flags = connect(server);
      await flags.ready({ timeout: 500 });
      expect(flags.string('who', 'nobody')).toBe('ayesha');

      server.setStatus(503);
      const changed: string[] = [];
      flags.on('change', (key) => changed.push(key));
      expect(await flags.identify({ key: 'bilal' })).toBe(false);

      expect(flags.string('who', 'nobody')).toBe('nobody');
      expect(flags.dataSource()).toBe('none');
      expect(flags.detail('who', 'nobody').reason).toEqual({
        kind: 'ERROR',
        errorKind: 'CLIENT_NOT_READY',
      });
      expect(changed).toEqual(['who']);
    });

    it('keeps the values when only the attributes change', async () => {
      const server = fakeServer(() => ({ color: 'green' }));
      const flags = connect(server);
      await flags.ready({ timeout: 500 });
      server.setStatus(503);
      expect(await flags.identify({ key: 'ayesha', plan: 'pro' })).toBe(false);
      expect(flags.string('color', 'blue')).toBe('green');
    });

    it('starts from the values saved for the same user', async () => {
      const storage = memoryStorage();
      const online = fakeServer(() => ({ color: 'green' }));
      const first = connect(online, { key: 'ayesha' }, storage);
      await first.ready({ timeout: 500 });
      expect(first.dataSource()).toBe('server');
      first.close();

      const offline = fakeServer(() => ({}));
      offline.setStatus(503);
      const flags = connect(offline, { key: 'ayesha' }, storage);
      expect(await flags.ready({ timeout: 500 })).toBe(true);
      expect(flags.dataSource()).toBe('cache');
      expect(flags.string('color', 'blue')).toBe('green');
    });

    it('never serves saved values to another user or another key', async () => {
      const storage = memoryStorage();
      const first = connect(
        fakeServer(() => ({ color: 'green' })),
        { key: 'ayesha' },
        storage,
      );
      await first.ready({ timeout: 500 });
      first.close();

      const offline = fakeServer(() => ({}));
      offline.setStatus(503);
      const otherUser = connect(offline, { key: 'bilal' }, storage);
      expect(await otherUser.ready({ timeout: 50 })).toBe(false);
      expect(otherUser.string('color', 'blue')).toBe('blue');
      otherUser.close();

      const otherKey = connect(offline, { key: 'ayesha' }, storage, 'client-other-env');
      expect(await otherKey.ready({ timeout: 50 })).toBe(false);
      expect(otherKey.string('color', 'blue')).toBe('blue');
    });

    it('switches back to saved values for the user they belong to', async () => {
      const storage = memoryStorage();
      const first = connect(
        fakeServer(() => ({ who: 'ayesha' })),
        { key: 'ayesha' },
        storage,
      );
      await first.ready({ timeout: 500 });
      first.close();

      const offline = fakeServer(() => ({}));
      offline.setStatus(503);
      const flags = connect(offline, { key: 'ayesha' }, storage);
      await flags.ready({ timeout: 500 });
      expect(flags.string('who', 'nobody')).toBe('ayesha');

      await flags.identify({ key: 'bilal' });
      expect(flags.dataSource()).toBe('none');
      expect(flags.string('who', 'nobody')).toBe('nobody');

      await flags.identify({ key: 'ayesha' });
      expect(flags.dataSource()).toBe('cache');
      expect(flags.string('who', 'nobody')).toBe('ayesha');
    });

    it('works without storage, or with storage that throws', async () => {
      const broken = {
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => {
          throw new Error('quota exceeded');
        },
      };
      const flags = connect(
        fakeServer(() => ({ color: 'green' })),
        { key: 'ayesha' },
        broken,
      );
      expect(await flags.ready({ timeout: 500 })).toBe(true);
      expect(flags.string('color', 'blue')).toBe('green');
    });
  });
});
