'use client';

import { useActionState, useState } from 'react';
import { Sheet, SheetActions } from '@/components/sheet';
import { PlusIcon } from '@/components/icons';
import { Button, type ButtonVariant, ErrorMessage, Field, Input } from '@/components/ui';
import { toKey } from '@/lib/keys';
import { createProject } from './projects/actions';

function CreateProjectForm({ onCancel }: { onCancel: () => void }) {
  const [state, action, pending] = useActionState(createProject, undefined);
  const [name, setName] = useState('');
  const [key, setKey] = useState<string>();
  const [editingKey, setEditingKey] = useState(false);
  const projectKey = key ?? toKey(name);

  return (
    <form action={action} className="flex flex-1 flex-col gap-4">
      <Field
        label="Name"
        hint={
          !editingKey &&
          projectKey && (
            <>
              URL: <span className="font-mono">/projects/{projectKey}</span> ·{' '}
              <button
                type="button"
                onClick={() => setEditingKey(true)}
                className="font-medium text-ink-2 hover:text-ink"
              >
                Change
              </button>
            </>
          )
        }
      >
        <Input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Web app"
          required
          autoFocus
        />
      </Field>
      {editingKey ? (
        <Field label="Key" hint="Lowercase letters, numbers and dashes.">
          <Input
            name="key"
            value={projectKey}
            onChange={(e) => setKey(e.target.value)}
            className="font-mono"
            required
          />
        </Field>
      ) : (
        <input type="hidden" name="key" value={projectKey} />
      )}
      <ErrorMessage>{state?.error}</ErrorMessage>
      <SheetActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create project'}
        </Button>
      </SheetActions>
    </form>
  );
}

export function CreateProjectButton({ variant = 'primary' }: { variant?: ButtonVariant }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <PlusIcon />
        New project
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="New project"
        description="Projects hold flags and their environments. New projects start with Development, Staging and Production."
      >
        {/* Mounted only while open, so the form starts empty each time. */}
        <CreateProjectForm onCancel={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
