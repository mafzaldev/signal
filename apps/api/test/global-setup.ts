import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

/** Recreates the test database from scratch and applies migrations. */
export default async function setup() {
  const url = new URL(
    process.env.TEST_DATABASE_URL ?? 'postgres://signal:signal@localhost:5433/signal_test',
  );
  const name = url.pathname.slice(1);

  const admin = new Client({ connectionString: new URL('/postgres', url).toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  await client.end();
}
