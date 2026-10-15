import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { cookieFrom, createApp, emailTo } from './helpers.js';

describe('email verification (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('signs a new account in only after it opens the emailed link', async () => {
    const email = `verify-${Date.now()}@example.com`;
    const password = 'password-123456';

    const signUp = await api()
      .post('/api/auth/sign-up/email')
      .send({ name: 'New Person', email, password, callbackURL: '/email-verified' })
      .expect(200);
    expect(signUp.body.token).toBeNull();

    const blocked = await api().post('/api/auth/sign-in/email').send({ email, password });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('EMAIL_NOT_VERIFIED');

    const message = await emailTo(email);
    expect(message.Subject).toBe('Verify your email for Signal');
    // The link opens on the dashboard, which forwards /api/auth to the API.
    const link = new URL(message.Text.match(/http\S+verify-email\S+/)![0]);
    expect(link.origin).toBe('http://localhost:3000');
    expect(link.searchParams.get('callbackURL')).toBe('/email-verified');

    const verify = await api()
      .get(`${link.pathname}${link.search}`)
      .expect(302)
      .expect('location', '/email-verified');
    const session = await api()
      .get('/api/auth/get-session')
      .set('Cookie', cookieFrom(verify))
      .expect(200);
    expect(session.body.user).toMatchObject({ email, emailVerified: true });

    await api().post('/api/auth/sign-in/email').send({ email, password }).expect(200);
  });

  describe('never redirects to another site after verifying', () => {
    const evil = 'https://evil.example/phish';

    it('refuses to sign up with an untrusted destination', async () => {
      const res = await api()
        .post('/api/auth/sign-up/email')
        .send({
          name: 'Target',
          email: `evil-signup-${Date.now()}@example.com`,
          password: 'password-123456',
          callbackURL: evil,
        })
        .expect(403);
      expect(res.body.code).toBe('INVALID_CALLBACK_URL');
    });

    it('refuses to resend a link with an untrusted destination', async () => {
      await api()
        .post('/api/auth/send-verification-email')
        .send({ email: `evil-resend-${Date.now()}@example.com`, callbackURL: evil })
        .expect(403);
    });

    it('refuses a link edited to point at another site', async () => {
      const email = `evil-edit-${Date.now()}@example.com`;
      await api()
        .post('/api/auth/sign-up/email')
        .send({ name: 'Target', email, password: 'password-123456' })
        .expect(200);
      const link = new URL((await emailTo(email)).Text.match(/http\S+verify-email\S+/)![0]);
      link.searchParams.set('callbackURL', evil);

      const res = await api().get(`${link.pathname}${link.search}`).expect(403);
      expect(res.headers.location).toBeUndefined();
    });

    it('refuses a made-up link instead of redirecting with an error', async () => {
      const res = await api()
        .get(`/api/auth/verify-email?token=not-a-token&callbackURL=${encodeURIComponent(evil)}`)
        .expect(403);
      expect(res.headers.location).toBeUndefined();
    });
  });
});
