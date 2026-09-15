import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

export async function createApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ bodyParser: false });
  await app.init();
  return app;
}

let counter = 0;

/** Signs up a fresh user and returns their session cookie. */
export async function signUp(app: INestApplication<App>, name = 'Test User') {
  const email = `user-${Date.now()}-${counter++}@example.com`;
  const res = await request(app.getHttpServer())
    .post('/api/auth/sign-up/email')
    .send({ name, email, password: 'password-123456' })
    .expect(200);
  const setCookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const cookie = setCookies.map((c) => c.split(';')[0]).join('; ');
  return { cookie, userId: res.body.user.id as string, email };
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
