'use server';

import { refresh } from 'next/cache';
import { type ActionResult, api, ApiError, toActionResult } from '@/lib/api';
import { inviteLink } from '@/lib/invite-link';
import type { Invitation, Role } from '@/lib/types';

const json = (body: unknown) => JSON.stringify(body);

export type InviteResult = { error?: string; link?: string; email?: string } | undefined;

/** Creates an invitation and returns the link to share with the invitee. */
export async function inviteMember(email: string, role: Role): Promise<InviteResult> {
  try {
    const invitation = await api<Invitation>('/api/auth/organization/invite-member', {
      method: 'POST',
      body: json({ email: email.trim(), role }),
    });
    refresh();
    return { link: await inviteLink(invitation.id), email: invitation.email };
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
}

export async function cancelInvitation(invitationId: string): Promise<ActionResult> {
  const result = await toActionResult(() =>
    api('/api/auth/organization/cancel-invitation', {
      method: 'POST',
      body: json({ invitationId }),
    }),
  );
  refresh();
  return result;
}

export async function updateMemberRole(memberId: string, role: Role): Promise<ActionResult> {
  const result = await toActionResult(() =>
    api('/api/auth/organization/update-member-role', {
      method: 'POST',
      body: json({ memberId, role }),
    }),
  );
  refresh();
  return result;
}

export async function removeMember(memberId: string): Promise<ActionResult> {
  const result = await toActionResult(() =>
    api('/api/auth/organization/remove-member', {
      method: 'POST',
      body: json({ memberIdOrEmail: memberId }),
    }),
  );
  refresh();
  return result;
}
