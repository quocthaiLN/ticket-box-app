import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Load .env from ticket-box-app/ (parent of tests/)
  const env = loadEnv(mode ?? 'test', resolve(__dirname, '..'), '');

  return {
    resolve: {
      // Point workspace packages to their TypeScript source so tests don't
      // require a dist rebuild before running.
      alias: {
        '@ticketbox/redis': resolve(__dirname, '../packages/redis/src/index.ts'),
        '@ticketbox/database': resolve(__dirname, '../packages/database/src/index.ts'),
      },
      // Resolve .js imports to .ts sources (NodeNext TypeScript pattern)
      extensionAlias: {
        '.js': ['.ts', '.js'],
      },
    },
    test: {
      globals: true,
      environment: 'node',
      include: ['**/*.integration.test.ts'],
      env,
      pool: 'forks',
      poolOptions: {
        forks: { singleFork: true },
      },
      testTimeout: 30000,
      hookTimeout: 30000,
    },
  };
});
