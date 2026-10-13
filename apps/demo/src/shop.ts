/** What the demo storefront needs from Signal, shared by the seed script and the React app. */

export const PROJECT = { key: 'shop', name: 'Demo Shop' };
export const ENVIRONMENT = 'development';

/** Where the seed script saves the client key, so `pnpm start` works without any setup. */
export const DEMO_FILE = '.signal-demo.json';

/** Example shoppers to switch between. Their attributes are what the flags target. */
export const SHOPPERS = [
  { key: 'ayesha', name: 'Ayesha', country: 'PK', plan: 'free' },
  { key: 'bilal', name: 'Bilal', country: 'PK', plan: 'pro' },
  { key: 'sara', name: 'Sara', country: 'AE', plan: 'pro' },
  { key: 'john', name: 'John', country: 'US', plan: 'free' },
];

export type Banner = { text: string } | null;

/**
 * The flags the storefront reads, each with the value it falls back to when Signal can't
 * answer. Kept in one list so the seed script and the page agree on keys and types.
 */
export const FLAGS = {
  newCheckout: { key: 'new-checkout', fallback: false },
  buttonColor: { key: 'button-color', fallback: 'blue' },
  pageSize: { key: 'search-page-size', fallback: 6 },
  darkMode: { key: 'dark-mode', fallback: false },
  promoBanner: { key: 'promo-banner', fallback: null as Banner },
} as const;
