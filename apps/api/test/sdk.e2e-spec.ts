import { INestApplication } from '@nestjs/common';
import { createClient, type FlagsClient } from '@feature-flags/sdk';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { addMember, createApp, signUpWithOrganization } from './helpers.js';

describe('SDK keys and SDK API (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  let organizationId: string;
  let sdkKey: string;
  let baseUrl: string;
  const clients: FlagsClient[] = [];

  const api = () => request(app.getHttpServer());
  const keysPath = '/projects/web/environments/production/sdk-keys';
  const toggle = (enabled: boolean, env = 'production') =>
    api()
      .patch(`/projects/web/flags/new-checkout/environments/${env}`)
      .set('Cookie', cookie)
      .send({ enabled })
      .expect(200);

  beforeAll(async () => {
    app = await createApp();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    ({ cookie, organizationId } = await signUpWithOrganization(app, 'sdk-org'));
    await api().post('/projects').set('Cookie', cookie).send({ key: 'web', name: 'Web' });
    await api()
      .post('/projects/web/flags')
      .set('Cookie', cookie)
      .send({ key: 'new-checkout', name: 'New checkout' });
  });

  afterAll(async () => {
    clients.forEach((c) => c.close());
    await app.close();
  });

  function connect(key = sdkKey) {
    const client = createClient({ sdkKey: key, baseUrl, logger: { warn() {}, error() {} } });
    clients.push(client);
    return client;
  }

  describe('keys', () => {
    it('creates a key and shows the full value only once', async () => {
      const res = await api()
        .post(keysPath)
        .set('Cookie', cookie)
        .send({ name: 'Backend' })
        .expect(201);
      sdkKey = res.body.key;
      expect(sdkKey).toMatch(/^sdk-[\w-]{43}$/);
      expect(res.body.keyPrefix).toBe(sdkKey.slice(0, 12));

      const list = await api().get(keysPath).set('Cookie', cookie).expect(200);
      expect(list.body).toEqual([
        expect.objectContaining({ name: 'Backend', kind: 'server', keyPrefix: res.body.keyPrefix }),
      ]);
      expect(list.body[0]).not.toHaveProperty('key');
      expect(list.body[0]).not.toHaveProperty('keyHash');
    });

    it('only lets owners and admins create keys', async () => {
      const member = await addMember(app, cookie, organizationId, 'member');
      await api().post(keysPath).set('Cookie', member.cookie).send({ name: 'x' }).expect(403);
    });

    it('records key changes in the audit log without the key', async () => {
      const res = await api().get('/audit-logs?entityType=sdk_key').set('Cookie', cookie);
      expect(res.body.items[0].action).toBe('sdk_key.created');
      expect(JSON.stringify(res.body.items[0])).not.toContain(sdkKey);
    });
  });

  describe('GET /sdk/flags', () => {
    it('rejects missing and unknown keys', async () => {
      await api().get('/sdk/flags').expect(401);
      await api().get('/sdk/flags').set('Authorization', 'sdk-nope').expect(401);
    });

    it("returns the environment's ruleset", async () => {
      const res = await api().get('/sdk/flags').set('Authorization', sdkKey).expect(200);
      expect(res.body.segments).toEqual({});
      expect(res.body.flags['new-checkout']).toMatchObject({
        key: 'new-checkout',
        enabled: false,
        version: 1,
        variations: [{ value: true }, { value: false }],
      });
    });

    it('accepts a Bearer token', async () => {
      await api().get('/sdk/flags').set('Authorization', `Bearer ${sdkKey}`).expect(200);
    });

    it('answers 304 until something changes', async () => {
      const first = await api().get('/sdk/flags').set('Authorization', sdkKey).expect(200);
      const etag = String(first.headers.etag);
      await api()
        .get('/sdk/flags')
        .set('Authorization', sdkKey)
        .set('If-None-Match', etag)
        .expect(304);

      await toggle(true);
      const changed = await api()
        .get('/sdk/flags')
        .set('Authorization', sdkKey)
        .set('If-None-Match', etag)
        .expect(200);
      expect(changed.body.flags['new-checkout'].enabled).toBe(true);
      await toggle(false);
    });
  });

  describe('live updates through the SDK', () => {
    it('applies a toggle within a second', async () => {
      const client = connect();
      expect(await client.waitForInitialization({ timeout: 2000 })).toBe(true);
      expect(client.boolVariation('new-checkout', { key: 'user-1' }, true)).toBe(false);

      const changed = new Promise<number>((resolve) =>
        client.on('change', () => resolve(Date.now())),
      );
      const started = Date.now();
      await toggle(true);
      const latency = (await changed) - started;

      expect(latency).toBeLessThan(1000);
      expect(client.boolVariation('new-checkout', { key: 'user-1' }, false)).toBe(true);
    });

    it('ignores changes in other environments', async () => {
      const client = connect();
      await client.waitForInitialization({ timeout: 2000 });
      const onChange = vi.fn();
      client.on('change', onChange);

      await toggle(true, 'development');
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(onChange).not.toHaveBeenCalled();
    });

    it('receives new and deleted flags', async () => {
      const client = connect();
      await client.waitForInitialization({ timeout: 2000 });

      const created = new Promise((resolve) => client.on('change', resolve));
      await api()
        .post('/projects/web/flags')
        .set('Cookie', cookie)
        .send({
          key: 'banner',
          name: 'Banner',
          kind: 'string',
          variations: [{ value: 'a' }, { value: 'b' }],
        })
        .expect(201);
      expect(await created).toBe('banner');
      expect(client.stringVariation('banner', { key: 'u' }, 'default')).toBe('a');

      const deleted = new Promise((resolve) => client.on('change', resolve));
      await api().delete('/projects/web/flags/banner').set('Cookie', cookie).expect(204);
      expect(await deleted).toBe('banner');
      expect(client.stringVariation('banner', { key: 'u' }, 'default')).toBe('default');
    });
  });

  it('rejects a revoked key', async () => {
    const list = await api().get(keysPath).set('Cookie', cookie);
    await api().delete(`${keysPath}/${list.body[0].id}`).set('Cookie', cookie).expect(204);
    await api().get('/sdk/flags').set('Authorization', sdkKey).expect(401);
  });
});
