'use client';

import { useActionState, useTransition } from 'react';
import { Button, ErrorMessage, Field, Input, Textarea } from '@/components/ui';
import { formatVariations } from '@/lib/targeting';
import type { FlagDetail } from '@/lib/types';
import { deleteFlag, updateFlag } from '../../../actions';

export function FlagDetailsForm({ projectKey, flag }: { projectKey: string; flag: FlagDetail }) {
  const [state, action, pending] = useActionState(
    updateFlag.bind(null, projectKey, flag.key, flag.kind),
    undefined,
  );
  const [deleting, startDeleting] = useTransition();

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input name="name" defaultValue={flag.name} required />
        </Field>
        <Field label="Description">
          <Input name="description" defaultValue={flag.description} />
        </Field>
      </div>
      {flag.kind !== 'boolean' && (
        <Field
          label="Variations"
          hint="One per line. Removing a variation that targeting still uses is blocked."
        >
          <Textarea name="variations" rows={4} defaultValue={formatVariations(flag.variations)} />
        </Field>
      )}
      <ErrorMessage>{state?.error}</ErrorMessage>
      <div className="flex justify-between">
        <Button type="submit" variant="secondary" disabled={pending}>
          Save details
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={deleting}
          onClick={() => {
            if (!window.confirm(`Delete "${flag.key}" in every environment?`)) return;
            startDeleting(() => deleteFlag(projectKey, flag.key));
          }}
        >
          Delete flag
        </Button>
      </div>
    </form>
  );
}
