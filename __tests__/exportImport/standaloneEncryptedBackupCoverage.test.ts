import { describe, expect, it } from 'vitest';
import { createEncryptedRecoFreeExport } from '@/lib/features/exportImport/services/exportDataService';
import { importEncryptedRecoFreeBackup } from '@/lib/features/exportImport/services/importDataService';
import { replaceLocalDataFromStaging } from '@/lib/features/exportImport/services/importStagingService';
import type { ExportImportStores } from '@/lib/features/exportImport/services/exportImportStores.types';
import type { RecoFreeExportPlaintextPayload } from '@/lib/features/exportImport/types/exportPayload.types';

type PersonaPair = { elias: unknown | null; kim: unknown | null };

function createStores(initial?: {
  backpack?: PersonaPair;
  vspInsight?: PersonaPair;
  eigenRegieAuxiliary?: {
    legacyPlan: unknown | null;
    notificationSettings: unknown | null;
    lastCheckAt: string | null;
  };
}): ExportImportStores {
  let backpack = initial?.backpack ?? { elias: null, kim: null };
  let vspInsight = initial?.vspInsight ?? { elias: null, kim: null };
  let eigenRegieAuxiliary = initial?.eigenRegieAuxiliary ?? {
    legacyPlan: null,
    notificationSettings: null,
    lastCheckAt: null,
  };
  let userDat: PersonaPair = {
    elias: backpack.elias ? { persona: 'elias' } : null,
    kim: backpack.kim ? { persona: 'kim' } : null,
  };

  return {
    userDatStore: {
      async exportAllPersonas() { return userDat; },
      async replaceAllPersonas(data) { userDat = { elias: data.elias ?? null, kim: data.kim ?? null }; },
    },
    stateDatStore: {
      async exportAllPersonas() { return { elias: null, kim: null }; },
      async replaceAllPersonas() {},
    },
    projectionsDatStore: {
      async exportAllPersonas() { return { elias: null, kim: null }; },
      async replaceAllPersonas() {},
    },
    logsDatStore: {
      async exportAllPersonasRaw() { return { elias: null, kim: null }; },
      async replaceAllPersonasRaw() {},
    },
    diaryStore: {
      async exportAllPersonas() { return { elias: [], kim: [] }; },
      async replaceAllPersonas() {},
    },
    gratitudeStore: {
      async exportAllPersonas() { return { elias: [], kim: [] }; },
      async replaceAllPersonas() {},
    },
    backpackStore: {
      async exportAllPersonas() { return backpack; },
      async replaceAllPersonas(data) { backpack = { elias: data.elias ?? null, kim: data.kim ?? null }; },
    },
    personaProjectionStore: {
      async exportAllPersonas() { return { elias: null, kim: null }; },
      async replaceAllPersonas() {},
    },
    emergencyContactsStore: {
      async exportAll() { return []; },
      async replaceAll() {},
    },
    derivedCacheStore: {
      async exportAll() { return { backpackHash: null, extractedEntities: null, vspProfile: null, vspHash: null }; },
      async replaceAll() {},
    },
    dayStructureStore: {
      async exportAll() { return { document: null, completion: null, bellState: null, streaksEnabled: null }; },
      async replaceAll() {},
    },
    appPreferencesStore: {
      async exportAll() { return { language: null, country: null }; },
      async replaceAll() {},
    },
    vspInsightStore: {
      async exportAllPersonas() { return vspInsight; },
      async replaceAllPersonas(data) { vspInsight = { elias: data.elias ?? null, kim: data.kim ?? null }; },
    },
    eigenRegieAuxiliaryStore: {
      async exportAll() { return eigenRegieAuxiliary; },
      async replaceAll(data) {
        eigenRegieAuxiliary = {
          legacyPlan: data.legacyPlan ?? null,
          notificationSettings: data.notificationSettings ?? null,
          lastCheckAt: data.lastCheckAt ?? null,
        };
      },
    },
  };
}

