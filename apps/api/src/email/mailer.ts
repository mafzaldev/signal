import { createTransport } from 'nodemailer';
import { env } from '../env.js';

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// Created once from SMTP_URL and reused for every email.
const transport = env.SMTP_URL ? createTransport(env.SMTP_URL) : undefined;

/** Whether email is configured. Without `SMTP_URL`, `sendEmail` does nothing. */
export const emailEnabled = Boolean(transport);

/**
 * Sends an email if SMTP is configured. Never throws: a failed email is logged, so the
 * action that triggered it (like creating an invitation) still succeeds.
 */
export async function sendEmail(email: Email): Promise<void> {
  if (!transport) return;
  try {
    await transport.sendMail({ from: env.EMAIL_FROM, ...email });
  } catch (error) {
    console.error(`[email] could not send "${email.subject}" to ${email.to}:`, error);
  }
}
