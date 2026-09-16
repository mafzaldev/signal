'use client';

import { useActionState, useState, useTransition } from 'react';
import { Button, ErrorMessage, Field, Input } from '@/components/ui';
import { toKey } from '@/lib/keys';
import type { Environment } from '@/lib/types';
import { createEnvironment, deleteEnvironment, deleteProject, renameProject } from '../../actions';

export function RenameProjectForm({ projectKey, name }: { projectKey: string; name: string }) {
  const [state, action, pending] = useActionState(renameProject.bind(null, projectKey), undefined);
  return (
    <form action={action} className="flex items-end gap-3">
      <div className="w-72">
        <Field label="Name">
          <Input name="name" defaultValue={name} required />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        Save
      </Button>
      <ErrorMessage>{state?.error}</ErrorMessage>
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
  const [pending, startTransition] = useTransition();
  return (
    <ul className="mb-4 divide-y divide-zinc-100 rounded-md border border-zinc-200">
      {environments.map((env) => (
        <li key={env.id} className="flex items-center justify-between px-3 py-2 text-sm">
          <span>
            {env.name} <span className="font-mono text-xs text-zinc-500">{env.key}</span>
          </span>
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete ${env.name}? Its flag settings are deleted too.`)) return;
              startTransition(() => deleteEnvironment(projectKey, env.key));
            }}
          >
            Delete
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function CreateEnvironmentForm({ projectKey }: { projectKey: string }) {
  const [state, action, pending] = useActionState(
    createEnvironment.bind(null, projectKey),
    undefined,
  );
  const [name, setName] = useState('');
  const [key, setKey] = useState<string>();
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="w-48">
        <Field label="Name">
          <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
      </div>
      <div className="w-48">
        <Field label="Key">
          <Input
            name="key"
            value={key ?? toKey(name)}
            onChange={(e) => setKey(e.target.value)}
            required
          />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending}>
        Add environment
      </Button>
      <div className="basis-full">
        <ErrorMessage>{state?.error}</ErrorMessage>
      </div>
    </form>
  );
}

export function DeleteProjectButton({ projectKey, name }: { projectKey: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (
          window.prompt(`Type "${projectKey}" to delete ${name} and all its flags.`) !== projectKey
        ) {
          return;
        }
        startTransition(() => deleteProject(projectKey));
      }}
    >
      Delete project
    </Button>
  );
}
