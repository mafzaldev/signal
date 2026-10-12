import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { eq } from 'drizzle-orm';
import { AppModule } from '../src/app.module.js';
import { db } from '../src/db/client.js';
import { user } from '../src/db/schema/index.js';
import { setupApp } from '../src/setup.js';

export async function createApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ bodyParser: false });
  setupApp(app);
  await app.init();
  return app;
}

let counter = 0;

/** The `name=value` pairs of a response's cookies, ready for a `Cookie` header. */
export function cookieFrom(res: request.Response) {
  const setCookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

/**
 * Signs up a fresh user and returns their session cookie. Email is configured in these
 * tests, so accounts start unverified; this marks them verified directly, then signs in.
 * `verification.e2e-spec.ts` covers the real emailed-link flow.
 */
export async function signUp(app: INestApplication<App>, name = 'Test User') {
  const email = `user-${Date.now()}-${counter++}@example.com`;
  const password = 'password-123456';
  const res = await request(app.getHttpServer())
    .post('/api/auth/sign-up/email')
    .send({ name, email, password })
    .expect(200);
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));
  const signIn = await request(app.getHttpServer())
    .post('/api/auth/sign-in/email')
    .send({ email, password })
    .expect(200);
  return { cookie: cookieFrom(signIn), userId: res.body.user.id as string, email };
}

const MAILPIT = process.env.TEST_MAILPIT_URL ?? 'http://localhost:8025';

/** Waits for Mailpit to receive an email for `to`, then returns the newest one. */
export async function emailTo(to: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const message = await fetch(`${MAILPIT}/api/v1/message/${messages[0]!.ID}`);
      return (await message.json()) as { Subject: string; Text: string; HTML: string };
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No email arrived for ${to}`);
}

/** Creates an organization, which also makes it the user's active organization. */
export async function createOrganization(app: INestApplication<App>, cookie: string, slug: string) {
  const res = await request(app.getHttpServer())
    .post('/api/auth/organization/create')
    .set('Cookie', cookie)
    .send({ name: slug, slug })
    .expect(200);
  return res.body.id as string;
}

/** A signed-in user with an active organization. */
export async function signUpWithOrganization(app: INestApplication<App>, slug: string) {
  const user = await signUp(app);
  const organizationId = await createOrganization(app, user.cookie, slug);
  return { ...user, organizationId };
}

/** Adds a new user to the organization with `role` and makes it their active organization. */
export async function addMember(
  app: INestApplication<App>,
  ownerCookie: string,
  organizationId: string,
  role: 'admin' | 'member' | 'viewer',
) {
  const user = await signUp(app);
  const invite = await request(app.getHttpServer())
    .post('/api/auth/organization/invite-member')
    .set('Cookie', ownerCookie)
    .send({ email: user.email, role, organizationId })
    .expect(200);
  await request(app.getHttpServer())
    .post('/api/auth/organization/accept-invitation')
    .set('Cookie', user.cookie)
    .send({ invitationId: invite.body.id })
    .expect(200);
  await request(app.getHttpServer())
    .post('/api/auth/organization/set-active')
    .set('Cookie', user.cookie)
    .send({ organizationId })
    .expect(200);
  return user;
}
