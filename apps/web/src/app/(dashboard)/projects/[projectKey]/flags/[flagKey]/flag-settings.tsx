'use client';

import { useActionState, useEffect, useTransition } from 'react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/dialog';
import { Button, ErrorMessage, Field, Input, SettingsSection } from '@/components/ui';
import type { FlagDetail } from '@/lib/types';
import { deleteFlag, updateFlag } from '../../../actions';
import { VariationsInput } from '../../variations-input';

export function FlagSettings({ projectKey, flag }: { projectKey: string; flag: FlagDetail }) {
  const [state, action, pending] = useActionState(
    updateFlag.bind(null, projectKey, flag.key, flag.kind),
    undefined,
  );
  const [deleting, startDeleting] = useTransition();
  const confirm = useConfirm();

  useEffect(() => {
    if (state?.ok) toast.success('Flag details saved');
  }, [state]);

  return (
    <div>
      <SettingsSection title="Details" description="How the flag appears in the dashboard.">
        <form action={action} className="flex max-w-xl flex-col gap-4">
          <Field label="Name">
            <Input name="name" defaultValue={flag.name} required />
          </Field>
          <Field label="Description">
            <Input
              name="description"
              defaultValue={flag.description}
              placeholder="What does this flag control?"
            />
          </Field>
          {flag.kind !== 'boolean' && (
            <Field
              label="Variations"
              hint="Removing a variation that an environment still serves is blocked; change that environment first."
            >
              <VariationsInput
                kind={flag.kind}
                name="variations"
                initial={flag.variations.map((v) =>
                  typeof v.value === 'string' ? v.value : JSON.stringify(v.value),
                )}
              />
            </Field>
          )}
          <ErrorMessage>{state?.error}</ErrorMessage>
          <div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save details'}
            </Button>
          </div>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Delete flag"
        description="Removes it from every environment. Apps fall back to the default value in their code."
      >
        <Button
          variant="danger"
          disabled={deleting}
          onClick={async () => {
            const ok = await confirm({
              title: `Delete ${flag.name}?`,
              description: 'This removes the flag from every environment and can’t be undone.',
              confirmLabel: 'Delete flag',
              tone: 'danger',
              typeToConfirm: flag.key,
            });
            if (ok) startDeleting(() => deleteFlag(projectKey, flag.key));
          }}
        >
          Delete flag
        </Button>
      </SettingsSection>
    </div>
  );
}
