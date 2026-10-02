import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgres://wc:wc_dev_pass@localhost:5432/wc_test',
      IP_HASH_SECRET: 'test-secret-test-secret-test-secret-123456',
      ALLOWED_ORIGINS: 'http://localhost:5173',
      UPLOAD_DIR: 'test/.uploads',
      LOG_LEVEL: 'silent',
      MAX_LOGIN_ATTEMPTS: '5',
    },
  },
});
