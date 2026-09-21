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
} from '@feature-flags/core';
import { parseSse } from './sse.js';

export interface ClientOptions {
  sdkKey: string;
  /** Base URL of the flags API, e.g. `https://flags.example.com`. */
  baseUrl: string;
  /** Receive changes live over SSE (default). When false, flags are fetched once. */
  streaming?: boolean;
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

type Events = {
  /** The first ruleset arrived. */
  ready: () => void;
  /** A flag was added, changed or removed. */
  change: (key: string) => void;
  error: (error: Error) => void;
};

class InvalidKeyError extends Error {}

export class FlagsClient {
  private readonly options: Required<Omit<ClientOptions, 'fetch'>> & { fetch: typeof fetch };
  private flags = new Map<string, Flag>();
  private segments: Record<string, Segment> = {};
  private readonly listeners: { [E in keyof Events]: Set<Events[E]> } = {
    ready: new Set(),
    change: new Set(),
    error: new Set(),
  };
  private readonly abort = new AbortController();
  private initialized = false;
  private readonly initialization: Promise<boolean>;
  private settleInitialization!: (initialized: boolean) => void;

  constructor(options: ClientOptions) {
    this.options = {
      streaming: true,
      logger: console,
      initialReconnectDelayMs: 1_000,
      maxReconnectDelayMs: 30_000,
      ...options,
      baseUrl: options.baseUrl.replace(/\/+$/, ''),
      fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    };
    this.initialization = new Promise((resolve) => (this.settleInitialization = resolve));
    void (this.options.streaming ? this.stream() : this.fetchOnce());
  }

  /**
   * Resolves `true` once flags are loaded, or `false` if that fails or takes
   * longer than `timeout` ms. Never rejects: until flags load, every
   * evaluation returns its default value.
   */
  waitForInitialization({ timeout }: { timeout?: number } = {}): Promise<boolean> {
    if (timeout === undefined) return this.initialization;
    return Promise.race([
      this.initialization,
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeout)),
    ]);
  }

  isInitialized() {
    return this.initialized;
  }

  variationDetail<T extends FlagValue>(
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

  variation<T extends FlagValue>(key: string, context: Context, defaultValue: T): FlagValue {
    return this.variationDetail(key, context, defaultValue).value;
  }

  boolVariation(key: string, context: Context, defaultValue: boolean): boolean {
    return this.variationDetail(key, context, defaultValue, isBoolean).value;
  }

  stringVariation(key: string, context: Context, defaultValue: string): string {
    return this.variationDetail(key, context, defaultValue, isString).value;
  }

  numberVariation(key: string, context: Context, defaultValue: number): number {
    return this.variationDetail(key, context, defaultValue, isNumber).value;
  }

  jsonVariation<T extends JsonValue>(key: string, context: Context, defaultValue: T): JsonValue {
    return this.variationDetail<JsonValue>(key, context, defaultValue).value;
  }

  /** Returns a function that removes the listener. */
  on<E extends keyof Events>(event: E, listener: Events[E]): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  /** Stops streaming. Evaluations keep using the last known flags. */
  close() {
    this.abort.abort();
    this.settleInitialization(this.initialized);
  }

  private emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>) {
    for (const listener of this.listeners[event]) {
      try {
        (listener as (...a: Parameters<Events[E]>) => void)(...args);
      } catch (error) {
        this.options.logger.error('[flags] listener threw', error);
      }
    }
  }

  private request(path: string, accept: string) {
    return this.options.fetch(`${this.options.baseUrl}${path}`, {
      headers: { authorization: this.options.sdkKey, accept },
      signal: this.abort.signal,
    });
  }

  private checkResponse(res: Response) {
    if (res.status === 401 || res.status === 403) throw new InvalidKeyError('Invalid SDK key');
    if (!res.ok) throw new Error(`Flags request failed with status ${res.status}`);
  }

  private async fetchOnce() {
    try {
      const res = await this.request('/sdk/flags', 'application/json');
      this.checkResponse(res);
      this.applyRuleset((await res.json()) as Ruleset);
    } catch (error) {
      this.fail(error);
    }
  }

  private async stream() {
    let attempt = 0;
    while (!this.abort.signal.aborted) {
      try {
        const res = await this.request('/sdk/stream', 'text/event-stream');
        this.checkResponse(res);
        if (!res.body) throw new Error('Flags stream has no body');
        for await (const message of parseSse(res.body)) {
          if (message.event === 'ping') continue;
          this.apply({ type: message.event, data: JSON.parse(message.data) } as StreamEvent);
          attempt = 0;
        }
      } catch (error) {
        if (this.abort.signal.aborted) return;
        if (error instanceof InvalidKeyError) return this.fail(error);
        this.options.logger.warn('[flags] stream disconnected, reconnecting', error);
      }
      await this.sleep(this.reconnectDelay(attempt++));
    }
  }

  private reconnectDelay(attempt: number) {
    const { initialReconnectDelayMs, maxReconnectDelayMs } = this.options;
    const base = Math.min(maxReconnectDelayMs, initialReconnectDelayMs * 2 ** attempt);
    // Jitter spreads reconnects out so clients don't all retry at the same moment.
    return base / 2 + Math.random() * (base / 2);
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.abort.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  private fail(error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    this.options.logger.error('[flags]', err.message);
    this.emit('error', err);
    this.settleInitialization(false);
  }

  private apply(event: StreamEvent) {
    switch (event.type) {
      case 'put':
        return this.applyRuleset(event.data);
      case 'patch': {
        const current = this.flags.get(event.data.flag.key);
        if (current && current.version >= event.data.flag.version) return;
        this.flags.set(event.data.flag.key, event.data.flag);
        return this.emit('change', event.data.flag.key);
      }
      case 'delete': {
        const current = this.flags.get(event.data.key);
        if (!current || current.version >= event.data.version) return;
        this.flags.delete(event.data.key);
        return this.emit('change', event.data.key);
      }
    }
  }

  private applyRuleset(ruleset: Ruleset) {
    const previous = this.flags;
    this.flags = new Map(Object.entries(ruleset.flags));
    this.segments = ruleset.segments;

    if (!this.initialized) {
      this.initialized = true;
      this.settleInitialization(true);
      this.emit('ready');
      return;
    }
    // After a reconnect, report whatever changed while disconnected.
    for (const key of new Set([...previous.keys(), ...this.flags.keys()])) {
      if (previous.get(key)?.version !== this.flags.get(key)?.version) this.emit('change', key);
    }
  }
}

const isBoolean = (v: FlagValue): v is boolean => typeof v === 'boolean';
const isString = (v: FlagValue): v is string => typeof v === 'string';
const isNumber = (v: FlagValue): v is number => typeof v === 'number';

export function createClient(options: ClientOptions) {
  return new FlagsClient(options);
}
