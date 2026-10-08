import { escapeHtml, layout } from './layout.js';
import type { Email } from './mailer.js';

/** "Ali Khan invited you to join Acme Inc on Signal", with a button to accept. */
export function invitationEmail({
  to,
  inviterName,
  organizationName,
  role,
  link,
}: {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  link: string;
}): Email {
  const subject = `${inviterName} invited you to join ${organizationName} on Signal`;
  const article = role === 'admin' ? 'an' : 'a';
  const text = `${subject}.

You've been invited as ${article} ${role}. Open this link to accept:
${link}

The invitation expires in 48 hours. If you weren't expecting it, you can ignore this email.`;

  const html = layout({
    heading: subject,
    body: `You've been invited as ${article} <strong style="color:#ededea">${escapeHtml(role)}</strong>. Accept to start working on ${escapeHtml(organizationName)}'s feature flags.`,
    button: { label: 'Accept invitation', href: link },
    footer:
      "The invitation expires in 48 hours. If you weren't expecting it, you can ignore this email.",
  });

  return { to, subject, text, html };
}
