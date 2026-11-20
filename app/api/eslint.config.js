import js from '@eslint/js';
import globals from 'globals';
import security from 'eslint-plugin-security';

export default [
  { ignores: ['coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  security.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      // Acessos do tipo obj[chave] aqui usam chaves de listas fechadas (validadas pelo zod).
      'security/detect-object-injection': 'off',
    },
  },
  {
    files: ['tests/**'],
    rules: { 'security/detect-non-literal-fs-filename': 'off' },
  },
];
