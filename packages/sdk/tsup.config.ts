import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/node.ts'],
  format: ['esm', 'cjs'],
  // tsup's d.ts build sets `baseUrl`, which TypeScript 6 rejects as deprecated
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
  sourcemap: true,
  // core is internal, so it is bundled into the published SDK
  noExternal: ['@feature-flags/core'],
});
