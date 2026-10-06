'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button, ErrorMessage } from '@/components/ui';
import { authRequest } from '@/lib/auth-client';
import { acceptInvitation, declineInvitation } from './actions';

export function InviteActions({ invitationId }: { invitationId: string }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = (action: typeof acceptInvitation) =>
    startTransition(async () => {
      setError(undefined);
      const result = await action(invitationId);
      if (result?.error) setError(result.error);
    });

  return (
    <div className="flex flex-col gap-3">
      <ErrorMessage>{error}</ErrorMessage>
      <Button className="w-full" disabled={pending} onClick={() => run(acceptInvitation)}>
        {pending ? 'Joining…' : 'Accept invitation'}
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        disabled={pending}
        onClick={() => run(declineInvitation)}
      >
        Decline
      </Button>
    </div>
  );
}

/** Signs out and comes back to the invitation, to accept it with a different account. */
export function SwitchAccountButton({ next }: { next: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="font-medium text-ink hover:underline"
      onClick={async () => {
        await authRequest('/sign-out');
        router.push(`/sign-in?next=${encodeURIComponent(next)}`);
        router.refresh();
      }}
    >
      Use another account
    </button>
  );
}
