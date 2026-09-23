'use client';

import { useActionState, useTransition } from 'react';
import { Badge, Button, ErrorMessage, Field, Input } from '@/components/ui';
import type { Environment, SdkKey } from '@/lib/types';
import { createSdkKey, revokeSdkKey } from '../../actions';

function NewKeyNotice({ sdkKey }: { sdkKey: string }) {
  return (
    <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <p className="font-medium">Copy this key now. It won&apos;t be shown again.</p>
      <div className="flex gap-2">
        <code className="flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 font-mono text-xs">
          {sdkKey}
        </code>
        <Button variant="secondary" onClick={() => navigator.clipboard.writeText(sdkKey)}>
          Copy
        </Button>
      </div>
    </div>
  );
}

export function EnvironmentSdkKeys({
  projectKey,
  environment,
  keys,
}: {
  projectKey: string;
  environment: Environment;
  keys: SdkKey[];
}) {
  const [state, action, creating] = useActionState(
    createSdkKey.bind(null, projectKey, environment.key),
    undefined,
  );
  const [revoking, startRevoking] = useTransition();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{environment.name}</h3>
      {keys.length > 0 ? (
        <ul className="divide-y divide-zinc-100 rounded-md border border-zinc-200">
          {keys.map((key) => (
            <li key={key.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="font-medium">{key.name}</span>
              <code className="font-mono text-xs text-zinc-500">{key.keyPrefix}…</code>
              <Badge>{key.kind}</Badge>
              <span className="ml-auto text-xs text-zinc-500">
                {new Date(key.createdAt).toLocaleDateString()}
              </span>
              <Button
                variant="ghost"
                disabled={revoking}
                onClick={() => {
                  if (
                    !window.confirm(`Revoke "${key.name}"? Apps using it stop receiving flags.`)
                  ) {
                    return;
                  }
                  startRevoking(() => revokeSdkKey(projectKey, environment.key, key.id));
                }}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No keys.</p>
      )}
      {state?.key && <NewKeyNotice sdkKey={state.key} />}
      <form action={action} className="flex items-end gap-3">
        <div className="w-60">
          <Field label="Key name">
            <Input name="name" placeholder="e.g. Checkout service" required />
          </Field>
        </div>
        <Button type="submit" variant="secondary" disabled={creating}>
          Create key
        </Button>
        <ErrorMessage>{state?.error}</ErrorMessage>
      </form>
    </div>
  );
}
