import { PageHeader, SettingsSection } from '@/components/ui';
import { api } from '@/lib/api';
import { inviteLink } from '@/lib/invite-link';
import { canManageMembers, ROLES } from '@/lib/roles';
import { listOrganizations, requireOrgSession } from '@/lib/session';
import type { Invitation, Member } from '@/lib/types';
import { InvitationList, InviteButton, MemberList } from './members';

/** The API keeps accepted, cancelled and expired invitations too; only open ones matter here. */
function isOpen(invitation: Invitation) {
  return invitation.status === 'pending' && new Date(invitation.expiresAt).getTime() > Date.now();
}

export default async function OrganizationPage() {
  const [{ organizationId }, organizations, me, { members }] = await Promise.all([
    requireOrgSession(),
    listOrganizations(),
    api<Member>('/api/auth/organization/get-active-member'),
    api<{ members: Member[] }>('/api/auth/organization/list-members'),
  ]);
  const organizationName = organizations.find((o) => o.id === organizationId)?.name ?? '';
  const canManage = canManageMembers(me.role);

  const invitations = canManage
    ? (await api<Invitation[]>('/api/auth/organization/list-invitations')).filter(isOpen)
    : [];
  const links = Object.fromEntries(
    await Promise.all(invitations.map(async (i) => [i.id, await inviteLink(i.id)] as const)),
  );

  return (
    <>
      <PageHeader
        title="Members"
        description={`Who can sign in to ${organizationName}, and what they can do.`}
        actions={canManage && <InviteButton myRole={me.role} />}
      />
      <div>
        <SettingsSection
          title="Members"
          description={
            canManage
              ? 'Change someone’s role or remove them. You can’t change your own role.'
              : 'Only owners and admins can invite people or change roles.'
          }
        >
          <MemberList
            members={members}
            myMemberId={me.id}
            myRole={me.role}
            canManage={canManage}
            organizationName={organizationName}
          />
        </SettingsSection>
        {canManage && (
          <SettingsSection
            title="Pending invitations"
            description="Invitations last 48 hours. Copy a link to send it again."
          >
            <InvitationList invitations={invitations} links={links} />
          </SettingsSection>
        )}
        <SettingsSection title="Roles" description="What each role allows.">
          <dl className="divide-y divide-rule">
            {ROLES.map((r) => (
              <div key={r.role} className="flex gap-4 py-2.5 text-[13px]">
                <dt className="w-24 shrink-0 font-medium">{r.label}</dt>
                <dd className="text-muted">{r.description}</dd>
              </div>
            ))}
          </dl>
        </SettingsSection>
      </div>
    </>
  );
}
