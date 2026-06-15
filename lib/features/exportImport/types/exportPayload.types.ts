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
}

export interface RecoFreeExportData {
  personas: {
    elias?: RecoFreePersonaExportBundle;
    kim?: RecoFreePersonaExportBundle;
  };
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
}
