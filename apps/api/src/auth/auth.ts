import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as schema from '../db/schema/index.js';
import { invitationEmail } from '../email/invitation-email.js';
import { emailEnabled, sendEmail } from '../email/mailer.js';
import { verificationEmail } from '../email/verification-email.js';
import { env } from '../env.js';
import { ac, roles } from './permissions.js';

/**
 * Better Auth builds verification links on the API's URL. Opening them on the dashboard
 * instead (which forwards `/api/auth` to the API) puts the sign-in cookie on the dashboard,
 * and they land on its confirmation page.
 */
function dashboardLink(apiLink: string) {
  const url = new URL(apiLink);
  // Better Auth falls back to `/` when the request named no destination. Only a path on the
  // dashboard is kept, so an emailed link can never send someone to another site, even if
  // Better Auth's own check of the destination were turned off.
  const callback = url.searchParams.get('callbackURL') ?? '';
  const isDashboardPath = callback.startsWith('/') && !callback.startsWith('//');
  if (!isDashboardPath || callback === '/') url.searchParams.set('callbackURL', '/email-verified');
  return `${env.DASHBOARD_URL}${url.pathname}${url.search}`;
}

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.TRUSTED_ORIGINS,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  // Better Auth skips its origin and redirect checks when NODE_ENV is `test`. Keeping them on
  // everywhere makes the e2e tests exercise the same protection production has.
  advanced: { disableOriginCheck: false },
  // With email set up, new accounts must verify their address before they can sign in.
  // Without it there's no way to deliver the link, so verification is skipped.
  emailAndPassword: { enabled: true, requireEmailVerification: emailEnabled },
  emailVerification: {
    sendOnSignUp: emailEnabled,
    // Signing in unverified sends a fresh link, e.g. for accounts made before verification.
    sendOnSignIn: emailEnabled,
    autoSignInAfterVerification: true,
    sendVerificationEmail: ({ user, url }) =>
      sendEmail(verificationEmail({ to: user.email, name: user.name, link: dashboardLink(url) })),
  },
  plugins: [
    organization({
      ac,
      roles,
      // Emails the invitee a link to /invite/<id>; the dashboard also shows it to copy.
      sendInvitationEmail: ({ id, email, role, organization, inviter }) =>
        sendEmail(
          invitationEmail({
            to: email,
            inviterName: inviter.user.name,
            inviterEmail: inviter.user.email,
            organizationName: organization.name,
            role,
            link: `${env.DASHBOARD_URL}/invite/${id}`,
          }),
        ),
    }),
  ],
  databaseHooks: {
    session: {
      create: {
        // New sessions start in the user's oldest organization instead of none,
        // so signing in lands on the dashboard rather than onboarding.
        before: async (session) => {
          const [membership] = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .orderBy(asc(schema.member.createdAt))
            .limit(1);
          return { data: { ...session, activeOrganizationId: membership?.organizationId ?? null } };
        },
      },
    },
  },
});

export type Auth = typeof auth;