describe('standalone encrypted backup coverage', () => {
  it('round-trips Kim KERP in Backpack, VSP Insight and reminder state', async () => {
    const kerp = {
      version: 1,
      persona: 'kim',
      mainAnchorSentence: 'Ik bewaak mijn regie en houd verbinding mogelijk.',
      zones: { green: { signals: ['rust'], whatHelps: ['pauze'] } },
    };
    const vsp = {
      profile: { persona: 'kim', selfReportedEarlySigns: ['spanning'] },
      discrepancyEvents: [{ eventId: 'd1' }],
      phaseTransitions: [{ exampleId: 't1' }],
      soothingEffects: [{ recordId: 's1' }],
      lastSoothingChoice: { choiceId: 'c1' },
    };
    const auxiliary = {
      legacyPlan: kerp,
      notificationSettings: { enabled: true, hour: 20, minute: 0, inactiveDaysThreshold: 3 },
      lastCheckAt: '2026-08-27T18:00:00.000Z',
    };
    const source = createStores({
      backpack: { elias: null, kim: { userType: 'kim', eigenRegiePlan: kerp } },
      vspInsight: { elias: null, kim: vsp },
      eigenRegieAuxiliary: auxiliary,
    });
    const target = createStores();

    const exported = await createEncryptedRecoFreeExport({
      password: 'standalone-test-password',
      nowIso: '2026-08-27T18:30:00.000Z',
      appVersion: '1.2.99',
      platform: 'android',
      expoSdkVersion: '54',
      stores: source,
    });
    expect(exported.envelopeJson).not.toContain(kerp.mainAnchorSentence);

    const imported = await importEncryptedRecoFreeBackup({
      envelopeJson: exported.envelopeJson,
      password: 'standalone-test-password',
      currentAppVersion: '1.2.99',
      stores: target,
    });

    expect(imported.status).toBe('SUCCESS');
    expect((await target.backpackStore.exportAllPersonas()).kim).toEqual({ userType: 'kim', eigenRegiePlan: kerp });
    expect((await target.vspInsightStore!.exportAllPersonas()).kim).toEqual(vsp);
    expect(await target.eigenRegieAuxiliaryStore!.exportAll()).toEqual(auxiliary);
  });

  it('preserves current VSP/reminder data when an older payload omits the optional fields', async () => {
    const preservedVsp = { elias: { profile: { persona: 'elias' } }, kim: null };
    const preservedAuxiliary = {
      legacyPlan: { persona: 'kim', version: 1 },
      notificationSettings: { enabled: true },
      lastCheckAt: '2026-08-27T18:00:00.000Z',
    };
    const target = createStores({ vspInsight: preservedVsp, eigenRegieAuxiliary: preservedAuxiliary });
    const stagingPayload = {
      payloadVersion: 'recofree.export.payload.v1',
      createdAt: '2026-08-01T00:00:00.000Z',
      appVersion: '1.2.80',
      sourceDevice: { platform: 'android', expoSdkVersion: '54' },
      exportScope: {
        includesUserDat: true,
        includesStateDat: true,
        includesProjectionsDat: true,
        includesLogsDat: true,
        includesDiaryEntries: true,
        includesGratitudeEntries: true,
        includesBackpackData: true,
        includesEliasPersona: true,
        includesKimPersona: false,
        includesPersonaProjections: true,
        includesEmergencyContacts: true,
        includesDerivedCaches: true,
        includesDayStructure: false,
        includesAppPreferences: false,
      },
      data: {
        personas: {
          elias: {
            persona: 'elias', userDat: {}, stateDat: null, projectionsDat: null, logsDat: null,
            diaryEntries: [], gratitudeEntries: [], backpackData: null, personaProjection: null,
          },
        },
        shared: {
          emergencyContacts: [],
          derivedCaches: { backpackHash: null, extractedEntities: null, vspProfile: null, vspHash: null },
        },
      },
      integrity: { plaintextSha256Base64: '', datasetCounts: {} },
    } satisfies RecoFreeExportPlaintextPayload;

    await replaceLocalDataFromStaging({
      stagingPackage: {
        payloadVersion: stagingPayload.payloadVersion,
        personas: stagingPayload.data.personas,
        shared: stagingPayload.data.shared,
        integrity: stagingPayload.integrity,
      },
      stores: target,
    });

    expect(await target.vspInsightStore!.exportAllPersonas()).toEqual(preservedVsp);
    expect(await target.eigenRegieAuxiliaryStore!.exportAll()).toEqual(preservedAuxiliary);
  });
});
