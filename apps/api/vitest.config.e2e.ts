import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Test files share one database.
    fileParallelism: false,
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? 'postgres://signal:signal@localhost:5433/signal_test',
      REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1',
      BETTER_AUTH_SECRET: 'e2e-test-secret-at-least-32-characters-long',
      BETTER_AUTH_URL: 'http://localhost:4000',
      // Emails go to Mailpit (`pnpm db:up`), where the tests read them back.
      SMTP_URL: process.env.TEST_SMTP_URL ?? 'smtp://localhost:1025',
      DASHBOARD_URL: 'http://localhost:3000',
    },
  },
});
