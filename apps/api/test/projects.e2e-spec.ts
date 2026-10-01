import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createApp, signUp, signUpWithOrganization } from './helpers.js';

describe('projects (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;

  beforeAll(async () => {
    app = await createApp();
    ({ cookie } = await signUpWithOrganization(app, 'acme'));
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('rejects requests without a session', async () => {
    await api().get('/projects').expect(401);
  });

  it('rejects users without an active organization', async () => {
    const { cookie: noOrg } = await signUp(app);
    await api().get('/projects').set('Cookie', noOrg).expect(403);
  });

  it('starts new sessions in the user’s organization', async () => {
    const { email, organizationId } = await signUpWithOrganization(app, 'session-start');
    const signIn = await api()
      .post('/api/auth/sign-in/email')
      .send({ email, password: 'password-123456' })
      .expect(200);
    const setCookies = (signIn.headers['set-cookie'] ?? []) as unknown as string[];
    const session = await api()
      .get('/api/auth/get-session')
      .set('Cookie', setCookies.map((c) => c.split(';')[0]).join('; '))
      .expect(200);
    expect(session.body.session.activeOrganizationId).toBe(organizationId);
  });

  it('creates a project with default environments', async () => {
    const res = await api()
      .post('/projects')
      .set('Cookie', cookie)
      .send({ key: 'web', name: 'Web' })
      .expect(201);

    expect(res.body).toMatchObject({ key: 'web', name: 'Web' });
    expect(res.body.environments.map((e: { key: string }) => e.key)).toEqual([
      'development',
      'staging',
      'production',
    ]);
  });

  it('rejects a duplicate key', async () => {
    await api()
      .post('/projects')
      .set('Cookie', cookie)
      .send({ key: 'web', name: 'Web again' })
      .expect(409);
  });

  it('validates input', async () => {
    const res = await api()
      .post('/projects')
      .set('Cookie', cookie)
      .send({ key: 'Not Valid', name: '' })
      .expect(400);
    expect(res.body.issues.map((i: { path: string[] }) => i.path[0])).toEqual(['key', 'name']);
  });

  it('lists, gets, renames and deletes a project', async () => {
    await api().post('/projects').set('Cookie', cookie).send({ key: 'tmp', name: 'Tmp' });

    const list = await api().get('/projects').set('Cookie', cookie).expect(200);
    expect(list.body.map((p: { key: string }) => p.key)).toContain('tmp');

    await api().patch('/projects/tmp').set('Cookie', cookie).send({ name: 'Renamed' }).expect(200);
    const got = await api().get('/projects/tmp').set('Cookie', cookie).expect(200);
    expect(got.body.name).toBe('Renamed');

    await api().delete('/projects/tmp').set('Cookie', cookie).expect(204);
    await api().get('/projects/tmp').set('Cookie', cookie).expect(404);
  });

  it('adds and removes environments', async () => {
    await api()
      .post('/projects/web/environments')
      .set('Cookie', cookie)
      .send({ key: 'qa', name: 'QA' })
      .expect(201);
    let project = await api().get('/projects/web').set('Cookie', cookie);
    expect(project.body.environments.map((e: { key: string }) => e.key)).toContain('qa');

    await api().delete('/projects/web/environments/qa').set('Cookie', cookie).expect(204);
    project = await api().get('/projects/web').set('Cookie', cookie);
    expect(project.body.environments.map((e: { key: string }) => e.key)).not.toContain('qa');
  });

  it("hides other organizations' projects", async () => {
    const { cookie: other } = await signUpWithOrganization(app, 'globex');
    await api().get('/projects/web').set('Cookie', other).expect(404);
    const list = await api().get('/projects').set('Cookie', other).expect(200);
    expect(list.body).toEqual([]);
    await api().patch('/projects/web').set('Cookie', other).send({ name: 'Hijacked' }).expect(404);
  });
});
