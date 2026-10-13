import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/node.ts', 'src/browser.ts'],
  format: ['esm', 'cjs'],
  // Core's types are bundled from its source, so the published .d.ts files don't import
  // the internal package (core's own build splits them into chunks the SDK wouldn't ship).
  // tsup's d.ts build sets `baseUrl`, which TypeScript 6 rejects as deprecated.
  dts: {
    resolve: ['@signal/core'],
    compilerOptions: {
      ignoreDeprecations: '6.0',
      paths: { '@signal/core': ['../core/src/index.ts'] },
    },
  },
  clean: true,
  sourcemap: true,
  // core is internal, so it is bundled into the published SDK
  noExternal: ['@signal/core'],
});
