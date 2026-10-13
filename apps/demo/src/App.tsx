import type { ClientDetailReason, Context, FlagValue } from '@mafzaldev/signal/browser';
import { useEffect, useRef, useState } from 'react';
import { type Banner, ENVIRONMENT, FLAGS, PROJECT, SHOPPERS } from './shop.ts';
import { useSignal } from './signal.tsx';

const COLORS: Record<string, string> = {
  blue: '#2563eb',
  green: '#16a34a',
  orange: '#ea580c',
};
const TINTS = ['#f9d7c4', '#cfe3f7', '#d8ecd2', '#f4e3a8', '#e6d5f3', '#f3cfd8'];
const PRODUCTS = [
  'Canvas tote',
  'Field notebook',
  'Wool beanie',
  'Desk lamp',
  'Ceramic mug',
  'Linen shirt',
  'Trail socks',
  'Leather wallet',
  'Water bottle',
  'Wall clock',
  'Rain jacket',
  'Sketch pens',
  'Travel pillow',
  'Cotton scarf',
  'Plant pot',
  'Phone stand',
  'Tea tin',
  'Card holder',
  'Throw blanket',
  'Pocket knife',
  'Desk mat',
  'Sun hat',
  'Key ring',
  'Wooden tray',
].map((name, i) => ({
  name,
  price: (8 + ((i * 7) % 40)).toFixed(2),
  tint: TINTS[i % TINTS.length],
  initials: name
    .split(' ')
    .map((word) => word[0])
    .join(''),
}));

