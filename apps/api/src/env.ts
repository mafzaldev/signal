import { existsSync } from 'node:fs';
import { z } from 'zod';

if (existsSync('.env')) process.loadEnvFile('.env');

const envSchema = z.object({
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  /** Comma-separated origins allowed to call the API with cookies, e.g. the dashboard. */
  TRUSTED_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').filter(Boolean)),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${z.prettifyError(parsed.error)}`);
}

export const env = parsed.data;
