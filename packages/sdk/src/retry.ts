/** Exponential backoff with jitter: doubles from `initialMs` up to `maxMs`. */
export function reconnectDelay(attempt: number, initialMs: number, maxMs: number) {
  const base = Math.min(maxMs, initialMs * 2 ** attempt);
  // Jitter spreads reconnects out so clients don't all retry at the same moment.
  return base / 2 + Math.random() * (base / 2);
}

/** Waits `ms`, or less if `signal` aborts first. Never rejects. */
export function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

/** One line, e.g. "fetch failed: ECONNREFUSED", so outages don't flood logs with stacks. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause as { code?: string; message?: string } | undefined;
  const detail = cause?.code ?? cause?.message;
  return detail ? `${error.message}: ${detail}` : error.message;
}
