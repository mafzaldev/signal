import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createApp, DASHBOARD_ORIGIN, emailTo, signUpWithOrganization } from './helpers.js';

describe('invitations (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('emails the invitee a link to accept', async () => {
    const owner = await signUpWithOrganization(app, 'invites');
    const email = `invitee-${Date.now()}@example.com`;

    const invitation = await request(app.getHttpServer())
      .post('/api/auth/organization/invite-member')
      .set('Cookie', owner.cookie)
      .set('Origin', DASHBOARD_ORIGIN)
      .send({ email, role: 'member' })
      .expect(200);

    const message = await emailTo(email);
    expect(message.Subject).toBe('Test User invited you to join invites on Signal');
    const link = `http://localhost:3000/invite/${invitation.body.id}`;
    expect(message.Text).toContain(link);
    expect(message.HTML).toContain(link);
    expect(message.Text).toContain(
      "As a member of invites, you'll be able to create, change and roll out feature flags",
    );
    expect(message.Text).toContain(`Sent by Test User (${owner.email}).`);
  });
});
