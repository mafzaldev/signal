import { existsSync, readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { DEMO_FILE } from './src/shop.ts';

/** The client key the seed script saved, unless `SIGNAL_CLIENT_KEY` overrides it. */
function getClientKey() {
  if (process.env.SIGNAL_CLIENT_KEY) return process.env.SIGNAL_CLIENT_KEY;
  if (!existsSync(DEMO_FILE)) return undefined;
  return (JSON.parse(readFileSync(DEMO_FILE, 'utf8')) as { clientKey?: string }).clientKey;
}

export default defineConfig({
  plugins: [react()],
  define: {
    __SIGNAL_CONFIG__: JSON.stringify({
      clientKey: getClientKey(),
      apiUrl: process.env.SIGNAL_API_URL ?? 'http://localhost:4000',
      dashboardUrl: process.env.SIGNAL_DASHBOARD_URL ?? 'http://localhost:3000',
    }),
  },
  server: { port: Number(process.env.DEMO_PORT ?? 4100), strictPort: true },
});
