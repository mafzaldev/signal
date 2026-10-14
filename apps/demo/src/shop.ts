/**
 * What the demo storefronts need from Signal and share with each other: the seed script,
 * the React app (browser SDK) and the server-rendered shop (server SDK).
 */
import type { DetailReason, FlagValue } from '@mafzaldev/signal';
import type { ClientDetailReason } from '@mafzaldev/signal/browser';

export const PROJECT = { key: 'shop', name: 'Demo Shop' };
export const ENVIRONMENT = 'development';

/** Where the seed script saves the keys, so both shops start without any setup. */
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

/** The checkout button's colour for each `button-color` value. */
export const COLORS: Record<string, string> = {
  blue: '#2563eb',
  green: '#16a34a',
  orange: '#ea580c',
};
const TINTS = ['#f9d7c4', '#cfe3f7', '#d8ecd2', '#f4e3a8', '#e6d5f3', '#f3cfd8'];
/** The catalog; `search-page-size` decides how many are shown. */
export const PRODUCTS = [
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
export function explain(reason: DetailReason | ClientDetailReason): string {
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

/** A flag value as text. */
export const show = (value: FlagValue) =>
  typeof value === 'string' ? value : JSON.stringify(value);
