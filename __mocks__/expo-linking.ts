/**
 * Mock for expo-linking in vitest.
 * Provides minimal Linking API to prevent crashes when pipeline imports constants/oauth.
 */
export function createURL(path: string, _options?: any): string {
  return `recofree://${path}`;
}

export function parse(url: string) {
  return { hostname: null, path: url, queryParams: {}, scheme: 'recofree' };
}

export function makeUrl(path?: string): string {
  return `recofree://${path || ''}`;
}

export function openURL(_url: string): Promise<true> {
  return Promise.resolve(true);
}

export function canOpenURL(_url: string): Promise<boolean> {
  return Promise.resolve(true);
}

export function addEventListener(_type: string, _handler: any) {
  return { remove: () => {} };
}

export default {
  createURL,
  parse,
  makeUrl,
  openURL,
  canOpenURL,
  addEventListener,
};
