/**
 * ══════════════════════════════════════════════════════════════════════════
 * GOLDEN TESTSET FOUNDATION
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Captures real engine input/output pairs during CLIENT_ACTIVE mode
 * to serve as regression tests when the server takes over.
 *
 * Golden test cases are:
 *   - Captured from real sessions (not synthetic)
 *   - Stored locally encrypted (same as shadow logs)
 *   - Categorized by scenario type
 *   - Used for automated regression testing in shadow mode
 *
 * Categories (from migration plan):
 *   - crisis scenarios (online, offline, server timeout, relapse intent)
 *   - greeting scenarios (first session, return after 1 day, return after days, etc.)
 *   - state patch scenarios (schema valid, idempotent, encrypted write, etc.)
 *   - normal flow scenarios (various zone colors, module activations)
 */

import type { CanonicalEngineInput } from './engine-input.types';
import type { CanonicalEngineOutput } from './engine-output.types';

// ─── Golden Test Case ─────────────────────────────────────────────────

export type GoldenTestCategory =
  | 'crisis_online'
  | 'crisis_offline'
  | 'crisis_server_timeout'
  | 'crisis_relapse_intent'
  | 'greeting_first_session'
  | 'greeting_return_1day'
  | 'greeting_return_multiday'
  | 'greeting_logs_present'
  | 'greeting_logs_absent'
  | 'greeting_vsp_present'
  | 'greeting_vsp_absent'
  | 'greeting_timezone_shift'
  | 'greeting_app_restart'
  | 'normal_green_zone'
  | 'normal_yellow_zone'
  | 'normal_orange_zone'
  | 'normal_red_zone'
  | 'normal_purple_zone'
  | 'normal_module_activation'
  | 'normal_regulation'
  | 'normal_session_start'
  | 'normal_mid_session'
  | 'normal_session_end'
  | 'persona_elias'
  | 'persona_kim';

export interface GoldenTestCase {
  /** Unique identifier for this test case. */
  id: string;
  /** Category for grouping. */
  category: GoldenTestCategory;
  /** Human-readable description (no personal content). */
  description: string;
  /** The canonical input (redacted: message replaced with hash). */
  input: CanonicalEngineInput;
  /** The expected output from the client engine. */
  expectedOutput: CanonicalEngineOutput;
  /** Timestamp when captured. */
  capturedAt: string;
  /** Engine version when captured. */
  engineVersion: string;
  /** Which fields are deterministic (exact match required). */
  deterministicFields: string[];
  /** Which fields are semantic (LLM-based, tolerance allowed). */
  semanticFields: string[];
}

// ─── Golden Testset Store ─────────────────────────────────────────────

import { readEncrypted, writeEncrypted } from '@/lib/crypto/storage-encryption';

const GOLDEN_STORAGE_KEY = 'migration_golden_testset';
const MAX_GOLDEN_CASES = 100;

/**
 * Append a golden test case to the local encrypted store.
 */
export async function appendGoldenTestCase(testCase: GoldenTestCase): Promise<void> {
  const existing = await readGoldenTestCases();
  existing.push(testCase);
  // FIFO trim per category: keep max 5 per category
  const byCategory = new Map<string, GoldenTestCase[]>();
  for (const tc of existing) {
    const arr = byCategory.get(tc.category) || [];
    arr.push(tc);
    byCategory.set(tc.category, arr);
  }
  const trimmed: GoldenTestCase[] = [];
  for (const [, cases] of byCategory) {
    // Keep last 5 per category
    trimmed.push(...cases.slice(-5));
  }
  // Also enforce global max
  const final = trimmed.length > MAX_GOLDEN_CASES
    ? trimmed.slice(trimmed.length - MAX_GOLDEN_CASES)
    : trimmed;
  await writeEncrypted(GOLDEN_STORAGE_KEY, JSON.stringify(final));
}

/**
 * Read all golden test cases.
 */
export async function readGoldenTestCases(): Promise<GoldenTestCase[]> {
  try {
    const raw = await readEncrypted(GOLDEN_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GoldenTestCase[];
  } catch {
    return [];
  }
}

/**
 * Get golden test cases by category.
 */
export async function getGoldenTestsByCategory(
  category: GoldenTestCategory
): Promise<GoldenTestCase[]> {
  const all = await readGoldenTestCases();
  return all.filter(tc => tc.category === category);
}

/**
 * Clear all golden test cases.
 */
export async function clearGoldenTestCases(): Promise<void> {
  await writeEncrypted(GOLDEN_STORAGE_KEY, JSON.stringify([]));
}

// ─── Auto-categorization ──────────────────────────────────────────────

/**
 * Auto-detect the category of a test case based on input/output properties.
 */
export function detectGoldenCategory(
  input: CanonicalEngineInput,
  output: CanonicalEngineOutput
): GoldenTestCategory {
  // Crisis scenarios
  if (output.crisisLevel >= 2 || output.showEmergency) {
    if (output.relapseIntentDetected) return 'crisis_relapse_intent';
    return 'crisis_online';
  }

  // Greeting scenarios (session start)
  if (input.isSessionStart && input.messageCount === 0) {
    if (input.logsSessions.length === 0) return 'greeting_logs_absent';
    if (input.vspSection) return 'greeting_vsp_present';
    return 'greeting_logs_present';
  }

  // Zone-based normal scenarios
  if (output.zoneColor === 'PURPLE') return 'normal_purple_zone';
  if (output.zoneColor === 'RED') return 'normal_red_zone';
  if (output.zoneColor === 'ORANGE') return 'normal_orange_zone';
  if (output.zoneColor === 'YELLOW') return 'normal_yellow_zone';

  // Persona
  if (input.userType === 'kim') return 'persona_kim';

  // Module activation
  if (output.moduleActivations.length > 0) return 'normal_module_activation';

  // Default
  return 'normal_green_zone';
}

// ─── Deterministic vs Semantic field classification ───────────────────

/**
 * Fields that must match exactly (deterministic engine logic).
 */
export const DETERMINISTIC_FIELDS: string[] = [
  'crisisLevel',
  'showEmergency',
  'relapseIntentDetected',
  'status',
  'dominantModule',
  'zoneColor',
  'responseDirection',
  'riskLevel',
  'emotionalState',
  'loopDetected',
  'regulationResult.action',
  'regulationResult.zone',
  'regulationResult.effectiveDepth',
  'regulationResult.wasSoftened',
  'regulationResult.wasSkipped',
  'regulationResult.hasIntervention',
];

/**
 * Fields that may vary (LLM-dependent or floating point).
 */
export const SEMANTIC_FIELDS: string[] = [
  'currentEmotion',
  'intensityTrajectory',
  'liveIntent',
  'moodTrend',
  'zoneScore',
  'selectedModel',
  'clinicalAnnotationPresent',
];
