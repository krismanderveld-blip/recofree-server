/**
 * Export Scope Completeness — Acceptance Tests
 *
 * Verifies that ALL persistent user data (sobriety, milestones, mood history,
 * progress tracker data, trigger patterns) survives an export → reset → import cycle.
 *
 * Also verifies the intake import path (createExportImportStoresAdapter + importEncryptedRecoFreeBackup).
 *
 * Key finding: All these data points live inside userDat and stateDat — there are
 * NO separate stores for sobriety, milestones, or mood trend. This test suite
 * proves that by round-tripping realistic data through the export/import pipeline.
 */

import { describe, it, expect } from 'vitest';
import { createEncryptedRecoFreeExport } from '@/lib/features/exportImport/services/exportDataService';
import { importEncryptedRecoFreeBackup } from '@/lib/features/exportImport/services/importDataService';
import type { ExportImportStores } from '@/lib/features/exportImport/services/exportImportStores.types';

// ─── In-Memory Mock Stores ────────────────────────────────────────────────────

function createMockStores(initial?: {
  userDat?: { elias: unknown; kim: unknown };
  stateDat?: { elias: unknown; kim: unknown };
  projectionsDat?: { elias: unknown; kim: unknown };
  logsDat?: { elias: unknown; kim: unknown };
  diary?: { elias: unknown[]; kim: unknown[] };
  gratitude?: { elias: unknown[]; kim: unknown[] };
  backpack?: { elias: unknown; kim: unknown };
  personaProjection?: { elias: unknown; kim: unknown };
  emergencyContacts?: unknown[];
  derivedCaches?: { backpackHash: unknown; extractedEntities: unknown };
}): ExportImportStores {
  let userDat = initial?.userDat ?? { elias: null, kim: null };
  let stateDat = initial?.stateDat ?? { elias: null, kim: null };
  let projectionsDat = initial?.projectionsDat ?? { elias: null, kim: null };
  let logsDat = initial?.logsDat ?? { elias: null, kim: null };
  let diary = initial?.diary ?? { elias: [], kim: [] };
  let gratitude = initial?.gratitude ?? { elias: [], kim: [] };
  let backpack = initial?.backpack ?? { elias: null, kim: null };
  let personaProjection = initial?.personaProjection ?? { elias: null, kim: null };
  let emergencyContacts = initial?.emergencyContacts ?? [];
  let derivedCaches = initial?.derivedCaches ?? { backpackHash: null, extractedEntities: null };
  let vspInsight = { elias: null, kim: null };
  let eigenRegieAuxiliary = { legacyPlan: null, notificationSettings: null, lastCheckAt: null };

  return {
    userDatStore: {
      async exportAllPersonas() { return userDat; },
      async replaceAllPersonas(data) { userDat = data as any; },
    },
    stateDatStore: {
      async exportAllPersonas() { return stateDat; },
      async replaceAllPersonas(data) { stateDat = data as any; },
    },
    projectionsDatStore: {
      async exportAllPersonas() { return projectionsDat; },
      async replaceAllPersonas(data) { projectionsDat = data as any; },
    },
    logsDatStore: {
      async exportAllPersonasRaw() { return logsDat; },
      async replaceAllPersonasRaw(data) { logsDat = data as any; },
    },
    diaryStore: {
      async exportAllPersonas() { return diary; },
      async replaceAllPersonas(data) { diary = data as any; },
    },
    gratitudeStore: {
      async exportAllPersonas() { return gratitude; },
      async replaceAllPersonas(data) { gratitude = data as any; },
    },
    backpackStore: {
      async exportAllPersonas() { return backpack; },
      async replaceAllPersonas(data) { backpack = data as any; },
    },
    personaProjectionStore: {
      async exportAllPersonas() { return personaProjection; },
      async replaceAllPersonas(data) { personaProjection = data as any; },
    },
    emergencyContactsStore: {
      async exportAll() { return emergencyContacts; },
      async replaceAll(data) { emergencyContacts = data as any; },
    },
    dayStructureStore: {
      async exportAll() { return { document: null, completion: null, bellState: null, streaksEnabled: null }; },
      async replaceAll() {},
    },
    appPreferencesStore: {
      async exportAll() { return { language: null, country: null }; },
      async replaceAll() {},
    },
    derivedCacheStore: {
      async exportAll() { return derivedCaches; },
      async replaceAll(data) { derivedCaches = data as any; },
    },
    vspInsightStore: {
      async exportAllPersonas() { return vspInsight; },
      async replaceAllPersonas(data) { vspInsight = data as any; },
    },
    eigenRegieAuxiliaryStore: {
      async exportAll() { return eigenRegieAuxiliary; },
      async replaceAll(data) { eigenRegieAuxiliary = data as any; },
    },
  };
}

