'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button, Select } from '@/components/ui';
import { authRequest } from '@/lib/auth-client';
import type { Organization } from '@/lib/types';
import { setActiveOrganization } from './actions';

export function OrganizationSwitcher({
  organizations,
  activeId,
}: {
  organizations: Organization[];
  activeId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      aria-label="Organization"
      className="w-48"
      value={activeId}
      disabled={pending}
      onChange={(e) => {
        const value = e.target.value;
        if (value === 'new') return router.push('/onboarding');
        startTransition(() => setActiveOrganization(value));
      }}
    >
      {organizations.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
      <option value="new">+ New organization</option>
    </Select>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await authRequest('/sign-out');
        router.push('/sign-in');
        router.refresh();
      }}
    >
      Sign out
    </Button>
  );
}

export function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="rounded px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
    >
      {children}
    </Link>
  );
}
