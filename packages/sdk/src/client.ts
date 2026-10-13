import {
  evaluate,
  type Context,
  type EvaluationReason,
  type Flag,
  type FlagValue,
  type JsonValue,
  type Ruleset,
  type Segment,
  type StreamEvent,
} from '@signal/core';
import { describeError, reconnectDelay, sleep } from './retry.js';
import { parseSse } from './sse.js';
import { type FlagStorage, parseCache, serializeCache } from './storage.js';

export interface SignalOptions {
  sdkKey: string;
  /** Base URL of the flags API, e.g. `https://signal.example.com`. */
  baseUrl: string;
  /**
   * Receive changes live over SSE (default). When false, flags are polled every
   * `pollIntervalMs`.
   */
  streaming?: boolean;
  /** Polling interval when not streaming. Default 30s. */
  pollIntervalMs?: number;
  /**
   * Keeps the last known flags so the app can start while the API is down,
   * e.g. `fileStorage()` from `@mafzaldev/signal/node`.
   */
  storage?: FlagStorage;
  /** Reconnect if nothing, not even a heartbeat, arrives for this long. Default 60s. */
  streamTimeoutMs?: number;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  logger?: Pick<Console, 'warn' | 'error'>;
  /** First reconnect delay; doubles on each failure up to `maxReconnectDelayMs`. */
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export type ErrorKind = 'CLIENT_NOT_READY' | 'FLAG_NOT_FOUND' | 'WRONG_TYPE' | 'EXCEPTION';

export type DetailReason = EvaluationReason | { kind: 'ERROR'; errorKind: ErrorKind };

export interface EvaluationDetail<T> {
  value: T;
  variationIndex: number | null;
  reason: DetailReason;
}

/** Where the flags currently being served came from. */
export type DataSource = 'none' | 'cache' | 'server';

type Events = {
  /** Flags are available, from the cache or the server, whichever came first. */
  ready: () => void;
  /** A flag was added, changed or removed. */
  change: (key: string) => void;
  error: (error: Error) => void;
};

class InvalidKeyError extends Error {}

/**
 * Reads one environment's flags. It downloads them, keeps them up to date over Server-Sent
 * Events and evaluates them in-process. Create one when your app starts and reuse it.
 */
export class Signal {
  private readonly options: Required<Omit<SignalOptions, 'fetch' | 'storage'>> &
    Pick<SignalOptions, 'storage'> & { fetch: typeof fetch };
  private flags = new Map<string, Flag>();
  private segments: Record<string, Segment> = {};
  private readonly listeners: { [E in keyof Events]: Set<Events[E]> } = {
    ready: new Set(),
    change: new Set(),
    error: new Set(),
  };
  private readonly abort = new AbortController();
  private initialized = false;
  private source: DataSource = 'none';
  /** ETag of the last ruleset fetched with `GET /sdk/flags`. */
  private etag: string | undefined;
  /** Serializes cache writes so an older ruleset never overwrites a newer one. */
  private saving = Promise.resolve();
  private readonly initialization: Promise<boolean>;
  private settleInitialization!: (initialized: boolean) => void;

  constructor(options: SignalOptions) {
    this.options = {
      streaming: true,
      logger: console,
      pollIntervalMs: 30_000,
      streamTimeoutMs: 60_000,
      initialReconnectDelayMs: 1_000,
      maxReconnectDelayMs: 30_000,
      ...options,
      baseUrl: options.baseUrl.replace(/\/+$/, ''),
      fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    };
    this.initialization = new Promise((resolve) => (this.settleInitialization = resolve));
    void this.start();
  }

