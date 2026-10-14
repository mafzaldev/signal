/**
 * The server-rendered storefront: the same shop as the React app, but flags are read with
 * the server SDK and every page is rendered here, so the browser only receives finished
 * HTML. `GET /events` tells open pages when a flag changes, so they reload straight away.
 */
import { type Context, Signal } from '@mafzaldev/signal';
import { fileStorage } from '@mafzaldev/signal/node';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import {
  type Banner,
  COLORS,
  DEMO_FILE,
  ENVIRONMENT,
  explain,
  FLAGS,
  PRODUCTS,
  PROJECT,
  SHOPPERS,
  show,
} from './shop.ts';

const getSdkKey = () => {
  if (process.env.SIGNAL_SDK_KEY) return process.env.SIGNAL_SDK_KEY;
  if (!existsSync(DEMO_FILE)) return undefined;
  return (JSON.parse(readFileSync(DEMO_FILE, 'utf8')) as { sdkKey?: string }).sdkKey;
};

const sdkKey = getSdkKey();
if (!sdkKey) {
  console.error('No SDK key. Run `pnpm --filter @signal/demo seed` first, or set SIGNAL_SDK_KEY.');
  process.exit(1);
}

const port = Number(process.env.DEMO_SERVER_PORT ?? 4200);
const dashboard = process.env.SIGNAL_DASHBOARD_URL ?? 'http://localhost:3000';
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

const signal = new Signal({
  sdkKey,
  baseUrl: process.env.SIGNAL_API_URL ?? 'http://localhost:4000',
  storage: fileStorage('.flags-cache.json'),
});

const escape = (value: unknown) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const SOURCE = {
  server: 'Evaluated in this server with the server SDK. The browser only got finished HTML.',
  cache: 'Signal is unreachable: serving the last flags this server saved to disk.',
  none: 'No flags yet: every value is its fallback.',
};

function render(shopperKey: string) {
  const known = SHOPPERS.find((s) => s.key === shopperKey);
  // Unknown keys are "anonymous visitors": no country or plan, only the key for rollouts.
  const context: Context = known ?? { key: shopperKey };

  const newCheckout = signal.bool(FLAGS.newCheckout.key, context, FLAGS.newCheckout.fallback);
  const buttonColor = signal.string(FLAGS.buttonColor.key, context, FLAGS.buttonColor.fallback);
  const pageSize = signal.number(FLAGS.pageSize.key, context, FLAGS.pageSize.fallback);
  const darkMode = signal.bool(FLAGS.darkMode.key, context, FLAGS.darkMode.fallback);
  const banner = signal.json(FLAGS.promoBanner.key, context, null) as Banner;
  const served = Object.values(FLAGS).map(({ key, fallback }) => {
    const { value, reason } = signal.detail(key, context, fallback);
    return { key, value, explanation: explain(reason) };
  });
  const products = PRODUCTS.slice(0, pageSize);

  const visitorKey = known ? `visitor-${Math.floor(Math.random() * 9000 + 1000)}` : shopperKey;
  const shoppers = [
    ...SHOPPERS.map(
      (s) =>
        `<a class="shopper" href="/?shopper=${s.key}" aria-current="${s.key === shopperKey}">${escape(s.name)}<small>${s.country} · ${s.plan}</small></a>`,
    ),
    `<a class="shopper" href="/?shopper=${visitorKey}" aria-current="${!known}">Random visitor${known ? '' : `<small>${escape(shopperKey)}</small>`}</a>`,
  ].join('');

  return `<!doctype html>
<html lang="en" style="--accent: ${COLORS[buttonColor] ?? COLORS.blue}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Demo Shop (server) · Signal</title>
    <style>${styles}</style>
  </head>
  <body${darkMode ? ' class="dark"' : ''}>
    <header>
      <span class="brand">Demo Shop</span>
      <span class="live" id="live"><i></i><span>Rendered on the server</span></span>
      <nav class="shoppers" aria-label="Shop as">${shoppers}</nav>
    </header>
    ${banner?.text ? `<div class="banner">${escape(banner.text)}<span class="tag">promo-banner</span></div>` : ''}
    <main>
      <section>
        <div class="section-head">
          <h2>Products</h2>
          <p>Showing ${products.length} of ${PRODUCTS.length}</p>
          <span class="tag">search-page-size</span>
        </div>
        <div class="products">
          ${products
            .map(
              (p) =>
                `<div class="product"><div class="art" style="background: ${p.tint}">${p.initials}</div><div class="info"><div class="name">${escape(p.name)}</div><div class="price">$${p.price}</div></div></div>`,
            )
            .join('')}
        </div>
      </section>
      <aside>
        <div class="card">
          <div class="section-head">
            <h2>Your cart</h2>
            <span class="tag">new-checkout</span>
            <span class="tag">button-color</span>
          </div>
          <div class="cart-line"><span>Canvas tote</span><span>$24.00</span></div>
          <div class="cart-line"><span>Field notebook</span><span>$12.00</span></div>
          <div class="cart-line cart-total"><span>Total</span><span>$36.00</span></div>
          ${
            newCheckout
              ? '<button class="checkout">Pay $36.00 now</button><p class="one-click">One-click checkout with your saved card.</p>'
              : '<div class="steps"><span>1 · Shipping</span><span>2 · Payment</span><span>3 · Review</span></div><button class="checkout">Continue to shipping</button>'
          }
        </div>
        <div class="card">
          <div class="section-head"><h2>What Signal served</h2></div>
          <p class="context">
            Context: <code>${escape(JSON.stringify(context))}</code>${context.country ? '' : ' (no country or plan, so only rollouts apply)'}
          </p>
          <table class="flag-table">
            <tbody>
              ${served
                .map(
                  (f) =>
                    `<tr><td><code>${f.key}</code></td><td><code>${escape(show(f.value))}</code><span class="why">${escape(f.explanation)}</span></td></tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <div class="meta">
            <span>${SOURCE[signal.dataSource()]}</span>
            <a href="${dashboard}/projects/${PROJECT.key}?env=${ENVIRONMENT}" target="_blank" rel="noreferrer">Change these flags in the dashboard</a>
          </div>
        </div>
      </aside>
    </main>
    <script>
      // The only script on the page: reload when a flag changes, so the server renders again.
      const live = document.getElementById('live');
      const events = new EventSource('/events');
      events.onopen = () => live.classList.add('on');
      events.onerror = () => live.classList.remove('on');
      events.onmessage = () => location.reload();
    </script>
  </body>
</html>`;
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
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(render(url.searchParams.get('shopper') || SHOPPERS[0]!.key));
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
  console.log(`Server-rendered demo shop on http://localhost:${port}`);
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
