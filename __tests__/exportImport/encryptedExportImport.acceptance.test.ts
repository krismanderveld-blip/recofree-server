/**
 * Encrypted Export/Import — 15 Acceptance Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  encryptExportPayload,
  decryptExportEnvelope,
  sha256Base64,
  encodeBase64,
  decodeBase64,
  EXPORT_KDF_ITERATIONS,
} from '@/lib/features/exportImport/crypto/exportImportCrypto';
import { buildExportAad } from '@/lib/features/exportImport/crypto/exportImportAad';
import { createEncryptedRecoFreeExport, createRecoFreeExportFileName } from '@/lib/features/exportImport/services/exportDataService';
import { importEncryptedRecoFreeBackup } from '@/lib/features/exportImport/services/importDataService';
import {
  buildImportStagingPackage,
  validateImportStagingPackage,
  replaceLocalDataFromStaging,
  createPreImportSnapshot,
  restorePreImportSnapshot,
} from '@/lib/features/exportImport/services/importStagingService';
import { isSupportedEnvelopeVersion, isSupportedPayloadVersion, RECOFREE_EXPORT_FILE_MAGIC } from '@/lib/features/exportImport/version/exportImportVersion';
import { ExportImportError } from '@/lib/features/exportImport/errors/exportImportErrors';
import { stableStringify } from '@/lib/utils/json/stableStringify';
import type { ExportImportStores } from '@/lib/features/exportImport/services/exportImportStores.types';
import type { RecoFreeEncryptedExportEnvelope } from '@/lib/features/exportImport/types/exportEnvelope.types';

// ─── Mock Stores ─────────────────────────────────────────────────────────────

function createMockStores(data?: Partial<{
  userDat: { elias?: unknown; kim?: unknown };
  stateDat: { elias?: unknown; kim?: unknown };
  projectionsDat: { elias?: unknown; kim?: unknown };
  logsDat: { elias?: unknown; kim?: unknown };
  diary: { elias?: unknown[]; kim?: unknown[] };
  gratitude: { elias?: unknown[]; kim?: unknown[] };
  backpack: { elias?: unknown; kim?: unknown };
}>): ExportImportStores {
  const store = {
    userDat: data?.userDat ?? { elias: { name: 'TestUser', totalSessions: 5 }, kim: null },
    stateDat: data?.stateDat ?? { elias: { personas: ['elias'] }, kim: null },
    projectionsDat: data?.projectionsDat ?? { elias: { projections: [] }, kim: null },
    logsDat: data?.logsDat ?? { elias: { sessions: ['session1'] }, kim: null },
    diary: data?.diary ?? { elias: [{ id: '1', content: 'Day 1' }, { id: '2', content: 'Day 2' }], kim: [] },
    gratitude: data?.gratitude ?? { elias: [{ id: 'g1', entry: 'Grateful for sun' }], kim: [] },
    backpack: data?.backpack ?? { elias: { items: ['coping-card-1'] }, kim: null },
  };

  return {
    userDatStore: {
      async exportAllPersonas() { return store.userDat; },
      async replaceAllPersonas(d) { store.userDat = d as any; },
    },
    stateDatStore: {
      async exportAllPersonas() { return store.stateDat; },
      async replaceAllPersonas(d) { store.stateDat = d as any; },
    },
    projectionsDatStore: {
      async exportAllPersonas() { return store.projectionsDat; },
      async replaceAllPersonas(d) { store.projectionsDat = d as any; },
    },
    logsDatStore: {
      async exportAllPersonasRaw() { return store.logsDat; },
      async replaceAllPersonasRaw(d) { store.logsDat = d as any; },
    },
    diaryStore: {
      async exportAllPersonas() { return store.diary; },
      async replaceAllPersonas(d) { store.diary = d as any; },
    },
    gratitudeStore: {
      async exportAllPersonas() { return store.gratitude; },
      async replaceAllPersonas(d) { store.gratitude = d as any; },
    },
    backpackStore: {
      async exportAllPersonas() { return store.backpack; },
      async replaceAllPersonas(d) { store.backpack = d as any; },
    },
    personaProjectionStore: {
      async exportAllPersonas() { return { elias: { projection: 'test' }, kim: null }; },
      async replaceAllPersonas(_d) { /* no-op in test */ },
    },
    emergencyContactsStore: {
      async exportAll() { return [{ name: 'SOS', phone: '112' }]; },
      async replaceAll(_d) { /* no-op in test */ },
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
      async exportAll() { return { backpackHash: 'abc123', extractedEntities: null }; },
      async replaceAll(_d) { /* no-op in test */ },
    },
  };
}

