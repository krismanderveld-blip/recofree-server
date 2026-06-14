import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@shared': path.resolve(__dirname, './shared'),
      'react-native': path.resolve(__dirname, './__mocks__/react-native.ts'),
    },
  },
  test: {
    include: ['__tests__/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
