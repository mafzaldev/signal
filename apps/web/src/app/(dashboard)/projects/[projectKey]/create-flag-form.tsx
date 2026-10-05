'use client';

import type { FlagKind } from '@signal/core/schemas';
import { useActionState, useState } from 'react';
import { Sheet, SheetActions } from '@/components/sheet';
import { PlusIcon } from '@/components/icons';
import { Button, cx, ErrorMessage, Field, Input } from '@/components/ui';
import { toKey } from '@/lib/keys';
import { createFlag } from '../actions';
import { VariationsInput } from './variations-input';

const KINDS: { kind: FlagKind; label: string; description: string }[] = [
  { kind: 'boolean', label: 'Boolean', description: 'On or off: true / false' },
  { kind: 'string', label: 'String', description: 'Text, e.g. a color or plan name' },
  { kind: 'number', label: 'Number', description: 'e.g. a limit or timeout' },
  { kind: 'json', label: 'JSON', description: 'Any structured config' },
];

function CreateFlagForm({ projectKey, onCancel }: { projectKey: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState(createFlag.bind(null, projectKey), undefined);
  const [name, setName] = useState('');
  const [key, setKey] = useState<string>();
  const [kind, setKind] = useState<FlagKind>('boolean');

  return (
    <form action={action} className="flex flex-1 flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <Input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. New checkout"
            required
            autoFocus
          />
        </Field>
        <Field label="Key" hint="Used in your code. Can’t be changed later.">
          <Input
            name="key"
            value={key ?? toKey(name)}
            onChange={(e) => setKey(e.target.value)}
            className="font-mono"
            required
          />
        </Field>
      </div>
      <Field label="Description (optional)">
        <Input name="description" placeholder="What does this flag control?" />
      </Field>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs font-medium mb-1.5 text-muted">Type</legend>
        <input type="hidden" name="kind" value={kind} />
        <div className="grid grid-cols-2 gap-2">
          {KINDS.map((option) => (
            <button
              key={option.kind}
              type="button"
              onClick={() => setKind(option.kind)}
              aria-pressed={kind === option.kind}
              className={cx(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                kind === option.kind
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule bg-surface hover:border-rule-strong',
              )}
            >
              <span className="block text-[13px] font-semibold">{option.label}</span>
              <span
                className={cx('block text-xs', kind === option.kind ? 'text-faint' : 'text-muted')}
              >
                {option.description}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {kind !== 'boolean' && (
        <Field label="Variations" hint="The values this flag can serve. You need at least two.">
          <VariationsInput key={kind} kind={kind} name="variations" />
        </Field>
      )}

      <ErrorMessage>{state?.error}</ErrorMessage>
      <SheetActions>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Create flag'}
        </Button>
      </SheetActions>
    </form>
  );
}

export function CreateFlagButton({ projectKey }: { projectKey: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        New flag
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="New flag"
        description="It starts switched off in every environment."
      >
        <CreateFlagForm projectKey={projectKey} onCancel={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
