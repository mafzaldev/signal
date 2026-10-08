import { escapeHtml, layout } from './layout.js';
import type { Email } from './mailer.js';

/** "Verify your email for Signal", with a button that verifies and signs the user in. */
export function verificationEmail({
  to,
  name,
  link,
}: {
  to: string;
  name: string;
  link: string;
}): Email {
  const subject = 'Verify your email for Signal';
  const text = `Hi ${name},

Open this link to verify your email and finish creating your Signal account:
${link}

The link expires in an hour. If you didn't sign up for Signal, you can ignore this email.`;

  const html = layout({
    heading: subject,
    body: `Hi ${escapeHtml(name)}, confirm this is your email address to finish creating your Signal account.`,
    button: { label: 'Verify email', href: link },
    footer: `The link expires in an hour. If you didn't sign up for Signal, you can ignore this email.`,
  });

  return { to, subject, text, html };
}
