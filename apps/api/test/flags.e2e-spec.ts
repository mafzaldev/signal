import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { addMember, createApp, signUpWithOrganization } from './helpers.js';

describe('flags (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  let organizationId: string;

  beforeAll(async () => {
    app = await createApp();
    ({ cookie, organizationId } = await signUpWithOrganization(app, 'flags-org'));
    await api().post('/projects').set('Cookie', cookie).send({ key: 'web', name: 'Web' });
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('creates a boolean flag switched off in every environment', async () => {
    const res = await api()
      .post('/projects/web/flags')
      .set('Cookie', cookie)
      .send({ key: 'new-checkout', name: 'New checkout' })
      .expect(201);

    expect(res.body).toMatchObject({
      key: 'new-checkout',
      kind: 'boolean',
      variations: [{ value: true }, { value: false }],
    });
    expect(res.body.environments).toHaveLength(3);
    for (const env of res.body.environments) {
      expect(env).toMatchObject({
        enabled: false,
        offVariation: 1,
        fallthrough: { variation: 0 },
        version: 1,
      });
    }
  });

  it('rejects a duplicate flag key', async () => {
    await api()
      .post('/projects/web/flags')
      .set('Cookie', cookie)
      .send({ key: 'new-checkout', name: 'Again' })
      .expect(409);
  });

  it('creates a string flag with its own variations', async () => {
    await api()
      .post('/projects/web/flags')
      .set('Cookie', cookie)
      .send({
        key: 'button-color',
        name: 'Button color',
        kind: 'string',
        variations: [{ value: 'blue' }, { value: 'green' }, { value: 'red' }],
      })
      .expect(201);
  });

  it('lists flags with a per-environment summary', async () => {
    const res = await api().get('/projects/web/flags').set('Cookie', cookie).expect(200);
    expect(res.body.map((f: { key: string }) => f.key)).toEqual(['button-color', 'new-checkout']);
    expect(res.body[1].environments[0]).toEqual({
      environmentKey: 'development',
      enabled: false,
      version: 1,
    });
  });

  it('updates targeting for one environment and bumps its version', async () => {
    const res = await api()
      .patch('/projects/web/flags/new-checkout/environments/production')
      .set('Cookie', cookie)
      .send({
        enabled: true,
        targets: [{ variation: 0, values: ['user-1'] }],
        rules: [
          {
            id: 'pk',
            clauses: [{ attribute: 'country', operator: 'in', values: ['PK'] }],
            serve: { variation: 0 },
          },
        ],
        fallthrough: {
          rollout: [
            { variation: 0, weight: 20_000 },
            { variation: 1, weight: 80_000 },
          ],
        },
      })
      .expect(200);
    expect(res.body).toMatchObject({ environmentKey: 'production', enabled: true, version: 2 });

    const flag = await api().get('/projects/web/flags/new-checkout').set('Cookie', cookie);
    const byEnv = Object.fromEntries(
      flag.body.environments.map((e: { environmentKey: string }) => [e.environmentKey, e]),
    );
    expect(byEnv.production.enabled).toBe(true);
    expect(byEnv.development.enabled).toBe(false);
  });

  it('rejects targeting that points at a missing variation', async () => {
    await api()
      .patch('/projects/web/flags/new-checkout/environments/production')
      .set('Cookie', cookie)
      .send({ offVariation: 5 })
      .expect(400);
  });

  it('rejects removing a variation that targeting still uses', async () => {
    await api()
      .patch('/projects/web/flags/button-color/environments/staging')
      .set('Cookie', cookie)
      .send({ fallthrough: { variation: 2 } })
      .expect(200);
    const res = await api()
      .patch('/projects/web/flags/button-color')
      .set('Cookie', cookie)
      .send({ variations: [{ value: 'blue' }, { value: 'green' }] })
      .expect(400);
    expect(res.body.message).toContain('staging');
  });

  it('rejects variations of the wrong kind', async () => {
    await api()
      .patch('/projects/web/flags/button-color')
      .set('Cookie', cookie)
      .send({ variations: [{ value: 1 }, { value: 2 }] })
      .expect(400);
  });

  it('bumps every environment version when variations change', async () => {
    await api()
      .patch('/projects/web/flags/button-color')
      .set('Cookie', cookie)
      .send({ variations: [{ value: 'blue' }, { value: 'green' }, { value: 'purple' }] })
      .expect(200);
    const flag = await api().get('/projects/web/flags/button-color').set('Cookie', cookie);
    const versions = flag.body.environments.map((e: { version: number }) => e.version);
    expect(versions).toEqual([2, 3, 2]);
  });

  it('gives flags a config in newly added environments', async () => {
    await api()
      .post('/projects/web/environments')
      .set('Cookie', cookie)
      .send({ key: 'qa', name: 'QA' })
      .expect(201);
    const flag = await api().get('/projects/web/flags/new-checkout').set('Cookie', cookie);
    expect(
      flag.body.environments.map((e: { environmentKey: string }) => e.environmentKey),
    ).toContain('qa');
  });

  it('deletes a flag', async () => {
    await api()
      .post('/projects/web/flags')
      .set('Cookie', cookie)
      .send({ key: 'temp', name: 'Temp' });
    await api().delete('/projects/web/flags/temp').set('Cookie', cookie).expect(204);
    await api().get('/projects/web/flags/temp').set('Cookie', cookie).expect(404);
  });

  describe('roles', () => {
    it('lets members edit flags but not projects', async () => {
      const member = await addMember(app, cookie, organizationId, 'member');
      await api()
        .patch('/projects/web/flags/new-checkout/environments/development')
        .set('Cookie', member.cookie)
        .send({ enabled: true })
        .expect(200);
      await api()
        .post('/projects')
        .set('Cookie', member.cookie)
        .send({ key: 'nope', name: 'Nope' })
        .expect(403);
    });

    it('lets viewers read but not write', async () => {
      const viewer = await addMember(app, cookie, organizationId, 'viewer');
      await api().get('/projects/web/flags').set('Cookie', viewer.cookie).expect(200);
      await api()
        .patch('/projects/web/flags/new-checkout/environments/development')
        .set('Cookie', viewer.cookie)
        .send({ enabled: false })
        .expect(403);
    });
  });
});
