import type { INestApplication } from '@nestjs/common';
import { clientCors } from './sdk/client-cors.middleware.js';

/**
 * App-level setup shared by `main.ts` and the e2e tests. Call it before `app.init()`:
 * the auth module enables CORS for the dashboard's origin across every route during
 * init, and it would otherwise answer browser SDK preflights before `clientCors` runs.
 */
export function setupApp(app: INestApplication) {
  app.use('/sdk/client', clientCors);
}
