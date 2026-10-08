import { escapeHtml, layout } from './layout.js';
import type { Email } from './mailer.js';

/** What each role lets the invitee do, finishing "you'll be able to …". */
const CAN_DO: Record<string, (organization: string) => string> = {
  owner: (org) => `manage everything in ${org}, including its members, projects and settings`,
  admin: (org) => `manage ${org}'s projects, environments, SDK keys and members`,
  member: () => 'create, change and roll out feature flags across its projects',
  viewer: (org) => `see ${org}'s projects, flags and the history of every change`,
};

/**
 * "Ali Khan invited you to join Acme Inc on Signal", saying what the role allows and who
 * sent it, with a button to accept.
 */
export function invitationEmail({
  to,
  inviterName,
  inviterEmail,
  organizationName,
  role,
  link,
}: {
  to: string;
  inviterName: string;
  inviterEmail: string;
  organizationName: string;
  role: string;
  link: string;
}): Email {
  const subject = `${inviterName} invited you to join ${organizationName} on Signal`;
  const article = role === 'admin' || role === 'owner' ? 'an' : 'a';
  const canDo = (CAN_DO[role] ?? CAN_DO.member!)(organizationName);
  const footer =
    "The invitation expires in 48 hours. If you weren't expecting it, you can ignore this email.";

  const text = `${subject}.

As ${article} ${role} of ${organizationName}, you'll be able to ${canDo}.
Sent by ${inviterName} (${inviterEmail}).

Open this link to accept:
${link}

${footer}`;

  const html = layout({
    heading: subject,
    body: `As ${article} <strong style="color:#ededea">${escapeHtml(role)}</strong> of ${escapeHtml(organizationName)}, you'll be able to ${escapeHtml(canDo)}.<br><span style="font-size:13px;color:#8d8d86">Sent by ${escapeHtml(inviterName)} (${escapeHtml(inviterEmail)}).</span>`,
    button: { label: 'Accept invitation', href: link },
    footer,
  });

  return { to, subject, text, html };
}
