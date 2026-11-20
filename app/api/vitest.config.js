import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false, // todos os arquivos compartilham o mesmo banco de teste
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'], // lcov é lido pelo SonarCloud
      include: ['src/**/*.js'],
      exclude: ['src/server.js', 'src/scripts/**'],
    },
  },
});