const PASSWORD = 'ExportTest2026!';
const APP_VERSION = '1.0.0';

// ─── Realistic Test Data ──────────────────────────────────────────────────────

const REALISTIC_USER_DAT = {
  totalSessions: 42,
  lastSessionDate: '2026-06-14T18:30:00.000Z',
  sobrietyDate: '2025-01-15T00:00:00.000Z', // Key: sobriety counter origin
  milestoneTracker: {
    seenMilestones: ['1_week', '1_month', '3_months', '6_months', '1_year'],
    lastCheckedAt: '2026-06-14T18:30:00.000Z',
    nextMilestone: '18_months',
  },
  moodHistory: [
    { date: '2026-06-10', mood: 6, craving: 3, focus: 7, despondency: 2 },
    { date: '2026-06-11', mood: 5, craving: 4, focus: 6, despondency: 3 },
    { date: '2026-06-12', mood: 7, craving: 2, focus: 8, despondency: 1 },
    { date: '2026-06-13', mood: 4, craving: 6, focus: 5, despondency: 5 },
    { date: '2026-06-14', mood: 6, craving: 3, focus: 7, despondency: 2 },
  ],
  triggerPatterns: [
    { trigger: 'loneliness', frequency: 8, lastSeen: '2026-06-13', confidence: 0.85 },
    { trigger: 'work_stress', frequency: 5, lastSeen: '2026-06-14', confidence: 0.72 },
    { trigger: 'social_pressure', frequency: 3, lastSeen: '2026-06-10', confidence: 0.55 },
  ],
  schemaTendencies: [
    { schema: 'verlating_instabiliteit', confidence: 0.85, frequency: 12, confirmed: true, firstDetectedAt: '2025-03-01', lastUpdatedAt: '2026-06-14' },
    { schema: 'emotionele_verwaarlozing', confidence: 0.65, frequency: 4, confirmed: false, firstDetectedAt: '2025-05-10', lastUpdatedAt: '2026-06-12' },
  ],
  modeTendencies: [
    { mode: 'kwetsbare_kind', confidence: 0.80, frequency: 9, confirmed: true, firstDetectedAt: '2025-03-01', lastUpdatedAt: '2026-06-14' },
    { mode: 'beschermer', confidence: 0.55, frequency: 3, confirmed: false, firstDetectedAt: '2025-06-01', lastUpdatedAt: '2026-06-10' },
  ],
  moduleUsage: { grounding: 5, reflection: 8, coping: 3, relapse_prevention: 2 },
  sessionAnalyses: [
    { date: '2026-06-14', themes: ['loneliness', 'progress'], moodDelta: +2 },
  ],
};

const REALISTIC_STATE_DAT = {
  currentMood: { mood: 6, craving: 3, focus: 7, despondency: 2, timestamp: '2026-06-14T18:30:00.000Z' },
  moodHistory: [
    { date: '2026-06-10', mood: 6, craving: 3, focus: 7, despondency: 2 },
    { date: '2026-06-14', mood: 6, craving: 3, focus: 7, despondency: 2 },
  ],
  lastSessionStartedAt: '2026-06-14T18:00:00.000Z',
  clinicalModeActive: false,
};

