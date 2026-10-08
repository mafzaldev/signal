import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as schema from '../db/schema/index.js';
import { invitationEmail } from '../email/invitation-email.js';
import { sendEmail } from '../email/mailer.js';
import { env } from '../env.js';
import { ac, roles } from './permissions.js';

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.TRUSTED_ORIGINS,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
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
