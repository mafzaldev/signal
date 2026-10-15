import { defineConfig } from 'astro/config';

export default defineConfig({
  server: { port: 3100 },
  markdown: {
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
