'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, ErrorMessage, Field, Input } from '@/components/ui';
import { authRequest } from '@/lib/auth-client';
import { toKey } from '@/lib/keys';

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    // Creating an organization also makes it the active one.
    const result = await authRequest('/organization/create', { name, slug: toKey(name) });
    setPending(false);
    if (result.error) return setError(result.error);
    router.push('/projects');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Organization name">
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
      </Field>
      <ErrorMessage>{error}</ErrorMessage>
      <Button type="submit" disabled={pending || !toKey(name)}>
        Create organization
      </Button>
    </form>
  );
}
