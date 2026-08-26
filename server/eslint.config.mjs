// Flat config (ESLint 8.57 auto-detects `eslint.config.*` in the cwd or an ancestor).
// This file MUST exist: without it ESLint keeps walking up past the repo and picks up whatever
// config lives in a parent directory — which is how `npm run lint` came to fail with
// "Cannot find package 'eslint-config-next'". `deploy-api.yml` runs `npm run lint` before
// `sam deploy`, so a broken lint means no deploy at all.
//
// Deliberately dependency-free beyond what package.json already declares: the rules come from
// the installed @typescript-eslint plugin plus hand-picked core rules, so there is no
// `@eslint/js` / `globals` import to keep in sync.

import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      '.aws-sam/**',      // sam build output
      '.serverless/**',   // stray Serverless Framework artifact
      '**/*.js',
      '**/*.mjs',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      // No `project` — type-aware linting would need a tsconfig that includes __tests__ and
      // would slow CI down considerably. The `tsc --noEmit` typecheck covers types already.
      parserOptions: { ecmaFeatures: {} },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // Core rules worth keeping. `no-undef` stays off: it does not understand TypeScript's
      // ambient/global declarations and the compiler already catches unresolved identifiers.
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': 'warn',
      'no-throw-literal': 'error',
      'no-return-await': 'error',

      // Unused vars: the TS-aware version, with the conventional leading-underscore escape
      // hatch for deliberately-ignored params (e.g. Express's `_req`).
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          // `const { passwordHash, ...rest } = user` is the sanitizeUser idiom — the named
          // bindings exist precisely to be dropped from `rest`.
          ignoreRestSiblings: true,
        },
      ],

      // Warn, not error: there are ~34 deliberate `any`s in the service layer (Mongo filter
      // objects, Mongoose lean() results). They are worth tightening over time, but they are
      // not a reason to block a deploy — `tsc --noEmit` runs in strict mode and passes.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Non-null assertions are used intentionally where env vars are validated at startup
      // (e.g. `process.env.DYNAMO_DEDUP_TABLE!` in lib/dynamo.ts).
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Tests mock DB/AWS clients heavily; `any` in a mock is noise, not a defect, and
    // `require()` inside jest.isolateModules is the only way to re-import a module under a
    // fresh mock registry.
    files: ['__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      'no-console': 'off',
    },
  },
];
