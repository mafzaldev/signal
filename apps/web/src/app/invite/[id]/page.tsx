import Link from 'next/link';
import { AuthCard } from '@/components/auth-card';
import { buttonClass } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { roleLabel } from '@/lib/roles';
import type { InvitationDetail, SessionData } from '@/lib/types';
import { InviteActions, SwitchAccountButton } from './invite-actions';

export default async function InvitePage({ params }: PageProps<'/invite/[id]'>) {
  const { id } = await params;
  const here = `/invite/${id}`;
  const session = await api<SessionData | null>('/api/auth/get-session');

  if (!session) {
    const next = `?next=${encodeURIComponent(here)}`;
    return (
      <AuthCard
        title="You’ve been invited"
        description="Sign in, or create an account, with the email address the invitation was sent to."
      >
        <div className="flex flex-col gap-2">
          <Link href={`/sign-up${next}`} className={buttonClass('primary', 'md', 'w-full')}>
            Create an account
          </Link>
          <Link href={`/sign-in${next}`} className={buttonClass('secondary', 'md', 'w-full')}>
            Sign in
          </Link>
        </div>
      </AuthCard>
    );
  }

  const signedInAs = (
    <>
      Signed in as <span className="font-mono text-ink-2">{session.user.email}</span>.{' '}
      <SwitchAccountButton next={here} />
    </>
  );

  let invitation: InvitationDetail;
  try {
    invitation = await api<InvitationDetail>(
      `/api/auth/organization/get-invitation?id=${encodeURIComponent(id)}`,
    );
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <AuthCard
        title="This invitation can’t be used"
        description={
          error.status === 403
            ? 'It was sent to a different email address. Sign in with that address to accept it.'
            : 'It may have expired, been cancelled or already been used. Ask for a new one.'
        }
        footer={signedInAs}
      >
        <Link href="/projects" className={buttonClass('secondary', 'md', 'w-full')}>
          Go to the dashboard
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={`Join ${invitation.organizationName}`}
      description={
        <>
          <span className="font-mono">{invitation.inviterEmail}</span> invited you as{' '}
          {roleLabel(invitation.role).toLowerCase()}.
        </>
      }
      footer={signedInAs}
    >
      <InviteActions invitationId={invitation.id} />
    </AuthCard>
  );
}
