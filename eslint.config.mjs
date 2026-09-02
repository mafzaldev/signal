import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', 'apps/web/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
