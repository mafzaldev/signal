/**
 * The demo storefront: a page whose layout, colours and copy come from Signal flags.
 * `GET /` serves the page, `GET /api/state?shopper=` evaluates every flag for a shopper,
 * and `GET /events` tells open pages when a flag changes so they refresh straight away.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { Signal, type DetailReason } from '@mafzaldev/signal';
import { fileStorage } from '@mafzaldev/signal/node';
import { DEMO_FILE, ENVIRONMENT, FLAGS, PROJECT, SHOPPERS } from './shop.ts';

if (existsSync('.env')) process.loadEnvFile('.env');

const sdkKey =
  process.env.SIGNAL_SDK_KEY ??
  (existsSync(DEMO_FILE)
    ? (JSON.parse(readFileSync(DEMO_FILE, 'utf8')) as { sdkKey?: string }).sdkKey
    : undefined);
if (!sdkKey) {
  console.error('No SDK key. Run `pnpm --filter @signal/demo seed` first, or set SIGNAL_SDK_KEY.');
  process.exit(1);
}

const port = Number(process.env.DEMO_PORT ?? 4100);
const dashboard = process.env.SIGNAL_DASHBOARD_URL ?? 'http://localhost:3000';
const page = readFileSync(new URL('./page.html', import.meta.url), 'utf8');

const signal = new Signal({
  sdkKey,
  baseUrl: process.env.SIGNAL_API_URL ?? 'http://localhost:4000',
  // Lets the shop start with the last known flags even when Signal is down.
  storage: fileStorage('.flags-cache.json'),
});

/** Plain-language reason, the same wording the dashboard's test panel uses. */
function explain(reason: DetailReason): string {
  switch (reason.kind) {
    case 'OFF':
      return 'Flag is off';
    case 'TARGET_MATCH':
      return 'Individually targeted';
    case 'RULE_MATCH':
      return `Rule ${String(reason.ruleIndex + 1).padStart(2, '0')} matched`;
    case 'FALLTHROUGH':
      return 'Default rule';
    case 'ERROR':
      return `Fallback value (${reason.errorKind.toLowerCase().replaceAll('_', ' ')})`;
  }
}

function state(shopperKey: string) {
  const known = SHOPPERS.find((s) => s.key === shopperKey);
  // Unknown keys are "anonymous visitors": no country or plan, only the key for rollouts.
  const context = known ?? { key: shopperKey || 'visitor' };
  const flags = Object.fromEntries(
    Object.entries(FLAGS).map(([name, { key, fallback }]) => {
      const { value, reason } = signal.detail(key, context, fallback);
      return [name, { key, value, reason: reason.kind, explanation: explain(reason) }];
    }),
  );
  return { context, flags, source: signal.dataSource() };
}

const listeners = new Set<ServerResponse>();
signal.on('change', (key) => {
  for (const res of listeners) res.write(`data: ${JSON.stringify({ key })}\n\n`);
});
// Keeps idle connections open through proxies that close quiet streams.
setInterval(() => {
  for (const res of listeners) res.write(': ping\n\n');
}, 25_000).unref();

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      page
        .replace('__SHOPPERS__', JSON.stringify(SHOPPERS))
        .replace('__DASHBOARD_URL__', `${dashboard}/projects/${PROJECT.key}?env=${ENVIRONMENT}`),
    );
  } else if (url.pathname === '/api/state') {
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(state(url.searchParams.get('shopper') ?? '')));
  } else if (url.pathname === '/events') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    listeners.add(res);
    req.on('close', () => listeners.delete(res));
  } else {
    res.writeHead(404).end('Not found');
  }
});

const ready = await signal.ready({ timeout: 5000 });
server.listen(port, () => {
  console.log(`Demo storefront on http://localhost:${port}`);
  if (!ready) console.log('Signal is not reachable yet; serving fallback values until it is.');
});

const shutdown = async () => {
  server.close();
  for (const res of listeners) res.end();
  await signal.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
