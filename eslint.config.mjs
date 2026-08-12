import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextCoreWebVitals,
  {
    rules: {
      // Estas reglas nuevas de React Hooks 7 requieren refactorizar varios
      // flujos de estado existentes. Se mantienen fuera del gate de lint
      // hasta poder migrarlos de forma independiente.
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['e2e/**/*.ts'],
    rules: {
      // `use` es un fixture de Playwright, no un React Hook.
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'node_modules/**',
    'reports/**',
    'test-results/**',
    'playwright-report/**',
    'blob-report/**',
    'next-env.d.ts',
  ]),
]);