/** Plain-language reason, the same wording the dashboard's test panel uses. */
function explain(reason: ClientDetailReason): string {
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

const show = (value: FlagValue) => (typeof value === 'string' ? value : JSON.stringify(value));

export function App() {
  const signal = useSignal();
  const [shopper, setShopper] = useState<Context>(signal.context());
  // True while a new shopper's values load, so their differences don't flash as changes.
  const switching = useRef(false);
  const live = useLiveStatus();

  const newCheckout = signal.bool(FLAGS.newCheckout.key, FLAGS.newCheckout.fallback);
  const buttonColor = signal.string(FLAGS.buttonColor.key, FLAGS.buttonColor.fallback);
  const pageSize = signal.number(FLAGS.pageSize.key, FLAGS.pageSize.fallback);
  const darkMode = signal.bool(FLAGS.darkMode.key, FLAGS.darkMode.fallback);
  const banner = signal.json(FLAGS.promoBanner.key, FLAGS.promoBanner.fallback) as Banner;

  const served = Object.values(FLAGS).map(({ key, fallback }) => {
    const { value, reason } = signal.detail(key, fallback as FlagValue);
    return { key, value, explanation: explain(reason) };
  });
  const flashing = useFlashing(served, switching.current);

  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
    document.documentElement.style.setProperty('--accent', COLORS[buttonColor] ?? COLORS.blue!);
  }, [darkMode, buttonColor]);

  async function shopAs(context: Context) {
    setShopper(context);
    switching.current = true;
    await signal.identify(context);
    switching.current = false;
  }

  const visitor = !SHOPPERS.some((s) => s.key === shopper.key);
  const products = PRODUCTS.slice(0, pageSize);

  return (
    <>
      <header>
        <span className="brand">Demo Shop</span>
        <span className={live.on ? 'live on' : 'live'}>
          <i />
          <span>{live.text}</span>
        </span>
        <nav className="shoppers" aria-label="Shop as">
          {SHOPPERS.map((s) => (
            <button key={s.key} aria-pressed={s.key === shopper.key} onClick={() => shopAs(s)}>
              {s.name}
              <small>
                {s.country} · {s.plan}
              </small>
            </button>
          ))}
          <button
            aria-pressed={visitor}
            onClick={() => shopAs({ key: `visitor-${Math.floor(Math.random() * 9000 + 1000)}` })}
          >
            Random visitor{visitor && <small>{shopper.key}</small>}
          </button>
        </nav>
      </header>

      {banner?.text && (
        <div className="banner">
          {banner.text}
          <span className="tag">promo-banner</span>
        </div>
      )}

      <main>
        <section>
          <div className="section-head">
            <h2>Products</h2>
            <p>
              Showing {products.length} of {PRODUCTS.length}
            </p>
            <span className="tag">search-page-size</span>
          </div>
          <div className="products">
            {products.map((p) => (
              <div className="product" key={p.name}>
                <div className="art" style={{ background: p.tint }}>
                  {p.initials}
                </div>
                <div className="info">
                  <div className="name">{p.name}</div>
                  <div className="price">${p.price}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside>
          <div className="card">
            <div className="section-head">
              <h2>Your cart</h2>
              <span className="tag">new-checkout</span>
              <span className="tag">button-color</span>
            </div>
            <div className="cart-line">
              <span>Canvas tote</span>
              <span>$24.00</span>
            </div>
            <div className="cart-line">
              <span>Field notebook</span>
              <span>$12.00</span>
            </div>
            <div className="cart-line cart-total">
              <span>Total</span>
              <span>$36.00</span>
            </div>
            {newCheckout ? (
              <>
                <button className="checkout">Pay $36.00 now</button>
                <p className="one-click">One-click checkout with your saved card.</p>
              </>
            ) : (
              <>
                <div className="steps">
                  <span>1 · Shipping</span>
                  <span>2 · Payment</span>
                  <span>3 · Review</span>
                </div>
                <button className="checkout">Continue to shipping</button>
              </>
            )}
          </div>

          <div className="card">
            <div className="section-head">
              <h2>What Signal served</h2>
            </div>
            <p className="context">
              Context: <code>{JSON.stringify(shopper)}</code>
              {!shopper.country && ' (no country or plan, so only rollouts apply)'}
            </p>
            <table className="flag-table">
              <tbody>
                {served.map((flag) => (
                  <tr key={flag.key} className={flashing(flag.key) ? 'flash' : undefined}>
                    <td>
                      <code>{flag.key}</code>
                    </td>
                    <td>
                      <code>{show(flag.value)}</code>
                      <span className="why">{flag.explanation}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="meta">
              <span>
                Evaluated by the Signal API for this shopper. The page only receives the values,
                never the rules.
              </span>
              <a
                href={`${__SIGNAL_CONFIG__.dashboardUrl}/projects/${PROJECT.key}?env=${ENVIRONMENT}`}
                target="_blank"
                rel="noreferrer"
              >
                Change these flags in the dashboard
              </a>
            </div>
          </div>
        </aside>
      </main>
    </>
  );
}

/** "Live · updated 3s ago" once results arrive, or why they didn't. */
function useLiveStatus() {
  const signal = useSignal();
  const [updatedAt, setUpdatedAt] = useState<number | null>(signal.isReady() ? Date.now() : null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const updated = () => setUpdatedAt(Date.now());
    const off = [
      signal.on('ready', updated),
      signal.on('change', updated),
      signal.on('error', () => setFailed(true)),
    ];
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      off.forEach((remove) => remove());
      clearInterval(timer);
    };
  }, [signal]);

  if (failed) return { on: false, text: 'Client key rejected' };
  if (updatedAt === null) return { on: false, text: 'Connecting…' };
  const seconds = Math.round((now - updatedAt) / 1000);
  return { on: true, text: seconds < 2 ? 'Live · just updated' : `Live · updated ${seconds}s ago` };
}

const FLASH_MS = 1600;

/**
 * Whether a flag's value changed in the last moment, so its row can flash. Kept across
 * renders (the status line re-renders every second) and paused while switching shopper,
 * when every value may differ without anything having changed.
 */
function useFlashing(served: { key: string; value: FlagValue }[], paused: boolean) {
  const seen = useRef({ values: new Map<string, string>(), changedAt: new Map<string, number>() });
  const { values, changedAt } = seen.current;
  const now = Date.now();
  for (const { key, value } of served) {
    const json = JSON.stringify(value);
    if (!paused && values.has(key) && values.get(key) !== json) changedAt.set(key, now);
    values.set(key, json);
  }
  return (key: string) => now - (changedAt.get(key) ?? 0) < FLASH_MS;
}
