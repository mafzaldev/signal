import { Signal } from '@mafzaldev/signal';
import request from 'supertest';
import { createApp, signUpWithOrganization } from './helpers.js';

describe('shutdown (e2e)', () => {
  it('closes open SDK streams instead of waiting for them', async () => {
    const app = await createApp();
    await app.listen(0, '127.0.0.1');
    const { cookie } = await signUpWithOrganization(app, 'shutdown-org');
    const api = () => request(app.getHttpServer());
    await api().post('/projects').set('Cookie', cookie).send({ key: 'web', name: 'Web' });
    const created = await api()
      .post('/projects/web/environments/production/sdk-keys')
      .set('Cookie', cookie)
      .send({ name: 'k' });

    const client = new Signal({
      sdkKey: created.body.key,
      baseUrl: await app.getUrl(),
      logger: { warn() {}, error() {} },
      // Keep the client from reconnecting before the server is gone.
      initialReconnectDelayMs: 60_000,
    });
    expect(await client.ready({ timeout: 2000 })).toBe(true);

    const closed = app.close().then(() => 'closed');
    const timedOut = new Promise((resolve) => setTimeout(() => resolve('timed out'), 3000));
    expect(await Promise.race([closed, timedOut])).toBe('closed');
    await client.close();
  });
});
