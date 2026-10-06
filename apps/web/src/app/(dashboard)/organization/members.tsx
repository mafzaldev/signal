'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CopyButton } from '@/components/copy-button';
import { useConfirm } from '@/components/dialog';
import { PlusIcon, TrashIcon } from '@/components/icons';
import { Select } from '@/components/select';
import { Sheet, SheetActions } from '@/components/sheet';
import { Badge, Button, cx, ErrorMessage, Field, Input } from '@/components/ui';
import { ROLES, roleLabel } from '@/lib/roles';
import type { Invitation, Member, Role } from '@/lib/types';
import { cancelInvitation, inviteMember, removeMember, updateMemberRole } from './actions';

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join('') || '?'
  );
}

/** Roles someone can hand out: admins can't make owners. */
const assignableRoles = (myRole: Role) =>
  ROLES.filter((r) => myRole === 'owner' || r.role !== 'owner');

function MemberRow({
  member,
  isMe,
  myRole,
  canManage,
  organizationName,
}: {
  member: Member;
  isMe: boolean;
  myRole: Role;
  canManage: boolean;
  organizationName: string;
}) {
  const [role, setRole] = useOptimistic(member.role);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  // Admins can't change or remove owners; the API refuses, so don't offer it.
  const editable = canManage && !isMe && (myRole === 'owner' || member.role !== 'owner');

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-wash font-mono text-[11px] font-semibold text-ink-2">
        {initials(member.user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-medium">
          <span className="truncate">{member.user.name}</span>
          {isMe && <Badge>You</Badge>}
        </div>
        <div className="truncate font-mono text-xs text-muted">{member.user.email}</div>
      </div>
      {editable ? (
        <Select
          label={`Role of ${member.user.name}`}
          className="w-32"
          value={role}
          options={assignableRoles(myRole).map((r) => ({ value: r.role, label: r.label }))}
          onChange={(next) =>
            startTransition(async () => {
              setRole(next as Role);
              const result = await updateMemberRole(member.id, next as Role);
              if (result?.error) toast.error(result.error);
              else toast.success(`${member.user.name} is now ${roleLabel(next as Role)}`);
            })
          }
        />
      ) : (
        <span className="w-32 text-[13px] text-ink-2">{roleLabel(role)}</span>
      )}
      <span className="hidden w-28 text-xs text-muted sm:block">
        Joined {new Date(member.createdAt).toLocaleDateString()}
      </span>
      <div className="w-8">
        {editable && (
          <Button
            variant="ghost"
            size="icon"
            disabled={pending}
            aria-label={`Remove ${member.user.name}`}
            onClick={async () => {
              const ok = await confirm({
                title: `Remove ${member.user.name}?`,
                description: `They lose access to ${organizationName} right away. Their past changes stay in the audit log.`,
                confirmLabel: 'Remove',
                tone: 'danger',
              });
              if (!ok) return;
              startTransition(async () => {
                const result = await removeMember(member.id);
                if (result?.error) toast.error(result.error);
                else toast.success(`Removed ${member.user.name}`);
              });
            }}
          >
            <TrashIcon />
          </Button>
        )}
      </div>
    </li>
  );
}

export function MemberList({
  members,
  myMemberId,
  myRole,
  canManage,
  organizationName,
}: {
  members: Member[];
  myMemberId: string;
  myRole: Role;
  canManage: boolean;
  organizationName: string;
}) {
  return (
    <ul className="divide-y divide-rule">
      {members.map((member) => (
        <MemberRow
          key={member.id}
          member={member}
          isMe={member.id === myMemberId}
          myRole={myRole}
          canManage={canManage}
          organizationName={organizationName}
        />
      ))}
    </ul>
  );
}

function expiresIn(expiresAt: string) {
  const hours = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 3_600_000));
  if (hours < 1) return 'Expires within the hour';
  if (hours < 24) return `Expires in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(hours / 24);
  return `Expires in ${days} ${days === 1 ? 'day' : 'days'}`;
}

export function InvitationList({
  invitations,
  links,
}: {
  invitations: Invitation[];
  links: Record<string, string>;
}) {
  const [pending, startTransition] = useTransition();

  if (invitations.length === 0) {
    return <p className="text-[13px] text-muted">No pending invitations.</p>;
  }
  return (
    <ul className="divide-y divide-rule">
      {invitations.map((invitation) => (
        <li key={invitation.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[13px]">{invitation.email}</div>
            <div className="text-xs text-muted">
              {roleLabel(invitation.role)} · {expiresIn(invitation.expiresAt)}
            </div>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted">
            Copy link
            <CopyButton value={links[invitation.id] ?? ''} label="Copy invitation link" />
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await cancelInvitation(invitation.id);
                if (result?.error) toast.error(result.error);
                else toast.success(`Cancelled the invitation for ${invitation.email}`);
              })
            }
          >
            Cancel
          </Button>
        </li>
      ))}
    </ul>
  );
}

function InviteForm({ myRole, onDone }: { myRole: Role; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [result, setResult] = useState<Awaited<ReturnType<typeof inviteMember>>>();
  const [pending, startTransition] = useTransition();

  if (result?.link) {
    return (
      <div className="flex flex-1 flex-col gap-4">
        <p className="text-[13px] text-ink-2">
          Send this link to <span className="font-mono">{result.email}</span>. They sign in or
          create an account with that email, then accept. It expires in 48 hours.
        </p>
        <div className="flex items-center gap-2 rounded-md border border-rule-strong bg-paper py-2 pr-2 pl-3">
          <code className="min-w-0 flex-1 font-mono text-xs break-all">{result.link}</code>
          <CopyButton value={result.link} label="Copy invitation link" />
        </div>
        <SheetActions>
          <Button
            variant="secondary"
            onClick={() => {
              setEmail('');
              setResult(undefined);
            }}
          >
            Invite another
          </Button>
          <Button onClick={onDone}>Done</Button>
        </SheetActions>
      </div>
    );
  }

  return (
    <form
      className="flex flex-1 flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setResult(await inviteMember(email, role)));
      }}
    >
      <Field label="Email">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@company.com"
          required
          autoFocus
        />
      </Field>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-xs font-medium text-muted">Role</legend>
        <div className="flex flex-col gap-2">
          {assignableRoles(myRole).map((option) => (
            <button
              key={option.role}
              type="button"
              aria-pressed={role === option.role}
              onClick={() => setRole(option.role)}
              className={cx(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                role === option.role
                  ? 'border-ink bg-ink text-paper'
                  : 'border-rule bg-surface hover:border-rule-strong',
              )}
            >
              <span className="block text-[13px] font-semibold">{option.label}</span>
              <span
                className={cx('block text-xs', role === option.role ? 'text-faint' : 'text-muted')}
              >
                {option.description}
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <ErrorMessage>{result?.error}</ErrorMessage>
      <SheetActions>
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Inviting…' : 'Create invitation'}
        </Button>
      </SheetActions>
    </form>
  );
}

export function InviteButton({ myRole }: { myRole: Role }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon />
        Invite people
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Invite to the organization"
        description="You’ll get a link to send them. Emails aren’t sent yet."
      >
        <InviteForm myRole={myRole} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
