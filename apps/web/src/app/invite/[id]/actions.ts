'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { type ActionResult, api, toActionResult } from '@/lib/api';

/** Accepting also makes the organization active, so the dashboard opens straight into it. */
export async function acceptInvitation(invitationId: string): Promise<ActionResult> {
  const result = await toActionResult(() =>
    api('/api/auth/organization/accept-invitation', {
      method: 'POST',
      body: JSON.stringify({ invitationId }),
    }),
  );
  if (result?.error) return result;
  revalidatePath('/', 'layout');
  redirect('/projects');
}

export async function declineInvitation(invitationId: string): Promise<ActionResult> {
  const result = await toActionResult(() =>
    api('/api/auth/organization/reject-invitation', {
      method: 'POST',
      body: JSON.stringify({ invitationId }),
    }),
  );
  if (result?.error) return result;
  redirect('/projects');
}
