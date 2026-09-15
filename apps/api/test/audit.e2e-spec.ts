import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createApp, signUpWithOrganization } from './helpers.js';

interface AuditItem {
  action: string;
  actorId: string;
  before: { enabled?: boolean } | null;
  after: { enabled?: boolean } | null;
}

describe('audit log (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  let userId: string;

  beforeAll(async () => {
    app = await createApp();
    ({ cookie, userId } = await signUpWithOrganization(app, 'audit-org'));

    await api().post('/projects').set('Cookie', cookie).send({ key: 'web', name: 'Web' });
    await api().post('/projects').set('Cookie', cookie).send({ key: 'mobile', name: 'Mobile' });
    await api()
      .post('/projects/web/flags')
      .set('Cookie', cookie)
      .send({ key: 'new-checkout', name: 'New checkout' });
    await api()
      .patch('/projects/web/flags/new-checkout/environments/production')
      .set('Cookie', cookie)
      .send({ enabled: true });
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('records who changed what, newest first', async () => {
    const res = await api().get('/audit-logs').set('Cookie', cookie).expect(200);
    const items: AuditItem[] = res.body.items;

    expect(items.map((i) => i.action)).toEqual([
      'flag_config.updated',
      'flag.created',
      'project.created',
      'project.created',
    ]);
    expect(items.every((i) => i.actorId === userId)).toBe(true);
    expect(items[0]!.before?.enabled).toBe(false);
    expect(items[0]!.after?.enabled).toBe(true);
  });

  it('filters by project', async () => {
    const res = await api().get('/audit-logs?projectKey=mobile').set('Cookie', cookie).expect(200);
    expect(res.body.items.map((i: AuditItem) => i.action)).toEqual(['project.created']);
  });

  it('paginates with a cursor', async () => {
    const first = await api().get('/audit-logs?limit=3').set('Cookie', cookie).expect(200);
    expect(first.body.items).toHaveLength(3);
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const second = await api()
      .get(`/audit-logs?limit=3&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();
  });

  it("does not show other organizations' entries", async () => {
    const other = await signUpWithOrganization(app, 'audit-other');
    const res = await api().get('/audit-logs').set('Cookie', other.cookie).expect(200);
    expect(res.body.items).toEqual([]);
  });
});
