import { SignalClient } from '@mafzaldev/signal/browser';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { SHOPPERS } from './shop.ts';
import { SignalProvider } from './signal.tsx';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
const { clientKey, apiUrl } = __SIGNAL_CONFIG__;

if (!clientKey) {
  root.render(
    <main className="setup">
      <h1>No client key yet</h1>
      <p>
        Run <code>pnpm --filter @signal/demo seed</code>, then restart this page with{' '}
        <code>pnpm --filter @signal/demo start</code>.
      </p>
    </main>,
  );
} else {
  // One client for the whole page, created once, outside React's render cycle.
  const client = new SignalClient({ clientKey, baseUrl: apiUrl, context: SHOPPERS[0]! });
  root.render(
    <StrictMode>
      <SignalProvider client={client}>
        <App />
      </SignalProvider>
    </StrictMode>,
  );
}
