/**
 * Dagstructuur Feature — Public API
 */

// Types
export type {
  Weekday,
  BlockKind,
  NotificationProfile,
  TimeBlock,
  DaySchema,
  WeekSchema,
  DayStructureDocumentV1,
  DayCompletion,
  CompletionStore,
  BellState,
  ScheduledNotificationEntry,
  NotificationIndex,
  WizardStep,
  WizardState,
  ValidationError,
  DayStructureTimePort,
} from './types';

export {
  WEEKDAYS,
  WEEKDAY_FROM_NUMBER,
  WEEKDAY_TO_NUMBER,
  STORAGE_KEYS,
} from './types';

// Constants
export {
  NOTIFICATION_CHANNELS,
  DEFAULT_WAKE_TIME,
  DEFAULT_SLEEP_TIME,
  MIN_BLOCK_DURATION_MINUTES,
  MAX_BLOCKS_PER_DAY,
  COMPLETION_RETENTION_DAYS,
  MAX_SCHEDULED_NOTIFICATIONS,
  NOTIFICATION_LEAD_TIME_MINUTES,
  MAX_LABEL_LENGTH,
  MIN_LABEL_LENGTH,
} from './constants';

// Time Adapter
export { DayStructureTimeAdapter } from './time-adapter';

// Validation
export { validateBlock, validateDay, validateWeek } from './validation';

// Repository
export {
  loadDocument,
  saveDocument,
  deleteDocument,
  loadOrCreateDocument,
  validateAndSave,
} from './repository';

// Completion Service
export {
  getCompletion,
  getTodayCompletion,
  toggleBlockCompletion,
  isBlockCompleted,
  clearDayCompletion,
  cleanupOldCompletions,
  getCompletionCounts,
  getStreak,
} from './completion-service';

// Day Structure Service
export {
  getDocument,
  isConfigured,
  saveWeekSchema,
  resetDayStructure,
  getDayBlocks,
  getTodayBlocks,
  saveDayBlocks,
  addBlock,
  deleteBlock,
  editBlock,
  moveBlock,
  copyToAllDays,
  copyToSpecificDays,
  getLastPlanningTimezone,
  hasTimezoneChangedSinceLastPlanning,
} from './day-structure-service';

// Notification Service
export {
  setupNotificationChannels,
  cancelAllNotifications,
  scheduleAllNotifications,
  rescheduleNotifications,
  getNotificationIndex,
  needsRescheduling,
} from './notification-service';

// Permission Service
export {
  loadBellState,
  saveBellState,
  getPermissionStatus,
  requestPermission,
  resolveBellState,
  enableBell,
  disableBell,
  toggleBell,
  loadStreaksEnabled,
  saveStreaksEnabled,
  toggleStreaks,
} from './permission-service';

// Observer Hook
export {
  initNotificationHandler,
  useDayStructureObserver,
} from './use-day-structure-observer';

// Helpers
export {
  generateId,
  createEmptyWeekSchema,
  createEmptyDocument,
  createBlock,
  copyDayBlocks,
  copyDayToAllWeekdays,
  copyDayToWeekdays,
  insertBlock,
  removeBlock,
  updateBlock,
  reorderBlocks,
  getBlocksForWeekday,
  isDayConfigured,
  hasAnyConfiguredDay,
  getWakeBlock,
  getSleepBlock,
  getActivityBlocks,
} from './helpers';
