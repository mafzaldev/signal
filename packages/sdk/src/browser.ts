import type {
  ClientEvaluation,
  ClientFlagResult,
  Context,
  FlagValue,
  JsonValue,
} from '@signal/core';
import { describeError, reconnectDelay, sleep } from './retry.js';
import { parseSse } from './sse.js';

export interface SignalClientOptions {
  /** A client key from project settings. It's public, so it's safe to ship in a web page. */
  clientKey: string;
  /** Base URL of the flags API, e.g. `https://signal.example.com`. */
  baseUrl: string;
  /** Who flags are evaluated for, e.g. the signed-in user. Change it with `identify()`. */
  context: Context;
  /** Reconnect if nothing, not even a heartbeat, arrives for this long. Default 60s. */
  streamTimeoutMs?: number;
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  logger?: Pick<Console, 'warn' | 'error'>;
  /** First reconnect delay; doubles on each failure up to `maxReconnectDelayMs`. */
  initialReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export type ClientErrorKind = 'CLIENT_NOT_READY' | 'FLAG_NOT_FOUND' | 'WRONG_TYPE';

export type ClientDetailReason =
  ClientFlagResult['reason'] | { kind: 'ERROR'; errorKind: ClientErrorKind };

export interface ClientEvaluationDetail<T> {
  value: T;
  variationIndex: number | null;
  reason: ClientDetailReason;
}

type Events = {
  /** The first results arrived. */
  ready: () => void;
  /** A flag's value changed for the current context. */
  change: (key: string) => void;
  error: (error: Error) => void;
};

class InvalidKeyError extends Error {}

/**
 * Reads flags in the browser. The server evaluates them for one context and sends back only
 * the results, so rules and targeting lists never reach the page. Results stay live: when a
 * flag changes, the client asks again. Create one when your app starts and reuse it.
 */
export class SignalClient {
  private readonly options: Required<Omit<SignalClientOptions, 'fetch' | 'context'>> & {
    fetch: typeof fetch;
  };
  private currentContext: Context;
  private flags = new Map<string, ClientFlagResult>();
  private readonly listeners: { [E in keyof Events]: Set<Events[E]> } = {
    ready: new Set(),
    change: new Set(),
    error: new Set(),
  };
  private readonly abort = new AbortController();
  private initialized = false;
  /** The evaluation in flight, if any. */
  private refreshing: Promise<void> | undefined;
  /** Set when something changed during the evaluation in flight, so it runs once more. */
  private stale = false;
  private readonly initialization: Promise<boolean>;
  private settleInitialization!: (initialized: boolean) => void;

  constructor(options: SignalClientOptions) {
    const { context, ...rest } = options;
    this.options = {
      logger: console,
      streamTimeoutMs: 60_000,
      initialReconnectDelayMs: 1_000,
      maxReconnectDelayMs: 30_000,
      ...rest,
      baseUrl: options.baseUrl.replace(/\/+$/, ''),
      fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    };
    this.currentContext = context;
    this.initialization = new Promise((resolve) => (this.settleInitialization = resolve));
    void this.stream();
  }

  /**
   * Resolves `true` once results are loaded, or `false` if that fails or takes longer
   * than `timeout` ms. Never rejects: until then, every flag returns its default value.
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

  context(): Context {
    return this.currentContext;
  }

  /** Switches to another context, e.g. after sign-in, and resolves once its results are in. */
  identify(context: Context): Promise<void> {
    this.currentContext = context;
    return this.refresh();
  }

  detail<T extends FlagValue>(
    key: string,
    defaultValue: T,
    /** Rejects values of the wrong type, serving the default instead. */
    isType?: (value: FlagValue) => value is T,
  ): ClientEvaluationDetail<T> {
    const fallback = (errorKind: ClientErrorKind): ClientEvaluationDetail<T> => ({
      value: defaultValue,
      variationIndex: null,
      reason: { kind: 'ERROR', errorKind },
    });
    if (!this.initialized) return fallback('CLIENT_NOT_READY');
    const result = this.flags.get(key);
    if (!result) return fallback('FLAG_NOT_FOUND');
    if (isType && !isType(result.value)) return fallback('WRONG_TYPE');
    return {
      value: result.value as T,
      variationIndex: result.variationIndex,
      reason: result.reason,
    };
  }

  value<T extends FlagValue>(key: string, defaultValue: T): FlagValue {
    return this.detail(key, defaultValue).value;
  }

