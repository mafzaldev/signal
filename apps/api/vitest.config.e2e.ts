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
        process.env.TEST_DATABASE_URL ?? 'postgres://flags:flags@localhost:5433/flags_test',
      BETTER_AUTH_SECRET: 'e2e-test-secret-at-least-32-characters-long',
      BETTER_AUTH_URL: 'http://localhost:4000',
    },
  },
});
