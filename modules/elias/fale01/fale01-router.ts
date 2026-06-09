/**
 * FALE01 — Two-Stage Failure Response After Relapse (Elias only)
 * ROUTER: Takes detection result and produces output contract
 */
import type {
  FALE01RuntimeInput,
  FALE01DetectionResult,
  FALE01ModuleOutput,
  FALE01StorageState,
} from './fale01-types';
import { buildFALE01PromptPayload } from './fale01-prompt';
import { buildFALE01StoragePatch } from './fale01-storage';

export function routeFALE01(
  input: FALE01RuntimeInput,
  detection: FALE01DetectionResult,
  _previousStorage?: FALE01StorageState,
): FALE01ModuleOutput {
  const promptPayload = buildFALE01PromptPayload(detection);
  const storagePatch = buildFALE01StoragePatch(input, detection);

  return {
    detection,
    promptPayload,
    storagePatch,
  };
}
