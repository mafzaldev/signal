/**
 * Sets up everything the storefront needs: a demo account, organization and project, five
 * flags with targeting and client-side access, and a client key for the browser SDK. Safe to run again: existing things are reused and
 * the flags' targeting is reset to the starting point.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DEMO_FILE, ENVIRONMENT, FLAGS, PROJECT } from './shop.ts';

if (existsSync('.env')) process.loadEnvFile('.env');

const API = process.env.SIGNAL_API_URL ?? 'http://localhost:4000';
// Sign-up and sign-in must come from an origin the API trusts, which is the dashboard's.
const DASHBOARD = process.env.SIGNAL_DASHBOARD_URL ?? 'http://localhost:3000';
const ACCOUNT = {
  name: 'Demo Owner',
  email: process.env.SIGNAL_DEMO_EMAIL ?? 'demo@signal.dev',
  password: process.env.SIGNAL_DEMO_PASSWORD ?? 'signal-demo',
};

let cookie = '';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      origin: DASHBOARD,
      cookie,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie().map((c) => c.split(';')[0]);
  if (setCookie.length) cookie = setCookie.join('; ');
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw Object.assign(new Error(`${method} ${path} → ${res.status}: ${data?.message ?? text}`), {
      status: res.status,
    });
  }
  return data as T;
}

/** Creates something, treating "already exists" as success. */
async function create(path: string, body: unknown) {
  try {
    await call('POST', path, body);
  } catch (error) {
    if ((error as { status?: number }).status !== 409) throw error;
  }
}

const rule = (id: string, attribute: string, values: string[], variation: number) => ({
  id,
  clauses: [{ attribute, operator: 'in', values }],
  serve: { variation },
});

async function main() {
  try {
    await call('GET', '/health');
  } catch {
    throw new Error(`The API isn't reachable at ${API}. Start it with \`pnpm dev\` first.`);
  }

  try {
    await call('POST', '/api/auth/sign-in/email', {
      email: ACCOUNT.email,
      password: ACCOUNT.password,
    });
  } catch {
    await call('POST', '/api/auth/sign-up/email', ACCOUNT);
  }

  const organizations = await call<{ id: string }[]>('GET', '/api/auth/organization/list');
  if (organizations.length === 0) {
    await call('POST', '/api/auth/organization/create', {
      name: 'Demo Shop',
      slug: `demo-shop-${Math.random().toString(36).slice(2, 8)}`,
    });
  } else {
    await call('POST', '/api/auth/organization/set-active', {
      organizationId: organizations[0]!.id,
    });
  }

  await create('/projects', PROJECT);
  const flags = `/projects/${PROJECT.key}/flags`;

  await create(flags, {
    key: 'new-checkout',
    name: 'New checkout',
    description: 'One-click checkout instead of the three-step flow',
    kind: 'boolean',
  });
  await create(flags, {
    key: 'button-color',
    name: 'Button color',
    description: 'Colour of the checkout button',
    kind: 'string',
    variations: [{ value: 'blue' }, { value: 'green' }, { value: 'orange' }],
  });
  await create(flags, {
    key: 'search-page-size',
    name: 'Products per page',
    kind: 'number',
    variations: [{ value: 6 }, { value: 12 }, { value: 24 }],
  });
  await create(flags, {
    key: 'dark-mode',
    name: 'Dark mode',
    description: 'Dark theme for the storefront',
    kind: 'boolean',
  });
  await create(flags, {
    key: 'promo-banner',
    name: 'Promo banner',
    description: 'Banner shown above the products',
    kind: 'json',
    variations: [{ value: null }, { value: { text: 'Free shipping in Pakistan this week' } }],
  });

  // The storefront reads every flag from the browser, so they all need client-side access.
  for (const { key } of Object.values(FLAGS)) {
    await call('PATCH', `${flags}/${key}`, { clientSide: true });
  }

  // One kind of result per flag, so every reason shows up somewhere in the demo.
  const configure = (key: string, config: unknown) =>
    call('PATCH', `${flags}/${key}/environments/${ENVIRONMENT}`, config);
  await configure('new-checkout', {
    enabled: true,
    targets: [{ variation: 0, values: ['john'] }],
    rules: [rule('pakistan', 'country', ['PK'], 0)],
    fallthrough: { variation: 1 },
  });
  await configure('button-color', {
    enabled: true,
    targets: [],
    rules: [],
    fallthrough: {
      rollout: [
        { variation: 0, weight: 50_000 },
        { variation: 1, weight: 50_000 },
        { variation: 2, weight: 0 },
      ],
    },
  });
  await configure('search-page-size', {
    enabled: true,
    targets: [],
    rules: [rule('pro-plan', 'plan', ['pro'], 2)],
    fallthrough: { variation: 1 },
  });
  await configure('dark-mode', { enabled: false, offVariation: 1 });
  await configure('promo-banner', {
    enabled: true,
    targets: [],
    rules: [rule('pakistan', 'country', ['PK'], 1)],
    fallthrough: { variation: 0 },
  });

  // Keep the key from an earlier run; the API only reveals a key when it's created.
  const saved = existsSync(DEMO_FILE)
    ? (JSON.parse(readFileSync(DEMO_FILE, 'utf8')) as { clientKey?: string })
    : {};
  let clientKey = saved.clientKey;
  if (!clientKey) {
    ({ key: clientKey } = await call<{ key: string }>(
      'POST',
      `/projects/${PROJECT.key}/environments/${ENVIRONMENT}/sdk-keys`,
      { name: 'Demo storefront', kind: 'client' },
    ));
  }
  writeFileSync(DEMO_FILE, `${JSON.stringify({ clientKey }, null, 2)}\n`);

  console.log(`Demo ready.

  Storefront:  pnpm --filter @signal/demo start, then open http://localhost:4100
  Dashboard:   ${DASHBOARD}/projects/${PROJECT.key}
               sign in as ${ACCOUNT.email} / ${ACCOUNT.password} to change the flags

The client key is saved in apps/demo/${DEMO_FILE}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
