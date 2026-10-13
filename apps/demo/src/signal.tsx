import type { SignalClient } from '@mafzaldev/signal/browser';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

const SignalContext = createContext<SignalClient | null>(null);

/** Makes one `SignalClient` available to every component below it. */
export function SignalProvider({
  client,
  children,
}: {
  client: SignalClient;
  children: ReactNode;
}) {
  return <SignalContext.Provider value={client}>{children}</SignalContext.Provider>;
}

/**
 * The shared client. Components that read flags with it re-render when results arrive or
 * change, so values on screen stay live.
 */
export function useSignal(): SignalClient {
  const client = useContext(SignalContext);
  if (!client) throw new Error('useSignal must be used inside <SignalProvider>');
  const [, setVersion] = useState(0);
  useEffect(() => {
    const rerender = () => setVersion((v) => v + 1);
    const off = [client.on('ready', rerender), client.on('change', rerender)];
    return () => off.forEach((remove) => remove());
  }, [client]);
  return client;
}
