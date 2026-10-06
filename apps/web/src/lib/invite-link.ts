import 'server-only';
import { headers } from 'next/headers';

/** The link an invitee opens to accept. No email is sent yet, so people share it by hand. */
export async function inviteLink(invitationId: string) {
  const incoming = await headers();
  const host = incoming.get('x-forwarded-host') ?? incoming.get('host');
  const protocol = incoming.get('x-forwarded-proto') ?? 'http';
  return `${protocol}://${host}/invite/${invitationId}`;
}
