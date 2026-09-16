'use client';

import { useActionState, useState } from 'react';
import { Button, ErrorMessage, Field, Input } from '@/components/ui';
import { toKey } from '@/lib/keys';
import { createProject } from './actions';

export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProject, undefined);
  const [name, setName] = useState('');
  const [key, setKey] = useState<string>();

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="w-60">
        <Field label="Name">
          <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
      </div>
      <div className="w-60">
        <Field label="Key">
          <Input
            name="key"
            value={key ?? toKey(name)}
            onChange={(e) => setKey(e.target.value)}
            required
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        Create project
      </Button>
      <div className="basis-full">
        <ErrorMessage>{state?.error}</ErrorMessage>
      </div>
    </form>
  );
}
