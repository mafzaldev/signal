'use client';

import type { FlagKind } from '@signal/core/schemas';
import { useActionState, useState } from 'react';
import { Button, ErrorMessage, Field, Input, Select, Textarea } from '@/components/ui';
import { toKey } from '@/lib/keys';
import { createFlag } from '../actions';

const VARIATION_HINTS: Record<Exclude<FlagKind, 'boolean'>, string> = {
  string: 'One value per line',
  number: 'One number per line',
  json: 'One JSON value per line, e.g. {"theme":"dark"}',
};

export function CreateFlagForm({ projectKey }: { projectKey: string }) {
  const [state, action, pending] = useActionState(createFlag.bind(null, projectKey), undefined);
  const [name, setName] = useState('');
  const [key, setKey] = useState<string>();
  const [kind, setKind] = useState<FlagKind>('boolean');

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Name">
        <Input name="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Key" hint="Used in code. Can't be changed later.">
        <Input
          name="key"
          value={key ?? toKey(name)}
          onChange={(e) => setKey(e.target.value)}
          required
        />
      </Field>
      <Field label="Description">
        <Input name="description" />
      </Field>
      <Field label="Type">
        <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value as FlagKind)}>
          <option value="boolean">Boolean (on / off)</option>
          <option value="string">String</option>
          <option value="number">Number</option>
          <option value="json">JSON</option>
        </Select>
      </Field>
      {kind !== 'boolean' && (
        <div className="sm:col-span-2">
          <Field label="Variations" hint={VARIATION_HINTS[kind]}>
            <Textarea name="variations" rows={3} required />
          </Field>
        </div>
      )}
      <div className="space-y-2 sm:col-span-2">
        <ErrorMessage>{state?.error}</ErrorMessage>
        <Button type="submit" disabled={pending}>
          Create flag
        </Button>
      </div>
    </form>
  );
}
