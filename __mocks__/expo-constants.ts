/**
 * Mock for expo-constants in vitest.
 * Provides minimal Constants object to prevent crashes in expo-linking.
 */
export default {
  expoConfig: {
    name: 'recofree-app',
    slug: 'recofree-app',
    scheme: 'recofree',
    hostUri: null,
  },
  executionEnvironment: 'storeClient',
  appOwnership: null,
  manifest: null,
  manifest2: null,
  expoGoConfig: null,
  easConfig: null,
  __unsafeNoWarnManifest: null,
  sessionId: 'test-session',
  isHeadless: false,
  platform: { web: {} },
  getWebViewUserAgentAsync: async () => 'test-agent',
  deviceName: 'test-device',
};

export const ExecutionEnvironment = {
  Bare: 'bare',
  Standalone: 'standalone',
  StoreClient: 'storeClient',
};

export const AppOwnership = {
  Standalone: 'standalone',
  Expo: 'expo',
  Guest: 'guest',
};
