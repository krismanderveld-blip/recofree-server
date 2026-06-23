/**
 * Plaintext payload types for RecoFree Export/Import.
 */

export interface RecoFreeExportPlaintextPayload {
  payloadVersion: "recofree.export.payload.v1";
  createdAt: string;
  appVersion: string;
  sourceDevice: ExportSourceDeviceMetadata;
  exportScope: ExportScopeMetadata;
  data: RecoFreeExportData;
  integrity: ExportPayloadIntegrity;
}

export interface ExportSourceDeviceMetadata {
  platform: "ios" | "android" | "web" | "unknown";
  expoSdkVersion: string;
  appBuildNumber?: string;
  locale?: string;
}

export interface ExportScopeMetadata {
  includesUserDat: true;
  includesStateDat: true;
  includesProjectionsDat: true;
  includesLogsDat: true;
  includesDiaryEntries: true;
  includesGratitudeEntries: true;
  includesBackpackData: true;
  includesEliasPersona: boolean;
  includesKimPersona: boolean;
  // NEW scope flags
  includesPersonaProjections: true;
  includesEmergencyContacts: true;
  includesDerivedCaches: true;
}

export interface RecoFreeExportData {
  personas: {
    elias?: RecoFreePersonaExportBundle;
    kim?: RecoFreePersonaExportBundle;
  };
  // NEW: shared (non-persona) data
  shared: RecoFreeSharedExportBundle;
}

export interface RecoFreePersonaExportBundle {
  persona: "elias" | "kim";
  userDat: unknown | null;
  stateDat: unknown | null;
  projectionsDat: unknown | null;
  logsDat: unknown | null;
  diaryEntries: unknown[];
  gratitudeEntries: unknown[];
  backpackData: unknown | null;
  // NEW: persona-specific projection (fears/hopes/goals engine)
  personaProjection: unknown | null;
}

export interface RecoFreeSharedExportBundle {
  emergencyContacts: unknown[];
  derivedCaches: {
    backpackHash: unknown | null;
    extractedEntities: unknown | null;
    vspProfile: unknown | null;
    vspHash: unknown | null;
  };
  /** At-rest encryption key (base64). Included so import can restore data readability. */
  storageKeyBase64?: string | null;
}

export interface ExportPayloadIntegrity {
  plaintextSha256Base64: string;
  datasetCounts: {
    elias?: ExportPersonaDatasetCounts;
    kim?: ExportPersonaDatasetCounts;
  };
}

export interface ExportPersonaDatasetCounts {
  diaryEntries: number;
  gratitudeEntries: number;
  hasUserDat: boolean;
  hasStateDat: boolean;
  hasProjectionsDat: boolean;
  hasLogsDat: boolean;
  hasBackpackData: boolean;
  // NEW counts
  hasPersonaProjection: boolean;
}
