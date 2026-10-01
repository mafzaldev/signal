import type { Flag, Ruleset, StreamEvent } from '@signal/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClient, type FlagsClient } from './client.js';

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

/** A fake `/sdk/stream` whose events the test pushes one at a time. */
function fakeServer() {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const requests: { url: string; headers: Record<string, string> }[] = [];
  let status = 200;

  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), headers: init?.headers as Record<string, string> });
    if (status !== 200) return new Response('nope', { status });
    const body = new ReadableStream<Uint8Array>({
      start: (c) => {
        controller = c;
      },
    });
    init?.signal?.addEventListener('abort', () => controller.error(new Error('aborted')));
    return new Response(body, { status: 200 });
  }) as unknown as typeof globalThis.fetch;

  return {
    fetch,
    requests,
    setStatus: (s: number) => (status = s),
    send(event: StreamEvent | { type: 'ping'; data: string }) {
      controller.enqueue(
        encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`),
      );
    },
    disconnect: () => controller.close(),
  };
}

const quietLogger = { warn: () => {}, error: () => {} };
const user = { key: 'user-1' };
let client: FlagsClient | undefined;

function connect(server: ReturnType<typeof fakeServer>) {
  client = createClient({
    sdkKey: 'sdk-test',
    baseUrl: 'http://flags.test/',
    fetch: server.fetch,
    logger: quietLogger,
    initialReconnectDelayMs: 1,
    maxReconnectDelayMs: 1,
  });
  return client;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

afterEach(() => client?.close());

describe('FlagsClient', () => {
  it('serves defaults until the first ruleset arrives', async () => {
    const server = fakeServer();
    const flags = connect(server);
    expect(flags.boolVariation('on', user, false)).toBe(false);
    expect(flags.variationDetail('on', user, false).reason).toEqual({
      kind: 'ERROR',
      errorKind: 'CLIENT_NOT_READY',
    });

    await tick();
    server.send({ type: 'put', data: ruleset(boolFlag('on', true)) });
    expect(await flags.waitForInitialization()).toBe(true);
    expect(flags.boolVariation('on', user, false)).toBe(true);
  });

  it('sends the SDK key to the stream endpoint', async () => {
    const server = fakeServer();
    connect(server);
    await tick();
    expect(server.requests[0]).toMatchObject({
      url: 'http://flags.test/sdk/stream',
      headers: { authorization: 'sdk-test', accept: 'text/event-stream' },
    });
  });

  it('applies newer patches and ignores older ones', async () => {
    const server = fakeServer();
    const flags = connect(server);
    const changes: string[] = [];
    flags.on('change', (key) => changes.push(key));
    await tick();
    server.send({ type: 'put', data: ruleset(boolFlag('f', false, 2)) });
    await flags.waitForInitialization();

    server.send({ type: 'patch', data: { flag: boolFlag('f', true, 1) } });
    await tick();
    expect(flags.boolVariation('f', user, true)).toBe(false);

    server.send({ type: 'patch', data: { flag: boolFlag('f', true, 3) } });
    await tick();
    expect(flags.boolVariation('f', user, false)).toBe(true);
    expect(changes).toEqual(['f']);
  });

  it('removes deleted flags', async () => {
    const server = fakeServer();
    const flags = connect(server);
    await tick();
    server.send({ type: 'put', data: ruleset(boolFlag('f', true, 1)) });
    await flags.waitForInitialization();

    server.send({ type: 'delete', data: { key: 'f', version: 2 } });
    await tick();
    expect(flags.variationDetail('f', user, false).reason).toEqual({
      kind: 'ERROR',
      errorKind: 'FLAG_NOT_FOUND',
    });
  });

  it('returns the default for a value of the wrong type', async () => {
    const server = fakeServer();
    const flags = connect(server);
    await tick();
    server.send({ type: 'put', data: ruleset(boolFlag('f', true)) });
    await flags.waitForInitialization();

    expect(flags.stringVariation('f', user, 'fallback')).toBe('fallback');
    expect(
      flags.variationDetail('f', user, 'x', (v): v is string => typeof v === 'string').reason,
    ).toEqual({ kind: 'ERROR', errorKind: 'WRONG_TYPE' });
  });

  it('ignores heartbeats', async () => {
    const server = fakeServer();
    const flags = connect(server);
    await tick();
    server.send({ type: 'ping', data: '' });
    server.send({ type: 'put', data: ruleset(boolFlag('f', true)) });
    expect(await flags.waitForInitialization()).toBe(true);
  });

  it('reconnects after the stream ends and reports what changed meanwhile', async () => {
    const server = fakeServer();
    const flags = connect(server);
    await tick();
    server.send({ type: 'put', data: ruleset(boolFlag('a', true, 1), boolFlag('b', true, 1)) });
    await flags.waitForInitialization();
    const changes: string[] = [];
    flags.on('change', (key) => changes.push(key));

    server.disconnect();
    await tick();
    expect(server.fetch).toHaveBeenCalledTimes(2);
    server.send({ type: 'put', data: ruleset(boolFlag('a', true, 1), boolFlag('c', true, 1)) });
    await tick();

    expect(changes.sort()).toEqual(['b', 'c']);
    expect(flags.boolVariation('a', user, false)).toBe(true);
  });

  it('stops and reports an error for an invalid key', async () => {
    const server = fakeServer();
    server.setStatus(401);
    const flags = connect(server);
    const errors: Error[] = [];
    flags.on('error', (error) => errors.push(error));

    expect(await flags.waitForInitialization()).toBe(false);
    await tick();
    expect(server.fetch).toHaveBeenCalledTimes(1);
    expect(errors[0]?.message).toBe('Invalid SDK key');
  });

  it('times out waiting for initialization without throwing', async () => {
    const server = fakeServer();
    const flags = connect(server);
    expect(await flags.waitForInitialization({ timeout: 10 })).toBe(false);
  });

  it('fetches once when streaming is off', async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify(ruleset(boolFlag('f', true))), { status: 200 }),
    ) as unknown as typeof globalThis.fetch;
    client = createClient({ sdkKey: 'k', baseUrl: 'http://flags.test', streaming: false, fetch });
    expect(await client.waitForInitialization()).toBe(true);
    expect(client.boolVariation('f', user, false)).toBe(true);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe('http://flags.test/sdk/flags');
  });
});
