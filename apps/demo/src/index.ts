import { existsSync } from 'node:fs';
import { Signal } from '@mafzaldev/signal';
import { fileStorage } from '@mafzaldev/signal/node';

if (existsSync('.env')) process.loadEnvFile('.env');

const sdkKey = process.env.SIGNAL_SDK_KEY;
const baseUrl = process.env.SIGNAL_API_URL ?? 'http://localhost:4000';
const flagKey = process.env.FLAG_KEY ?? 'new-checkout';

if (!sdkKey) {
  console.error('Set SIGNAL_SDK_KEY to a key from the dashboard (project settings → SDK keys).');
  process.exit(1);
}

const users = [
  { key: 'user-1', country: 'PK' },
  { key: 'user-2', country: 'AE' },
  { key: 'user-3', country: 'US' },
];

// The cache lets the demo start with the last known flags even when the API is down.
const signal = new Signal({ sdkKey, baseUrl, storage: fileStorage('.flags-cache.json') });

function print(label: string) {
  const values = users.map((user) => {
    const { value, reason } = signal.detail(flagKey, user, null);
    return `${user.key}(${user.country})=${JSON.stringify(value)} [${reason.kind}]`;
  });
  const source = signal.dataSource();
  console.log(`${new Date().toISOString()} ${label} (from ${source}): ${values.join('  ')}`);
}

signal.on('change', (key) => {
  if (key === flagKey) print('changed');
});

const ready = await signal.ready({ timeout: 5000 });
print(ready ? `"${flagKey}" loaded` : 'not initialized yet, serving defaults');
console.log('Toggle the flag in the dashboard; changes print here. Ctrl+C to quit.');

process.on('SIGINT', async () => {
  await signal.close();
  process.exit(0);
});
