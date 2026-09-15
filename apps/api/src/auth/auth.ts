import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { db } from '../db/client.js';
import * as schema from '../db/schema/index.js';
import { env } from '../env.js';
import { ac, roles } from './permissions.js';

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.TRUSTED_ORIGINS,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true },
  plugins: [organization({ ac, roles })],
});

export type Auth = typeof auth;
