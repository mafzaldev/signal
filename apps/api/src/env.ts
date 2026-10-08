import { existsSync } from 'node:fs';
import { z } from 'zod';

if (existsSync('.env')) process.loadEnvFile('.env');

const envSchema = z.object({
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  /** Comma-separated origins allowed to call the API with cookies, e.g. the dashboard. */
  TRUSTED_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').filter(Boolean)),
  /**
   * Where to send email, e.g. `smtp://user:pass@smtp-relay.brevo.com:587`. Without it no
   * email is sent, and invitations are shared by copying their link.
   */
  SMTP_URL: z.url().optional(),
  EMAIL_FROM: z.string().default('Signal <signal@localhost>'),
  /** The dashboard's public URL, for links in emails. Defaults to the first trusted origin. */
  DASHBOARD_URL: z.url().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
}

export const env = {
  ...parsed.data,
  DASHBOARD_URL:
    parsed.data.DASHBOARD_URL ?? parsed.data.TRUSTED_ORIGINS[0] ?? 'http://localhost:3000',
};