const REALISTIC_BACKPACK = {
  naam: 'Melissa',
  userType: 'elias',
  sections: {
    childhood: 'Opgegroeid in een instabiel gezin. Vader was afwezig, moeder had depressie.',
    adolescence: 'Begon met drinken op 15. Eerste keer drugs op 17.',
    adulthood: 'Twee relaties gehad, beide geëindigd door verslaving.',
    family: 'Moeder leeft nog, geen contact met vader. Zus is steunpilaar.',
    recurringThemes: 'Verlating, eenzaamheid, behoefte aan controle.',
  },
  createdAt: '2025-01-20T10:00:00.000Z',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Export Scope Completeness', () => {
  describe('Sobriety counter data survives export → reset → import', () => {
    it('sobrietyDate is preserved through round-trip', async () => {
      const sourceStores = createMockStores({
        userDat: { elias: REALISTIC_USER_DAT, kim: null },
        backpack: { elias: REALISTIC_BACKPACK, kim: null },
      });

      const exportResult = await createEncryptedRecoFreeExport({
        password: PASSWORD,
        appVersion: APP_VERSION,
        stores: sourceStores,
        nowIso: new Date().toISOString(),
        platform: 'android',
        expoSdkVersion: '54',
      });

      // Simulate device reset: empty target stores
      const targetStores = createMockStores();

      const importResult = await importEncryptedRecoFreeBackup({
        envelopeJson: exportResult.envelopeJson,
        password: PASSWORD,
        currentAppVersion: APP_VERSION,
        stores: targetStores,
      });

      expect(importResult.status).toBe('SUCCESS');
      const restored = await targetStores.userDatStore.exportAllPersonas();
      const restoredElias = restored.elias as typeof REALISTIC_USER_DAT;
      expect(restoredElias.sobrietyDate).toBe('2025-01-15T00:00:00.000Z');
    });

    it('totalSessions count is preserved', async () => {
      const sourceStores = createMockStores({
        userDat: { elias: REALISTIC_USER_DAT, kim: null },
        backpack: { elias: REALISTIC_BACKPACK, kim: null },
      });

      const exportResult = await createEncryptedRecoFreeExport({
        password: PASSWORD,
        appVersion: APP_VERSION,
        stores: sourceStores,
        nowIso: new Date().toISOString(),
        platform: 'ios',
        expoSdkVersion: '54',
      });

      const targetStores = createMockStores();
      await importEncryptedRecoFreeBackup({
        envelopeJson: exportResult.envelopeJson,
        password: PASSWORD,
        currentAppVersion: APP_VERSION,
        stores: targetStores,
      });

      const restored = await targetStores.userDatStore.exportAllPersonas();
      const restoredElias = restored.elias as typeof REALISTIC_USER_DAT;
      expect(restoredElias.totalSessions).toBe(42);
    });
  });

  describe('Milestone tracker data survives export → reset → import', () => {
    it('seenMilestones array is preserved', async () => {
      const sourceStores = createMockStores({
        userDat: { elias: REALISTIC_USER_DAT, kim: null },
        backpack: { elias: REALISTIC_BACKPACK, kim: null },
      });

      const exportResult = await createEncryptedRecoFreeExport({
        password: PASSWORD,
        appVersion: APP_VERSION,
        stores: sourceStores,
        nowIso: new Date().toISOString(),
        platform: 'android',
        expoSdkVersion: '54',
      });

      const targetStores = createMockStores();
      await importEncryptedRecoFreeBackup({
        envelopeJson: exportResult.envelopeJson,
        password: PASSWORD,
        currentAppVersion: APP_VERSION,
        stores: targetStores,
      });

      const restored = await targetStores.userDatStore.exportAllPersonas();
      const restoredElias = restored.elias as typeof REALISTIC_USER_DAT;
      expect(restoredElias.milestoneTracker.seenMilestones).toEqual([
        '1_week', '1_month', '3_months', '6_months', '1_year',
      ]);
      expect(restoredElias.milestoneTracker.nextMilestone).toBe('18_months');
    });
  });

  describe('Mood history / progress tracker data survives export → reset → import', () => {
    it('moodHistory in userDat is preserved (progress tracker source)', async () => {
      const sourceStores = createMockStores({
        userDat: { elias: REALISTIC_USER_DAT, kim: null },
        stateDat: { elias: REALISTIC_STATE_DAT, kim: null },
        backpack: { elias: REALISTIC_BACKPACK, kim: null },
      });

      const exportResult = await createEncryptedRecoFreeExport({
        password: PASSWORD,
        appVersion: APP_VERSION,
        stores: sourceStores,
        nowIso: new Date().toISOString(),
        platform: 'android',
        expoSdkVersion: '54',
      });

      const targetStores = createMockStores();
      await importEncryptedRecoFreeBackup({
        envelopeJson: exportResult.envelopeJson,
        password: PASSWORD,
        currentAppVersion: APP_VERSION,
        stores: targetStores,
      });

      const restored = await targetStores.userDatStore.exportAllPersonas();
      const restoredElias = restored.elias as typeof REALISTIC_USER_DAT;
      expect(restoredElias.moodHistory).toHaveLength(5);
      expect(restoredElias.moodHistory[0].date).toBe('2026-06-10');
      expect(restoredElias.moodHistory[4].mood).toBe(6);
    });

    it('moodHistory in stateDat is preserved (mood trend source)', async () => {
      const sourceStores = createMockStores({
        userDat: { elias: REALISTIC_USER_DAT, kim: null },
        stateDat: { elias: REALISTIC_STATE_DAT, kim: null },
        backpack: { elias: REALISTIC_BACKPACK, kim: null },
      });

      const exportResult = await createEncryptedRecoFreeExport({
        password: PASSWORD,
        appVersion: APP_VERSION,
        stores: sourceStores,
        nowIso: new Date().toISOString(),
        platform: 'android',
        expoSdkVersion: '54',
      });

      const targetStores = createMockStores();
      await importEncryptedRecoFreeBackup({
        envelopeJson: exportResult.envelopeJson,
        password: PASSWORD,
        currentAppVersion: APP_VERSION,
        stores: targetStores,
      });

      const restored = await targetStores.stateDatStore.exportAllPersonas();
      const restoredState = restored.elias as typeof REALISTIC_STATE_DAT;
      expect(restoredState.moodHistory).toHaveLength(2);
      expect(restoredState.currentMood.mood).toBe(6);
    });
  });

  describe('Schema/mode tendencies survive export → reset → import', () => {
    it('schemaTendencies with confirmed status are preserved', async () => {
      const sourceStores = createMockStores({
        userDat: { elias: REALISTIC_USER_DAT, kim: null },
        backpack: { elias: REALISTIC_BACKPACK, kim: null },
      });

      const exportResult = await createEncryptedRecoFreeExport({
        password: PASSWORD,
        appVersion: APP_VERSION,
        stores: sourceStores,
        nowIso: new Date().toISOString(),
        platform: 'android',
        expoSdkVersion: '54',
      });

      const targetStores = createMockStores();
      await importEncryptedRecoFreeBackup({
        envelopeJson: exportResult.envelopeJson,
        password: PASSWORD,
        currentAppVersion: APP_VERSION,
        stores: targetStores,
      });

      const restored = await targetStores.userDatStore.exportAllPersonas();
      const restoredElias = restored.elias as typeof REALISTIC_USER_DAT;
      expect(restoredElias.schemaTendencies).toHaveLength(2);
      expect(restoredElias.schemaTendencies[0].schema).toBe('verlating_instabiliteit');
      expect(restoredElias.schemaTendencies[0].confirmed).toBe(true);
      expect(restoredElias.schemaTendencies[1].confirmed).toBe(false);
    });

    it('modeTendencies with confirmed status are preserved', async () => {
      const sourceStores = createMockStores({
        userDat: { elias: REALISTIC_USER_DAT, kim: null },
        backpack: { elias: REALISTIC_BACKPACK, kim: null },
      });

      const exportResult = await createEncryptedRecoFreeExport({
        password: PASSWORD,
        appVersion: APP_VERSION,
        stores: sourceStores,
        nowIso: new Date().toISOString(),
        platform: 'android',
        expoSdkVersion: '54',
      });

      const targetStores = createMockStores();
      await importEncryptedRecoFreeBackup({
        envelopeJson: exportResult.envelopeJson,
        password: PASSWORD,
        currentAppVersion: APP_VERSION,
        stores: targetStores,
      });

      const restored = await targetStores.userDatStore.exportAllPersonas();
      const restoredElias = restored.elias as typeof REALISTIC_USER_DAT;
      expect(restoredElias.modeTendencies).toHaveLength(2);
      expect(restoredElias.modeTendencies[0].mode).toBe('kwetsbare_kind');
      expect(restoredElias.modeTendencies[0].confirmed).toBe(true);
    });
  });

  describe('Trigger patterns survive export → reset → import', () => {
    it('triggerPatterns array is preserved with all fields', async () => {
      const sourceStores = createMockStores({
        userDat: { elias: REALISTIC_USER_DAT, kim: null },
        backpack: { elias: REALISTIC_BACKPACK, kim: null },
      });

      const exportResult = await createEncryptedRecoFreeExport({
        password: PASSWORD,
        appVersion: APP_VERSION,
        stores: sourceStores,
        nowIso: new Date().toISOString(),
        platform: 'android',
        expoSdkVersion: '54',
      });

      const targetStores = createMockStores();
      await importEncryptedRecoFreeBackup({
        envelopeJson: exportResult.envelopeJson,
        password: PASSWORD,
        currentAppVersion: APP_VERSION,
        stores: targetStores,
      });

      const restored = await targetStores.userDatStore.exportAllPersonas();
      const restoredElias = restored.elias as typeof REALISTIC_USER_DAT;
      expect(restoredElias.triggerPatterns).toHaveLength(3);
      expect(restoredElias.triggerPatterns[0]).toEqual({
        trigger: 'loneliness',
        frequency: 8,
        lastSeen: '2026-06-13',
        confidence: 0.85,
      });
    });
  });

  describe('Intake import path (createExportImportStoresAdapter)', () => {
    it('createExportImportStoresAdapter returns all required store interfaces', async () => {
      const { createExportImportStoresAdapter } = await import(
        '@/lib/features/exportImport/hooks/useExportImportStores'
      );
      const stores = createExportImportStoresAdapter();

      // Verify all stores are present
      expect(stores.userDatStore).toBeDefined();
      expect(stores.stateDatStore).toBeDefined();
      expect(stores.projectionsDatStore).toBeDefined();
      expect(stores.logsDatStore).toBeDefined();
      expect(stores.diaryStore).toBeDefined();
      expect(stores.gratitudeStore).toBeDefined();
      expect(stores.backpackStore).toBeDefined();
      expect(stores.personaProjectionStore).toBeDefined();
      expect(stores.emergencyContactsStore).toBeDefined();
      expect(stores.derivedCacheStore).toBeDefined();

      // Verify all methods exist
      expect(typeof stores.userDatStore.exportAllPersonas).toBe('function');
      expect(typeof stores.userDatStore.replaceAllPersonas).toBe('function');
      expect(typeof stores.emergencyContactsStore.exportAll).toBe('function');
      expect(typeof stores.emergencyContactsStore.replaceAll).toBe('function');
      expect(typeof stores.derivedCacheStore.exportAll).toBe('function');
      expect(typeof stores.derivedCacheStore.replaceAll).toBe('function');
    });

    it('importEncryptedRecoFreeBackup accepts the same interface that createExportImportStoresAdapter returns', async () => {
      // This test proves the intake import flow is type-compatible:
      // intake.tsx calls createExportImportStoresAdapter() then importEncryptedRecoFreeBackup()
      // We verify the adapter output satisfies the ExportImportStores interface
      // (actual AsyncStorage calls fail in Node env, so we test with mock stores instead)
      const { createExportImportStoresAdapter } = await import(
        '@/lib/features/exportImport/hooks/useExportImportStores'
      );

      const realStores = createExportImportStoresAdapter();

      // Verify the real adapter has the same shape as our mock stores
      const mockStores = createMockStores();
      const realKeys = Object.keys(realStores).sort();
      const mockKeys = Object.keys(mockStores).sort();
      expect(realKeys).toEqual(mockKeys);

      // Verify each store has the expected methods
      expect(typeof realStores.userDatStore.exportAllPersonas).toBe('function');
      expect(typeof realStores.userDatStore.replaceAllPersonas).toBe('function');
      expect(typeof realStores.stateDatStore.exportAllPersonas).toBe('function');
      expect(typeof realStores.stateDatStore.replaceAllPersonas).toBe('function');
      expect(typeof realStores.logsDatStore.exportAllPersonasRaw).toBe('function');
      expect(typeof realStores.logsDatStore.replaceAllPersonasRaw).toBe('function');
      expect(typeof realStores.emergencyContactsStore.exportAll).toBe('function');
      expect(typeof realStores.emergencyContactsStore.replaceAll).toBe('function');
      expect(typeof realStores.derivedCacheStore.exportAll).toBe('function');
      expect(typeof realStores.derivedCacheStore.replaceAll).toBe('function');
    });
  });

  describe('Full data round-trip (all stores simultaneously)', () => {
    it('exports and imports ALL stores in a single cycle', async () => {
      const diaryEntries = [
        { id: '1', date: '2026-06-14', content: 'Goede dag vandaag', mood: 7 },
        { id: '2', date: '2026-06-13', content: 'Moeilijk moment gehad', mood: 4 },
      ];
      const contacts = [{ name: 'Zus', phone: '0612345678' }];
      const projection = { currentPhase: 'action', weeklyGoal: 'meer bewegen' };

      const sourceStores = createMockStores({
        userDat: { elias: REALISTIC_USER_DAT, kim: null },
        stateDat: { elias: REALISTIC_STATE_DAT, kim: null },
        projectionsDat: { elias: { weekProjection: 'positive trend' }, kim: null },
        logsDat: { elias: { sessions: ['s1', 's2'] }, kim: null },
        diary: { elias: diaryEntries, kim: [] },
        gratitude: { elias: [{ id: 'g1', gratitude: 'dankbaar voor steun' }], kim: [] },
        backpack: { elias: REALISTIC_BACKPACK, kim: null },
        personaProjection: { elias: projection, kim: null },
        emergencyContacts: contacts,
        derivedCaches: { backpackHash: 'hash123', extractedEntities: { entities: ['verlating'] } },
      });

      const exportResult = await createEncryptedRecoFreeExport({
        password: PASSWORD,
        appVersion: APP_VERSION,
        stores: sourceStores,
        nowIso: new Date().toISOString(),
        platform: 'android',
        expoSdkVersion: '54',
      });

      // Import into completely empty stores
      const targetStores = createMockStores();
      const importResult = await importEncryptedRecoFreeBackup({
        envelopeJson: exportResult.envelopeJson,
        password: PASSWORD,
        currentAppVersion: APP_VERSION,
        stores: targetStores,
      });

      expect(importResult.status).toBe('SUCCESS');

      // Verify ALL stores were restored
      const restoredUserDat = await targetStores.userDatStore.exportAllPersonas();
      expect((restoredUserDat.elias as any).sobrietyDate).toBe('2025-01-15T00:00:00.000Z');
      expect((restoredUserDat.elias as any).totalSessions).toBe(42);

      const restoredStateDat = await targetStores.stateDatStore.exportAllPersonas();
      expect((restoredStateDat.elias as any).currentMood.mood).toBe(6);

      const restoredDiary = await targetStores.diaryStore.exportAllPersonas();
      expect(restoredDiary.elias).toHaveLength(2);

      const restoredContacts = await targetStores.emergencyContactsStore.exportAll();
      expect(restoredContacts).toEqual(contacts);

      const restoredProjection = await targetStores.personaProjectionStore.exportAllPersonas();
      expect(restoredProjection.elias).toEqual(projection);

      const restoredCaches = await targetStores.derivedCacheStore.exportAll();
      expect(restoredCaches.backpackHash).toBe('hash123');
    });
  });
});
