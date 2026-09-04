import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: false,
    reporters: [
      'default',
      ['json', { outputFile: 'reports/unit-tests.json' }],
    ],
  },
});