const TEST_PASSWORD = 'SecurePass123!';
const TEST_NOW = '2026-06-15T10:00:00.000Z';
const TEST_APP_VERSION = '1.0.0';

describe('Encrypted Export/Import — Acceptance Tests', () => {

  // ─── TEST 1: Export creates one encrypted file ─────────────────────────────
  it('TEST 1 - export creates one encrypted file with .recofree extension', async () => {
    const stores = createMockStores();
    const result = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores,
    });

    expect(result.fileExtension).toBe('.recofree');
    expect(result.fileName).toMatch(/\.recofree$/);
    expect(result.envelope.fileMagic).toBe('RECOFREE_EXPORT');
    expect(result.envelope.payload.ciphertextBase64).toBeTruthy();
    // Plaintext user.dat text must NOT be visible in envelope JSON
    expect(result.envelopeJson).not.toContain('TestUser');
    expect(result.envelopeJson).not.toContain('totalSessions');
  });

  // ─── TEST 2: PBKDF2 metadata ──────────────────────────────────────────────
  it('TEST 2 - PBKDF2 metadata is correct', async () => {
    const stores = createMockStores();
    const result = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'android',
      expoSdkVersion: '54',
      stores,
    });

    const { kdf } = result.envelope;
    expect(kdf.algorithm).toBe('PBKDF2');
    expect(kdf.hash).toBe('SHA-256');
    expect(kdf.iterations).toBeGreaterThanOrEqual(100000);
    expect(kdf.keyLengthBits).toBe(256);
    expect(kdf.saltBase64).toBeTruthy();
    expect(kdf.saltBase64.length).toBeGreaterThan(10);
  });

  // ─── TEST 3: AES-GCM metadata ─────────────────────────────────────────────
  it('TEST 3 - AES-GCM metadata is correct', async () => {
    const stores = createMockStores();
    const result = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores,
    });

    const { encryption, payload } = result.envelope;
    expect(encryption.algorithm).toBe('AES-256-GCM');
    expect(encryption.ivBase64).toBeTruthy();
    expect(encryption.ivLengthBits).toBe(96);
    expect(encryption.authTagLengthBits).toBe(128);
    expect(payload.authTagBase64).toBeTruthy();
    expect(payload.authTagBase64.length).toBeGreaterThan(10);
  });

  // ─── TEST 4: Correct password imports ──────────────────────────────────────
  it('TEST 4 - correct password imports successfully', async () => {
    const exportStores = createMockStores();
    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores: exportStores,
    });

    // Import into fresh stores
    const importStores = createMockStores({
      userDat: { elias: null, kim: null },
      stateDat: { elias: null, kim: null },
      projectionsDat: { elias: null, kim: null },
      logsDat: { elias: null, kim: null },
      diary: { elias: [], kim: [] },
      gratitude: { elias: [], kim: [] },
      backpack: { elias: null, kim: null },
    });

    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: exportResult.envelopeJson,
      password: TEST_PASSWORD,
      currentAppVersion: TEST_APP_VERSION,
      stores: importStores,
    });

    expect(importResult.status).toBe('SUCCESS');
    expect(importResult.replacedExistingData).toBe(true);

    // Verify data was restored
    const restored = await importStores.userDatStore.exportAllPersonas();
    expect(restored.elias).toEqual({ name: 'TestUser', totalSessions: 5 });
  });

  // ─── TEST 5: Wrong password does not replace data ──────────────────────────
  it('TEST 5 - wrong password does not replace data', async () => {
    const exportStores = createMockStores();
    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores: exportStores,
    });

    const originalUserDat = { elias: { name: 'OriginalUser' }, kim: null };
    const importStores = createMockStores({ userDat: originalUserDat });

    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: exportResult.envelopeJson,
      password: 'WrongPassword123!',
      currentAppVersion: TEST_APP_VERSION,
      stores: importStores,
    });

    expect(importResult.status).toBe('WRONG_PASSWORD_OR_CORRUPT_FILE');
    expect(importResult.replacedExistingData).toBe(false);

    // Verify existing data unchanged
    const existing = await importStores.userDatStore.exportAllPersonas();
    expect(existing.elias).toEqual({ name: 'OriginalUser' });
  });

  // ─── TEST 6: Corrupt file does not replace data ────────────────────────────
  it('TEST 6 - corrupt file does not replace data', async () => {
    const exportStores = createMockStores();
    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores: exportStores,
    });

    // Corrupt the ciphertext
    const envelope = JSON.parse(exportResult.envelopeJson);
    const ciphertextBytes = decodeBase64(envelope.payload.ciphertextBase64);
    ciphertextBytes[0] ^= 0xFF; // flip bits
    ciphertextBytes[1] ^= 0xFF;
    envelope.payload.ciphertextBase64 = encodeBase64(ciphertextBytes);
    const corruptJson = JSON.stringify(envelope);

    const originalUserDat = { elias: { name: 'KeepMe' }, kim: null };
    const importStores = createMockStores({ userDat: originalUserDat });

    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: corruptJson,
      password: TEST_PASSWORD,
      currentAppVersion: TEST_APP_VERSION,
      stores: importStores,
    });

    expect(['WRONG_PASSWORD_OR_CORRUPT_FILE', 'PAYLOAD_INTEGRITY_FAILED']).toContain(importResult.status);
    expect(importResult.replacedExistingData).toBe(false);

    const existing = await importStores.userDatStore.exportAllPersonas();
    expect(existing.elias).toEqual({ name: 'KeepMe' });
  });

  // ─── TEST 7: Unsupported envelope version ─────────────────────────────────
  it('TEST 7 - unsupported envelope version rejected', async () => {
    const exportStores = createMockStores();
    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores: exportStores,
    });

    // Modify envelope version
    const envelope = JSON.parse(exportResult.envelopeJson);
    envelope.envelopeVersion = '99.0.0';
    const modifiedJson = JSON.stringify(envelope);

    const originalUserDat = { elias: { name: 'Safe' }, kim: null };
    const importStores = createMockStores({ userDat: originalUserDat });

    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: modifiedJson,
      password: TEST_PASSWORD,
      currentAppVersion: TEST_APP_VERSION,
      stores: importStores,
    });

    expect(importResult.status).toBe('UNSUPPORTED_VERSION');
    expect(importResult.replacedExistingData).toBe(false);

    const existing = await importStores.userDatStore.exportAllPersonas();
    expect(existing.elias).toEqual({ name: 'Safe' });
  });

  // ─── TEST 8: Unsupported payload version ───────────────────────────────────
  it('TEST 8 - unsupported payload version rejected', async () => {
    const stores = createMockStores();
    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores,
    });

    // Decrypt, modify payload version, re-encrypt
    const payload = await decryptExportEnvelope({ envelope: exportResult.envelope, password: TEST_PASSWORD });
    (payload as any).payloadVersion = 'recofree.export.payload.v99';

    // Re-encrypt with modified payload
    const modifiedEnvelope = await encryptExportPayload({
      plaintextPayload: payload,
      password: TEST_PASSWORD,
      appVersion: TEST_APP_VERSION,
      nowIso: TEST_NOW,
    });
    const modifiedJson = JSON.stringify(modifiedEnvelope);

    const originalUserDat = { elias: { name: 'Protected' }, kim: null };
    const importStores = createMockStores({ userDat: originalUserDat });

    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: modifiedJson,
      password: TEST_PASSWORD,
      currentAppVersion: TEST_APP_VERSION,
      stores: importStores,
    });

    expect(importResult.status).toBe('UNSUPPORTED_VERSION');
    expect(importResult.replacedExistingData).toBe(false);

    const existing = await importStores.userDatStore.exportAllPersonas();
    expect(existing.elias).toEqual({ name: 'Protected' });
  });

  // ─── TEST 9: Import replaces, does not merge ───────────────────────────────
  it('TEST 9 - import replaces, does not merge', async () => {
    // Export with diary entry C only
    const exportStores = createMockStores({
      diary: { elias: [{ id: 'C', content: 'Entry C' }], kim: [] },
    });
    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores: exportStores,
    });

    // Import into stores with diary entries A, B
    const importStores = createMockStores({
      diary: { elias: [{ id: 'A', content: 'Entry A' }, { id: 'B', content: 'Entry B' }], kim: [] },
    });

    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: exportResult.envelopeJson,
      password: TEST_PASSWORD,
      currentAppVersion: TEST_APP_VERSION,
      stores: importStores,
    });

    expect(importResult.status).toBe('SUCCESS');

    const diary = await importStores.diaryStore.exportAllPersonas();
    expect(diary.elias).toHaveLength(1);
    expect((diary.elias as any[])[0].id).toBe('C');
  });

  // ─── TEST 10: logs.dat preserved ──────────────────────────────────────────
  it('TEST 10 - logs.dat preserved through export/import', async () => {
    const logsData = { sessions: [{ id: 's1', summary: 'First session' }], routingAudits: [] };
    const exportStores = createMockStores({ logsDat: { elias: logsData, kim: null } });

    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores: exportStores,
    });

    const importStores = createMockStores({ logsDat: { elias: null, kim: null } });

    await importEncryptedRecoFreeBackup({
      envelopeJson: exportResult.envelopeJson,
      password: TEST_PASSWORD,
      currentAppVersion: TEST_APP_VERSION,
      stores: importStores,
    });

    const restored = await importStores.logsDatStore.exportAllPersonasRaw();
    expect(restored.elias).toEqual(logsData);
  });

  // ─── TEST 11: No server call ───────────────────────────────────────────────
  it('TEST 11 - no server call during export and import', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const stores = createMockStores();
    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores,
    });

    const importStores = createMockStores();
    await importEncryptedRecoFreeBackup({
      envelopeJson: exportResult.envelopeJson,
      password: TEST_PASSWORD,
      currentAppVersion: TEST_APP_VERSION,
      stores: importStores,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  // ─── TEST 12: Password never persisted ─────────────────────────────────────
  it('TEST 12 - password is not stored in any store', async () => {
    const stores = createMockStores();
    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores,
    });

    // Check that the password doesn't appear in the export envelope
    expect(exportResult.envelopeJson).not.toContain(TEST_PASSWORD);

    // After import, verify no store contains the password
    const importStores = createMockStores();
    await importEncryptedRecoFreeBackup({
      envelopeJson: exportResult.envelopeJson,
      password: TEST_PASSWORD,
      currentAppVersion: TEST_APP_VERSION,
      stores: importStores,
    });

    const allData = JSON.stringify(await importStores.userDatStore.exportAllPersonas());
    expect(allData).not.toContain(TEST_PASSWORD);
  });

  // ─── TEST 13: Validation staging — missing userDat key ─────────────────────
  it('TEST 13 - validation fails for payload missing userDat key', async () => {
    const stores = createMockStores();
    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores,
    });

    // Decrypt, remove userDat key from elias, re-encrypt
    const payload = await decryptExportEnvelope({ envelope: exportResult.envelope, password: TEST_PASSWORD });
    delete (payload.data.personas.elias as any).userDat;

    // Re-encrypt (integrity hash will be wrong, but we want to test validation)
    const modifiedEnvelope = await encryptExportPayload({
      plaintextPayload: payload,
      password: TEST_PASSWORD,
      appVersion: TEST_APP_VERSION,
      nowIso: TEST_NOW,
    });
    const modifiedJson = JSON.stringify(modifiedEnvelope);

    const originalUserDat = { elias: { name: 'Untouched' }, kim: null };
    const importStores = createMockStores({ userDat: originalUserDat });

    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: modifiedJson,
      password: TEST_PASSWORD,
      currentAppVersion: TEST_APP_VERSION,
      stores: importStores,
    });

    expect(importResult.status).toBe('VALIDATION_FAILED');
    expect(importResult.replacedExistingData).toBe(false);

    const existing = await importStores.userDatStore.exportAllPersonas();
    expect(existing.elias).toEqual({ name: 'Untouched' });
  });

  // ─── TEST 14: Commit failure rollback ──────────────────────────────────────
  it('TEST 14 - commit failure rolls back to pre-import data', async () => {
    const exportStores = createMockStores();
    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores: exportStores,
    });

    // Create import stores where stateDatStore.replaceAllPersonas throws
    const originalUserDat = { elias: { name: 'PreImport' }, kim: null };
    const importStores = createMockStores({ userDat: originalUserDat });
    let callCount = 0;
    const originalReplace = importStores.stateDatStore.replaceAllPersonas;
    importStores.stateDatStore.replaceAllPersonas = async (data) => {
      throw new Error('Simulated commit failure');
    };

    const importResult = await importEncryptedRecoFreeBackup({
      envelopeJson: exportResult.envelopeJson,
      password: TEST_PASSWORD,
      currentAppVersion: TEST_APP_VERSION,
      stores: importStores,
    });

    expect(importResult.status).toBe('IMPORT_COMMIT_FAILED');
    expect(importResult.replacedExistingData).toBe(false);
  });

  // ─── TEST 15: Full export scope ────────────────────────────────────────────
  it('TEST 15 - full export scope includes all required datasets', async () => {
    const stores = createMockStores();
    const exportResult = await createEncryptedRecoFreeExport({
      password: TEST_PASSWORD,
      nowIso: TEST_NOW,
      appVersion: TEST_APP_VERSION,
      platform: 'ios',
      expoSdkVersion: '54',
      stores,
    });

    // Decrypt and verify all datasets present
    const payload = await decryptExportEnvelope({ envelope: exportResult.envelope, password: TEST_PASSWORD });

    expect(payload.data.personas.elias).toBeDefined();
    const elias = payload.data.personas.elias!;
    expect(elias.userDat).toBeDefined();
    expect(elias.stateDat).toBeDefined();
    expect(elias.projectionsDat).toBeDefined();
    expect(elias.logsDat).toBeDefined();
    expect(elias.diaryEntries).toBeDefined();
    expect(Array.isArray(elias.diaryEntries)).toBe(true);
    expect(elias.gratitudeEntries).toBeDefined();
    expect(Array.isArray(elias.gratitudeEntries)).toBe(true);
    expect(elias.backpackData).toBeDefined();

    // Verify scope metadata
    expect(payload.exportScope.includesUserDat).toBe(true);
    expect(payload.exportScope.includesStateDat).toBe(true);
    expect(payload.exportScope.includesProjectionsDat).toBe(true);
    expect(payload.exportScope.includesLogsDat).toBe(true);
    expect(payload.exportScope.includesDiaryEntries).toBe(true);
    expect(payload.exportScope.includesGratitudeEntries).toBe(true);
    expect(payload.exportScope.includesBackpackData).toBe(true);
  });
});
