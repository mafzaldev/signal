import { existsSync } from 'node:fs';
import { createClient } from '@feature-flags/sdk';

if (existsSync('.env')) process.loadEnvFile('.env');

const sdkKey = process.env.FLAGS_SDK_KEY;
const baseUrl = process.env.FLAGS_API_URL ?? 'http://localhost:4000';
const flagKey = process.env.FLAG_KEY ?? 'new-checkout';

if (!sdkKey) {
  console.error('Set FLAGS_SDK_KEY to a key from the dashboard (project settings → SDK keys).');
  process.exit(1);
}

const users = [
  { key: 'user-1', country: 'PK' },
  { key: 'user-2', country: 'AE' },
  { key: 'user-3', country: 'US' },
];

const client = createClient({ sdkKey, baseUrl });

function print(label: string) {
  const values = users.map((user) => {
    const { value, reason } = client.variationDetail(flagKey, user, null);
    return `${user.key}(${user.country})=${JSON.stringify(value)} [${reason.kind}]`;
  });
  console.log(`${new Date().toISOString()} ${label}: ${values.join('  ')}`);
}

client.on('change', (key) => {
  if (key === flagKey) print('changed');
});

const ready = await client.waitForInitialization({ timeout: 5000 });
print(ready ? `"${flagKey}" loaded` : 'not initialized yet, serving defaults');
console.log('Toggle the flag in the dashboard; changes print here. Ctrl+C to quit.');

process.on('SIGINT', () => {
  client.close();
  process.exit(0);
});