  /**
   * Resolves `true` once flags are loaded, or `false` if that fails or takes
   * longer than `timeout` ms. Never rejects: until flags load, every
   * evaluation returns its default value.
   */
  ready({ timeout }: { timeout?: number } = {}): Promise<boolean> {
    if (timeout === undefined) return this.initialization;
    return Promise.race([
      this.initialization,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeout)),
    ]);
  }

  isReady() {
    return this.initialized;
  }

  dataSource(): DataSource {
    return this.source;
  }

  detail<T extends FlagValue>(
    key: string,
    context: Context,
    defaultValue: T,
    /** Rejects values of the wrong type, serving the default instead. */
    isType?: (value: FlagValue) => value is T,
  ): EvaluationDetail<T> {
    const fallback = (errorKind: ErrorKind): EvaluationDetail<T> => ({
      value: defaultValue,
      variationIndex: null,
      reason: { kind: 'ERROR', errorKind },
    });
    try {
      if (!this.initialized) return fallback('CLIENT_NOT_READY');
      const flag = this.flags.get(key);
      if (!flag) return fallback('FLAG_NOT_FOUND');

      const result = evaluate(flag, context, this.segments);
      if (result.value === null && result.reason.kind === 'ERROR') {
        return { value: defaultValue, variationIndex: null, reason: result.reason };
      }
      if (isType && !isType(result.value as FlagValue)) return fallback('WRONG_TYPE');
      return {
        value: result.value as T,
        variationIndex: result.variationIndex,
        reason: result.reason,
      };
    } catch {
      return fallback('EXCEPTION');
    }
  }

  value<T extends FlagValue>(key: string, context: Context, defaultValue: T): FlagValue {
    return this.detail(key, context, defaultValue).value;
  }

  bool(key: string, context: Context, defaultValue: boolean): boolean {
    return this.detail(key, context, defaultValue, isBoolean).value;
  }

  string(key: string, context: Context, defaultValue: string): string {
    return this.detail(key, context, defaultValue, isString).value;
  }

  number(key: string, context: Context, defaultValue: number): number {
    return this.detail(key, context, defaultValue, isNumber).value;
  }

  json<T extends JsonValue>(key: string, context: Context, defaultValue: T): JsonValue {
    return this.detail<JsonValue>(key, context, defaultValue).value;
  }

  /** Returns a function that removes the listener. */
  on<E extends keyof Events>(event: E, listener: Events[E]): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  /**
   * Stops streaming or polling. Evaluations keep using the last known flags.
   * Resolves once any pending cache write has finished.
   */
  close(): Promise<void> {
    this.abort.abort();
    this.settleInitialization(this.initialized);
    return this.saving;
  }

  private emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>) {
    for (const listener of this.listeners[event]) {
      try {
        (listener as (...a: Parameters<Events[E]>) => void)(...args);
      } catch (error) {
        this.options.logger.error('[signal] listener threw', error);
      }
    }
  }

  private async start() {
    await this.loadFromStorage();
    await (this.options.streaming ? this.stream() : this.poll());
  }

  private async loadFromStorage() {
    const { storage, sdkKey } = this.options;
    if (!storage) return;
    try {
      const ruleset = parseCache(sdkKey, await storage.get());
      if (ruleset) this.applyRuleset(ruleset, 'cache');
    } catch (error) {
      this.options.logger.warn('[signal] could not read the flag cache', error);
    }
  }

  private save() {
    const { storage, sdkKey } = this.options;
    if (!storage) return;
    const value = serializeCache(sdkKey, {
      flags: Object.fromEntries(this.flags),
      segments: this.segments,
    });
    this.saving = this.saving
      .then(() => storage.set(value))
      .catch((error: unknown) =>
        this.options.logger.warn('[signal] could not save the flag cache', error),
      );
  }

  private request(path: string, headers: Record<string, string>, signal = this.abort.signal) {
    return this.options.fetch(`${this.options.baseUrl}${path}`, {
      headers: { authorization: this.options.sdkKey, ...headers },
      signal,
    });
  }

  private checkResponse(res: Response) {
    if (res.status === 401 || res.status === 403) throw new InvalidKeyError('Invalid SDK key');
    if (!res.ok && res.status !== 304) {
      throw new Error(`Flags request failed with status ${res.status}`);
    }
  }

  /** One `GET /sdk/flags`, skipped by the server (304) if nothing changed. */
  private async fetchRuleset() {
    const res = await this.request('/sdk/flags', {
      accept: 'application/json',
      ...(this.etag ? { 'if-none-match': this.etag } : {}),
    });
    this.checkResponse(res);
    if (res.status === 304) return;
    const ruleset = (await res.json()) as Ruleset;
    this.etag = res.headers.get('etag') ?? undefined;
    this.applyRuleset(ruleset, 'server');
  }

  private async poll() {
    while (!this.abort.signal.aborted) {
      try {
        await this.fetchRuleset();
      } catch (error) {
        if (this.abort.signal.aborted) return;
        if (error instanceof InvalidKeyError) return this.fail(error);
        this.options.logger.warn(`[signal] polling failed: ${describeError(error)}`);
      }
      await this.sleep(this.options.pollIntervalMs);
    }
  }

  private async stream() {
    let attempt = 0;
    while (!this.abort.signal.aborted) {
      // Aborted when the client closes or the connection goes quiet for too long.
      const connection = new AbortController();
      const onClose = () => connection.abort();
      this.abort.signal.addEventListener('abort', onClose, { once: true });
      let watchdog: ReturnType<typeof setTimeout> | undefined;
      const resetWatchdog = () => {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => connection.abort(), this.options.streamTimeoutMs);
      };

      try {
        resetWatchdog();
        const res = await this.request(
          '/sdk/stream',
          { accept: 'text/event-stream' },
          connection.signal,
        );
        this.checkResponse(res);
        if (!res.body) throw new Error('Flags stream has no body');
        for await (const message of parseSse(res.body)) {
          resetWatchdog();
          if (message.event === 'ping') continue;
          this.apply({ type: message.event, data: JSON.parse(message.data) } as StreamEvent);
          attempt = 0;
        }
      } catch (error) {
        if (this.abort.signal.aborted) return;
        if (error instanceof InvalidKeyError) return this.fail(error);
        this.options.logger.warn(
          `[signal] stream disconnected (${describeError(error)}), reconnecting`,
        );
      } finally {
        clearTimeout(watchdog);
        this.abort.signal.removeEventListener('abort', onClose);
      }

      // After repeated failures (e.g. a proxy that blocks SSE), poll between
      // reconnect attempts so flags stay current.
      if (attempt >= 1) await this.fetchRuleset().catch(() => {});
      await this.sleep(this.reconnectDelay(attempt++));
    }
  }

  private reconnectDelay(attempt: number) {
    const { initialReconnectDelayMs, maxReconnectDelayMs } = this.options;
    return reconnectDelay(attempt, initialReconnectDelayMs, maxReconnectDelayMs);
  }

  private sleep(ms: number) {
    return sleep(ms, this.abort.signal);
  }

  private fail(error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    this.options.logger.error('[signal]', err.message);
    this.emit('error', err);
    this.settleInitialization(false);
  }

  private apply(event: StreamEvent) {
    switch (event.type) {
      case 'put':
        // A streamed ruleset has no ETag; the next poll must fetch in full.
        this.etag = undefined;
        return this.applyRuleset(event.data, 'server');
      case 'patch': {
        const current = this.flags.get(event.data.flag.key);
        if (current && current.version >= event.data.flag.version) return;
        this.flags.set(event.data.flag.key, event.data.flag);
        this.save();
        return this.emit('change', event.data.flag.key);
      }
      case 'delete': {
        const current = this.flags.get(event.data.key);
        if (!current || current.version >= event.data.version) return;
        this.flags.delete(event.data.key);
        this.save();
        return this.emit('change', event.data.key);
      }
    }
  }

  private applyRuleset(ruleset: Ruleset, source: Exclude<DataSource, 'none'>) {
    const previous = this.flags;
    this.flags = new Map(Object.entries(ruleset.flags));
    this.segments = ruleset.segments;
    this.source = source;
    if (source === 'server') this.save();

    if (!this.initialized) {
      this.initialized = true;
      this.settleInitialization(true);
      this.emit('ready');
      return;
    }
    // After a reconnect (or replacing cached flags), report what changed.
    for (const key of new Set([...previous.keys(), ...this.flags.keys()])) {
      if (previous.get(key)?.version !== this.flags.get(key)?.version) this.emit('change', key);
    }
  }
}

const isBoolean = (v: FlagValue): v is boolean => typeof v === 'boolean';
const isString = (v: FlagValue): v is string => typeof v === 'string';
const isNumber = (v: FlagValue): v is number => typeof v === 'number';
