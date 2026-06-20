import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  define: {
    __DEV__: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@shared': path.resolve(__dirname, './shared'),
      'react-native': path.resolve(__dirname, './__mocks__/react-native.ts'),
      'expo-secure-store': path.resolve(__dirname, './__mocks__/expo-secure-store.ts'),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, './__mocks__/async-storage.ts'),
    },
  },
  test: {
    include: ['__tests__/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
