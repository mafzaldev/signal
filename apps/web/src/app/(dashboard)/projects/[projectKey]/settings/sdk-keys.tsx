'use client';

import { useActionState, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CopyButton } from '@/components/copy-button';
import { useConfirm } from '@/components/dialog';
import { Sheet, SheetActions } from '@/components/sheet';
import { EnvironmentDot } from '@/components/environment';
import { KeyIcon, PlusIcon } from '@/components/icons';
import { Badge, Button, ErrorMessage, Field, Input } from '@/components/ui';
import type { Environment, SdkKey } from '@/lib/types';
import { createSdkKey, revokeSdkKey } from '../../actions';

function CreateKeyForm({
  projectKey,
  environment,
  onDone,
}: {
  projectKey: string;
  environment: Environment;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    createSdkKey.bind(null, projectKey, environment.key),
    undefined,
  );

  if (state?.key) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <div className="rounded-md bg-signal-wash px-3 py-2 text-[13px] text-ink">
          Copy this key now. For security, it won’t be shown again.
        </div>
        <div className="flex items-center gap-2 rounded-md bg-ink py-2 pr-2 pl-3 text-paper">
          <code className="min-w-0 flex-1 font-mono text-xs break-all">{state.key}</code>
          <CopyButton value={state.key} label="Copy SDK key" />
        </div>
        <SheetActions>
          <Button onClick={onDone}>Done</Button>
        </SheetActions>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-1 flex-col gap-4">
      <Field label="Name" hint="Where the key is used, so you know what breaks if you revoke it.">
        <Input name="name" placeholder="e.g. Checkout service" required autoFocus />
      </Field>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SheetActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create key'}
        </Button>
      </SheetActions>
    </form>
  );
}

function EnvironmentKeys({
  projectKey,
  environment,
  keys,
}: {
  projectKey: string;
  environment: Environment;
  keys: SdkKey[];
}) {
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-rule-strong pb-2">
        <span className="text-xs font-medium flex items-center gap-2">
          <EnvironmentDot environmentKey={environment.key} />
          {environment.name}
        </span>
        <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
          <PlusIcon className="size-3.5" />
          New key
        </Button>
      </div>
      {keys.length > 0 ? (
        <ul>
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex flex-wrap items-center gap-3 border-b border-rule py-2.5"
            >
              <KeyIcon className="size-4 text-muted" />
              <span className="font-medium">{key.name}</span>
              <code className="font-mono text-xs text-muted">{key.keyPrefix}…</code>
              <Badge>{key.kind}</Badge>
              <span className="ml-auto text-xs text-muted">
                Created {new Date(key.createdAt).toLocaleDateString()}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Revoke “${key.name}”?`,
                    description: `Apps using this key are disconnected immediately and stop receiving flag updates for ${environment.name}.`,
                    confirmLabel: 'Revoke key',
                    tone: 'danger',
                  });
                  if (!ok) return;
                  startTransition(async () => {
                    await revokeSdkKey(projectKey, environment.key, key.id);
                    toast.success(`Revoked “${key.name}”`);
                  });
                }}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-[13px] text-muted">No keys yet.</p>
      )}
      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title={`New SDK key for ${environment.name}`}
        description="Server-side apps use it to read this environment’s flags."
      >
        <CreateKeyForm
          projectKey={projectKey}
          environment={environment}
          onDone={() => setCreating(false)}
        />
      </Sheet>
    </div>
  );
}

export function SdkKeys({
  projectKey,
  environments,
  keys,
}: {
  projectKey: string;
  environments: Environment[];
  keys: SdkKey[][];
}) {
  return (
    <div className="flex flex-col gap-3">
      {environments.map((env, i) => (
        <EnvironmentKeys key={env.id} projectKey={projectKey} environment={env} keys={keys[i]!} />
      ))}
    </div>
  );
}