  bool(key: string, defaultValue: boolean): boolean {
    return this.detail(key, defaultValue, isBoolean).value;
  }

  string(key: string, defaultValue: string): string {
    return this.detail(key, defaultValue, isString).value;
  }

  number(key: string, defaultValue: number): number {
    return this.detail(key, defaultValue, isNumber).value;
  }

  json<T extends JsonValue>(key: string, defaultValue: T): JsonValue {
    return this.detail<JsonValue>(key, defaultValue).value;
  }

  /** Every flag's value for the current context. */
  allFlags(): Record<string, FlagValue> {
    return Object.fromEntries([...this.flags].map(([key, result]) => [key, result.value]));
  }

  /** Returns a function that removes the listener. */
  on<E extends keyof Events>(event: E, listener: Events[E]): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  /** Stops listening for changes. Flags keep their last values. */
  close() {
    this.abort.abort();
    this.settleInitialization(this.initialized);
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

  private request(path: string, init: RequestInit, signal = this.abort.signal) {
    return this.options.fetch(`${this.options.baseUrl}${path}`, {
      ...init,
      headers: { authorization: this.options.clientKey, ...init.headers },
      signal,
    });
  }

  private checkResponse(res: Response) {
    if (res.status === 401 || res.status === 403) throw new InvalidKeyError('Invalid client key');
    if (!res.ok) throw new Error(`Flags request failed with status ${res.status}`);
  }

  /** Evaluates again; calls made while one is in flight are folded into one more run. */
  private refresh(): Promise<void> {
    this.stale = true;
    this.refreshing ??= (async () => {
      try {
        while (this.stale && !this.abort.signal.aborted) {
          this.stale = false;
          await this.evaluate();
        }
      } finally {
        // Cleared in the same step as the last check, so no call can slip in between.
        this.refreshing = undefined;
      }
    })();
    return this.refreshing;
  }

  private async evaluate() {
    const context = this.currentContext;
    try {
      const res = await this.request('/sdk/client/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ context }),
      });
      this.checkResponse(res);
      const { flags } = (await res.json()) as ClientEvaluation;
      // A newer context was set while this one was in flight; its own run will apply.
      if (context !== this.currentContext) return;
      this.apply(flags);
    } catch (error) {
      if (this.abort.signal.aborted) return;
      if (error instanceof InvalidKeyError) return this.fail(error);
      this.options.logger.warn(`[signal] evaluation failed: ${describeError(error)}`);
    }
  }

  private apply(flags: ClientEvaluation['flags']) {
    const previous = this.flags;
    this.flags = new Map(Object.entries(flags));
    if (!this.initialized) {
      this.initialized = true;
      this.settleInitialization(true);
      this.emit('ready');
      return;
    }
    for (const key of new Set([...previous.keys(), ...this.flags.keys()])) {
      const before = previous.get(key);
      const after = this.flags.get(key);
      if (JSON.stringify(before?.value) !== JSON.stringify(after?.value)) this.emit('change', key);
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
          '/sdk/client/stream',
          { headers: { accept: 'text/event-stream' } },
          connection.signal,
        );
        this.checkResponse(res);
        if (!res.body) throw new Error('Flags stream has no body');
        // Evaluate on every connect, which also catches changes missed while disconnected.
        void this.refresh();
        for await (const message of parseSse(res.body)) {
          resetWatchdog();
          attempt = 0;
          if (message.event === 'change') void this.refresh();
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

      // If streaming keeps failing (e.g. a proxy that blocks it), still evaluate between
      // reconnect attempts so the page gets values.
      if (attempt >= 1) await this.refresh();
      const { initialReconnectDelayMs, maxReconnectDelayMs } = this.options;
      await sleep(
        reconnectDelay(attempt++, initialReconnectDelayMs, maxReconnectDelayMs),
        this.abort.signal,
      );
    }
  }

  private fail(error: Error) {
    this.options.logger.error('[signal]', error.message);
    this.emit('error', error);
    this.settleInitialization(false);
    this.abort.abort();
  }
}

const isBoolean = (v: FlagValue): v is boolean => typeof v === 'boolean';
const isString = (v: FlagValue): v is string => typeof v === 'string';
const isNumber = (v: FlagValue): v is number => typeof v === 'number';

export type { Context, FlagValue, JsonValue } from '@signal/core';
