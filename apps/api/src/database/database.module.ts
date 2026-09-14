import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { db, pool } from '../db/client.js';

export const DB = Symbol('DB');

@Global()
@Module({
  providers: [{ provide: DB, useValue: db }],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await pool.end();
  }
}
