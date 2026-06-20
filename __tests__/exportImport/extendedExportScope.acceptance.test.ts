/**
 * Extended Export Scope + Intake Import — Acceptance Tests
 *
 * Tests verify:
 * 1. Persona projections are included in export
 * 2. Emergency contacts are included in export
 * 3. Derived caches are included in export
 * 4. Export → import round-trip preserves persona projections
 * 5. Export → import round-trip preserves emergency contacts
 * 6. Export → import round-trip preserves derived caches
 * 7. createExportImportStoresAdapter works outside React hooks
 * 8. Import with wrong password does NOT replace data (including new stores)
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
  derivedCaches?: { backpackHash: unknown; extractedEntities: unknown; vspProfile?: unknown; vspHash?: unknown };
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
  let derivedCaches = initial?.derivedCaches ?? { backpackHash: null, extractedEntities: null, vspProfile: null, vspHash: null };

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
    derivedCacheStore: {
      async exportAll() { return derivedCaches; },
      async replaceAll(data) { derivedCaches = data as any; },
    },
  };
}

const TEST_PASSWORD = 'TestWachtwoord123!';
const APP_VERSION = '1.0.0';

describe('Extended Export Scope', () => {
  it('1. Export includes persona projections in export', async () => {
    const stores = createMockStores({
      personaProjection: {
        elias: { currentPhase: 'maintenance', confidence: 0.9 },
        kim: null,
      },
      userDat: { elias: { totalSessions: 1 }, kim: null },
      backpack: { elias: { naam: 'Test', userType: 'elias' }, kim: null },
    });

    const result = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      appVersion: APP_VERSION,
      stores,
      nowIso: new Date().toISOString(),
      platform: 'android',
      expoSdkVersion: '54',
    });

    expect(result.envelopeJson).toBeTruthy();
    // Verify by round-trip: import and check personaProjection is present
    const targetStores = createMockStores();
    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: result.envelopeJson,
      password: TEST_PASSWORD,
      currentAppVersion: APP_VERSION,
      stores: targetStores,
    });
    expect(importResult.status).toBe('SUCCESS');
    const proj = await targetStores.personaProjectionStore.exportAllPersonas();
    expect(proj.elias).toEqual({ currentPhase: 'maintenance', confidence: 0.9 });
  });

  it('2. Export includes emergency contacts in export', async () => {
    const contacts = [
      { name: 'Jan', phone: '0612345678' },
      { name: 'Piet', phone: '0687654321' },
    ];
    const stores = createMockStores({
      emergencyContacts: contacts,
      userDat: { elias: { totalSessions: 1 }, kim: null },
      backpack: { elias: { naam: 'Test', userType: 'elias' }, kim: null },
    });

    const result = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      appVersion: APP_VERSION,
      stores,
      nowIso: new Date().toISOString(),
      platform: 'android',
      expoSdkVersion: '54',
    });

    expect(result.envelopeJson).toBeTruthy();
    const targetStores = createMockStores();
    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: result.envelopeJson,
      password: TEST_PASSWORD,
      currentAppVersion: APP_VERSION,
      stores: targetStores,
    });
    expect(importResult.status).toBe('SUCCESS');
    const imported = await targetStores.emergencyContactsStore.exportAll();
    expect(imported).toEqual(contacts);
  });

  it('3. Export includes derived caches in export', async () => {
    const caches = {
      backpackHash: 'abc123hash',
      extractedEntities: { entities: ['fear_of_abandonment'] },
      vspProfile: null,
      vspHash: null,
    };
    const stores = createMockStores({
      derivedCaches: caches,
      userDat: { elias: { totalSessions: 1 }, kim: null },
      backpack: { elias: { naam: 'Test', userType: 'elias' }, kim: null },
    });

    const result = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      appVersion: APP_VERSION,
      stores,
      nowIso: new Date().toISOString(),
      platform: 'android',
      expoSdkVersion: '54',
    });

    expect(result.envelopeJson).toBeTruthy();
    const targetStores = createMockStores();
    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: result.envelopeJson,
      password: TEST_PASSWORD,
      currentAppVersion: APP_VERSION,
      stores: targetStores,
    });
    expect(importResult.status).toBe('SUCCESS');
    const imported = await targetStores.derivedCacheStore.exportAll();
    expect(imported).toEqual(caches);
  });

  it('4. Export → import round-trip preserves persona projections', async () => {
    const projData = { currentPhase: 'action', confidence: 0.75, milestones: [1, 2, 3] };
    const sourceStores = createMockStores({
      personaProjection: { elias: projData, kim: null },
      userDat: { elias: { totalSessions: 5 }, kim: null },
      backpack: { elias: { naam: 'Test', userType: 'elias' }, kim: null },
    });

    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      appVersion: APP_VERSION,
      stores: sourceStores,
    });

    const targetStores = createMockStores();
    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: exportResult.envelopeJson!,
      password: TEST_PASSWORD,
      currentAppVersion: APP_VERSION,
      stores: targetStores,
    });

    expect(importResult.status).toBe('SUCCESS');
    const exported = await targetStores.personaProjectionStore.exportAllPersonas();
    expect(exported.elias).toEqual(projData);
  });

  it('5. Export → import round-trip preserves emergency contacts', async () => {
    const contacts = [
      { name: 'Jan', phone: '0612345678', relation: 'friend' },
      { name: 'SOS', phone: '112', relation: 'emergency' },
    ];
    const sourceStores = createMockStores({
      emergencyContacts: contacts,
      userDat: { elias: { totalSessions: 1 }, kim: null },
      backpack: { elias: { naam: 'Test', userType: 'elias' }, kim: null },
    });

    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      appVersion: APP_VERSION,
      stores: sourceStores,
    });

    const targetStores = createMockStores();
    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: exportResult.envelopeJson!,
      password: TEST_PASSWORD,
      currentAppVersion: APP_VERSION,
      stores: targetStores,
    });

    expect(importResult.status).toBe('SUCCESS');
    const exported = await targetStores.emergencyContactsStore.exportAll();
    expect(exported).toEqual(contacts);
  });

  it('6. Export → import round-trip preserves derived caches', async () => {
    const caches = {
      backpackHash: 'sha256_abc123',
      extractedEntities: { entities: ['verlating', 'controle'], lastUpdated: '2026-06-15' },
      vspProfile: null,
      vspHash: null,
    };
    const sourceStores = createMockStores({
      derivedCaches: caches,
      userDat: { elias: { totalSessions: 1 }, kim: null },
      backpack: { elias: { naam: 'Test', userType: 'elias' }, kim: null },
    });

    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      appVersion: APP_VERSION,
      stores: sourceStores,
    });

    const targetStores = createMockStores();
    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: exportResult.envelopeJson!,
      password: TEST_PASSWORD,
      currentAppVersion: APP_VERSION,
      stores: targetStores,
    });

    expect(importResult.status).toBe('SUCCESS');
    const exported = await targetStores.derivedCacheStore.exportAll();
    expect(exported).toEqual(caches);
  });

  it('7. createExportImportStoresAdapter is a plain function (not a hook)', async () => {
    // This test verifies the adapter can be imported and called outside React
    const { createExportImportStoresAdapter } = await import(
      '@/lib/features/exportImport/hooks/useExportImportStores'
    );
    expect(typeof createExportImportStoresAdapter).toBe('function');
    const stores = createExportImportStoresAdapter();
    expect(stores).toHaveProperty('userDatStore');
    expect(stores).toHaveProperty('personaProjectionStore');
    expect(stores).toHaveProperty('emergencyContactsStore');
    expect(stores).toHaveProperty('derivedCacheStore');
  });

  it('8. Wrong password does NOT replace data (including new stores)', async () => {
    const originalContacts = [{ name: 'Original', phone: '000' }];
    const originalProjection = { phase: 'original' };

    const sourceStores = createMockStores({
      emergencyContacts: [{ name: 'Source', phone: '111' }],
      personaProjection: { elias: { phase: 'source' }, kim: null },
      userDat: { elias: { totalSessions: 10 }, kim: null },
      backpack: { elias: { naam: 'Source', userType: 'elias' }, kim: null },
    });

    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      appVersion: APP_VERSION,
      stores: sourceStores,
    });

    const targetStores = createMockStores({
      emergencyContacts: originalContacts,
      personaProjection: { elias: originalProjection, kim: null },
      userDat: { elias: { totalSessions: 1 }, kim: null },
      backpack: { elias: { naam: 'Target', userType: 'elias' }, kim: null },
    });

    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: exportResult.envelopeJson!,
      password: 'WRONG_PASSWORD',
      currentAppVersion: APP_VERSION,
      stores: targetStores,
    });

    expect(importResult.status).toBe('WRONG_PASSWORD_OR_CORRUPT_FILE');

    // Verify data was NOT replaced
    const contacts = await targetStores.emergencyContactsStore.exportAll();
    expect(contacts).toEqual(originalContacts);
    const projection = await targetStores.personaProjectionStore.exportAllPersonas();
    expect(projection.elias).toEqual(originalProjection);
  });
});
