'use client';

import { useActionState, useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/dialog';
import { Sheet, SheetActions } from '@/components/sheet';
import { EnvironmentDot } from '@/components/environment';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { Button, ErrorMessage, Field, Input } from '@/components/ui';
import { toKey } from '@/lib/keys';
import type { Environment } from '@/lib/types';
import { createEnvironment, deleteEnvironment, deleteProject, renameProject } from '../../actions';

export function RenameProjectForm({ projectKey, name }: { projectKey: string; name: string }) {
  const [state, action, pending] = useActionState(renameProject.bind(null, projectKey), undefined);
  useEffect(() => {
    if (state?.ok) toast.success('Project renamed');
  }, [state]);

  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      <Field label="Name">
        <Input name="name" defaultValue={name} required />
      </Field>
      <Field label="Key" hint="Used in URLs and the API. Can’t be changed.">
        <Input value={projectKey} disabled className="font-mono" />
      </Field>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}

function CreateEnvironmentForm({ projectKey, onDone }: { projectKey: string; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    createEnvironment.bind(null, projectKey),
    undefined,
  );
  const [name, setName] = useState('');
  const [key, setKey] = useState<string>();

  useEffect(() => {
    if (state?.ok) {
      toast.success('Environment added');
      onDone();
    }
  }, [state, onDone]);

  return (
    <form action={action} className="flex flex-1 flex-col gap-4">
      <Field label="Name">
        <Input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. QA"
          required
          autoFocus
        />
      </Field>
      <Field label="Key">
        <Input
          name="key"
          value={key ?? toKey(name)}
          onChange={(e) => setKey(e.target.value)}
          className="font-mono"
          required
        />
      </Field>
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SheetActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add environment'}
        </Button>
      </SheetActions>
    </form>
  );
}

export function EnvironmentList({
  projectKey,
  environments,
}: {
  projectKey: string;
  environments: Environment[];
}) {
  const [adding, setAdding] = useState(false);
  const closeAdding = useCallback(() => setAdding(false), []);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-rule">
        {environments.map((env) => (
          <li key={env.id} className="flex items-center gap-3 py-2">
            <EnvironmentDot environmentKey={env.key} />
            <span className="font-medium">{env.name}</span>
            <code className="font-mono text-xs text-muted">{env.key}</code>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto"
              disabled={pending}
              aria-label={`Delete ${env.name}`}
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete ${env.name}?`,
                  description: `Every flag’s settings in ${env.name} and its SDK keys are deleted. Apps using those keys are disconnected.`,
                  confirmLabel: 'Delete environment',
                  tone: 'danger',
                  typeToConfirm: env.key,
                });
                if (!ok) return;
                startTransition(async () => {
                  await deleteEnvironment(projectKey, env.key);
                  toast.success(`${env.name} deleted`);
                });
              }}
            >
              <TrashIcon />
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="secondary" onClick={() => setAdding(true)}>
          <PlusIcon />
          Add environment
        </Button>
      </div>
      <Sheet
        open={adding}
        onClose={closeAdding}
        title="Add environment"
        description="Every flag gets a switched-off config in the new environment."
      >
        <CreateEnvironmentForm projectKey={projectKey} onDone={closeAdding} />
      </Sheet>
    </div>
  );
}

export function DeleteProjectButton({ projectKey, name }: { projectKey: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={async () => {
        const ok = await confirm({
          title: `Delete ${name}?`,
          description:
            'Deletes every flag, environment and SDK key in this project. Apps using its keys are disconnected. The audit log keeps its history.',
          confirmLabel: 'Delete project',
          tone: 'danger',
          typeToConfirm: projectKey,
        });
        if (ok) startTransition(() => deleteProject(projectKey));
      }}
    >
      Delete project
    </Button>
  );
}
