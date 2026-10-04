import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      // TypeScript already resolves identifiers; ESLint's no-undef is redundant
      // and mis-flags browser/Three.js globals in a strict TS project.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Test files, test setup and config may reach for `any` more freely.
    files: ['**/*.test.ts', 'src/test/**/*.ts', '*.config.{js,ts}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  prettier
);
