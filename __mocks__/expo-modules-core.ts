/**
 * Mock for expo-modules-core to allow pipeline tests to run in vitest.
 * The real EventEmitter requires native modules not available in Node.
 */
export class EventEmitter {
  private listeners = new Map<string, Set<Function>>();

  addListener(eventName: string, listener: Function) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName)!.add(listener);
    return { remove: () => this.listeners.get(eventName)?.delete(listener) };
  }

  removeAllListeners(eventName?: string) {
    if (eventName) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
    }
  }

  emit(eventName: string, ...args: any[]) {
    this.listeners.get(eventName)?.forEach(fn => fn(...args));
  }
}

export function requireNativeModule(name: string) {
  return {};
}

export function requireOptionalNativeModule(name: string) {
  return null;
}

export const NativeModulesProxy = new Proxy({}, {
  get: () => () => {},
});

export function createPermissionHook() {
  return () => [null, () => Promise.resolve(null), () => Promise.resolve(null)];
}
