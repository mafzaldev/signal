import { INestApplication } from '@nestjs/common';
import { SignalClient } from '@mafzaldev/signal/browser';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createApp, signUpWithOrganization } from './helpers.js';

describe('Client keys and the browser SDK API (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  let clientKey: string;
  let serverKey: string;
  let baseUrl: string;
  const clients: SignalClient[] = [];

  const api = () => request(app.getHttpServer());
  const keysPath = '/projects/shop/environments/production/sdk-keys';
  const evaluate = (context: Record<string, unknown>, key = clientKey) =>
    api().post('/sdk/client/evaluate').set('Authorization', key).send({ context });
  const configure = (flagKey: string, body: Record<string, unknown>) =>
    api()
      .patch(`/projects/shop/flags/${flagKey}/environments/production`)
      .set('Cookie', cookie)
      .send(body)
      .expect(200);
  const setClientSide = (flagKey: string, clientSide: boolean) =>
    api()
      .patch(`/projects/shop/flags/${flagKey}`)
      .set('Cookie', cookie)
      .send({ clientSide })
      .expect(200);

  beforeAll(async () => {
    app = await createApp();
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    ({ cookie } = await signUpWithOrganization(app, 'client-sdk-org'));
    await api().post('/projects').set('Cookie', cookie).send({ key: 'shop', name: 'Shop' });
    await api()
      .post('/projects/shop/flags')
      .set('Cookie', cookie)
      .send({ key: 'new-checkout', name: 'New checkout', clientSide: true })
      .expect(201);
    await api()
      .post('/projects/shop/flags')
      .set('Cookie', cookie)
      .send({ key: 'internal-tool', name: 'Internal tool' })
      .expect(201);
    // Pakistan gets the new checkout; one named user is held back.
    await configure('new-checkout', {
      enabled: true,
      targets: [{ variation: 1, values: ['held-back'] }],
      rules: [
        {
          id: 'pk',
          clauses: [{ attribute: 'country', operator: 'in', values: ['PK'] }],
          serve: { variation: 0 },
        },
      ],
      fallthrough: { variation: 1 },
    });
    await configure('internal-tool', { enabled: true, fallthrough: { variation: 0 } });

    const client = await api()
      .post(keysPath)
      .set('Cookie', cookie)
      .send({ name: 'Storefront', kind: 'client' })
      .expect(201);
    clientKey = client.body.key;
    const server = await api()
      .post(keysPath)
      .set('Cookie', cookie)
      .send({ name: 'Backend' })
      .expect(201);
    serverKey = server.body.key;
  });

  afterAll(async () => {
    clients.forEach((c) => c.close());
    await app.close();
  });

  function connect(context: Record<string, string>) {
    const client = new SignalClient({
      clientKey,
      baseUrl,
      context: context as { key: string },
      logger: { warn() {}, error() {} },
      initialReconnectDelayMs: 50,
    });
    clients.push(client);
    return client;
  }

  describe('keys', () => {
    it('creates client keys with their own prefix and kind', async () => {
      expect(clientKey).toMatch(/^client-[\w-]{43}$/);
      expect(serverKey).toMatch(/^sdk-/);
      const list = await api().get(keysPath).set('Cookie', cookie).expect(200);
      expect(list.body).toEqual([
        expect.objectContaining({ name: 'Storefront', kind: 'client' }),
        expect.objectContaining({ name: 'Backend', kind: 'server' }),
      ]);
    });

    it('keeps client keys off the ruleset endpoints', async () => {
      await api().get('/sdk/flags').set('Authorization', clientKey).expect(403);
      await api().get('/sdk/stream').set('Authorization', clientKey).expect(403);
    });

    it('keeps server keys off the browser endpoints', async () => {
      await evaluate({ key: 'u' }, serverKey).expect(403);
      await api().get('/sdk/client/stream').set('Authorization', serverKey).expect(403);
    });

    it('rejects missing and unknown keys', async () => {
      await api()
        .post('/sdk/client/evaluate')
        .send({ context: { key: 'u' } })
        .expect(401);
      await evaluate({ key: 'u' }, 'client-nope').expect(401);
    });
  });

  describe('POST /sdk/client/evaluate', () => {
    it("returns only the context's values for client-side flags", async () => {
      const res = await evaluate({ key: 'ayesha', country: 'PK' }).expect(200);
      expect(res.body).toEqual({
        flags: {
          'new-checkout': {
            value: true,
            variationIndex: 0,
            reason: { kind: 'RULE_MATCH', ruleIndex: 0, ruleId: 'pk' },
          },
        },
      });
    });

    it('never sends rules or targeting', async () => {
      const res = await evaluate({ key: 'john', country: 'US' }).expect(200);
      expect(res.body.flags['new-checkout'].value).toBe(false);
      const body = JSON.stringify(res.body);
      for (const secret of ['held-back', 'PK', 'salt', 'rules', 'targets', 'internal-tool']) {
        expect(body).not.toContain(secret);
      }
    });

    it('follows changes to client-side access', async () => {
      await setClientSide('internal-tool', true);
      const shared = await evaluate({ key: 'u' }).expect(200);
      expect(shared.body.flags['internal-tool'].value).toBe(true);
      await setClientSide('internal-tool', false);
      const hidden = await evaluate({ key: 'u' }).expect(200);
      expect(hidden.body.flags).not.toHaveProperty('internal-tool');
    });

    it('sends a null variation instead of leaving the flag out', async () => {
      await api()
        .post('/projects/shop/flags')
        .set('Cookie', cookie)
        .send({
          key: 'promo-banner',
          name: 'Promo banner',
          kind: 'json',
          variations: [{ value: null }, { value: { text: 'Sale' } }],
          clientSide: true,
        })
        .expect(201);
      await configure('promo-banner', { enabled: true, fallthrough: { variation: 0 } });
      const res = await evaluate({ key: 'u' }).expect(200);
      expect(res.body.flags['promo-banner']).toMatchObject({
        value: null,
        reason: { kind: 'FALLTHROUGH' },
      });
    });

    it('validates the context', async () => {
      await evaluate({ country: 'PK' }).expect(400);
      await evaluate({ key: 'u', address: { city: 'Lahore' } }).expect(400);
    });
  });

  describe('CORS', () => {
    it('answers preflight requests from any origin', async () => {
      const res = await api()
        .options('/sdk/client/evaluate')
        .set('Origin', 'https://shop.example.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization, content-type')
        .expect(204);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
    });

    it('allows any origin on browser responses', async () => {
      const res = await evaluate({ key: 'u' }).set('Origin', 'https://shop.example.com');
      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('leaves the server SDK and dashboard routes without CORS', async () => {
      const sdk = await api()
        .get('/sdk/flags')
        .set('Authorization', serverKey)
        .set('Origin', 'https://shop.example.com');
      expect(sdk.headers['access-control-allow-origin']).toBeUndefined();
      const projects = await api()
        .get('/projects')
        .set('Cookie', cookie)
        .set('Origin', 'https://shop.example.com');
      expect(projects.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('live updates through the browser SDK', () => {
    it('serves values for the context and updates within a second', async () => {
      const client = connect({ key: 'john', country: 'US' });
      expect(await client.ready({ timeout: 2000 })).toBe(true);
      expect(client.bool('new-checkout', true)).toBe(false);

      const changed = new Promise<number>((resolve) =>
        client.on('change', () => resolve(Date.now())),
      );
      const started = Date.now();
      await configure('new-checkout', { fallthrough: { variation: 0 } });
      expect((await changed) - started).toBeLessThan(1000);
      expect(client.bool('new-checkout', false)).toBe(true);
      await configure('new-checkout', { fallthrough: { variation: 1 } });
    });

    it('switches users with identify', async () => {
      const client = connect({ key: 'john', country: 'US' });
      await client.ready({ timeout: 2000 });
      await client.identify({ key: 'held-back', country: 'PK' });
      expect(client.bool('new-checkout', true)).toBe(false);
      await client.identify({ key: 'ayesha', country: 'PK' });
      expect(client.bool('new-checkout', false)).toBe(true);
    });

    it('stops when its key is revoked', async () => {
      const created = await api()
        .post(keysPath)
        .set('Cookie', cookie)
        .send({ name: 'Revoked', kind: 'client' })
        .expect(201);
      const client = new SignalClient({
        clientKey: created.body.key,
        baseUrl,
        context: { key: 'u' },
        logger: { warn() {}, error() {} },
        initialReconnectDelayMs: 50,
      });
      clients.push(client);
      await client.ready({ timeout: 2000 });

      const error = new Promise<string>((resolve) => client.on('error', (e) => resolve(e.message)));
      await api().delete(`${keysPath}/${created.body.id}`).set('Cookie', cookie).expect(204);
      expect(await error).toBe('Invalid client key');
    });
  });
});
