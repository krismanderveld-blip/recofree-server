/**
 * lib/core/time — Central local device time source for RecoFree.
 *
 * Public API:
 * - LocalDeviceTimeService: Singleton service (import and call directly)
 * - useLocalDeviceTime: React hook for components
 * - TimeProvider: React context provider (wrap app root)
 * - Types: LocalTimeSnapshot, CycleTimestamp, CyclePart, etc.
 */

export { LocalDeviceTimeService, deriveCyclePart } from './LocalDeviceTimeService';
export { useLocalDeviceTime } from './useLocalDeviceTime';
export { TimeProvider, useTimeProvider } from './TimeProvider';
export type {
  LocalTimeSnapshot,
  CycleTimestamp,
  CyclePart,
  FormatLocalTimeOptions,
  DeviceTimeContext,
  TimeProvider as TimeProviderInterface,
} from './types';
