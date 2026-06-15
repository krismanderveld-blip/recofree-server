/**
 * Session Greeting Engine V3 — Main Orchestrator
 *
 * Flow:
 * 1. Evaluate freshness (reuse from V1)
 * 2. Resolve override (CRISIS/FIRST/MISSING) → if override, build override prompt, return
 * 3. Build synthesis candidates (score all 6 source types)
 * 4. Select top 3 sources (balance rules)
 * 5. Build synthesis prompt payload
 * 6. Return payload for GPT call (server-side)
 *
 * The engine is DETERMINISTIC — it produces the same prompt payload
 * given the same input. GPT is the only non-deterministic step.
 */

import type {
  SessionGreetingInitInput,
  GreetingFreshnessResult,
} from './sessionGreeting.types';
import type {
  GreetingOverrideResult,
  GreetingSynthesisCandidate,
  SelectedSynthesisSource,
  MoodMetricSelection,
  SessionGreetingV3Debug,
  GreetingSynthesisPromptPayload,
} from './sessionGreetingV3.types';

import { evaluateGreetingFreshness } from './evaluateGreetingFreshness';
import { resolveGreetingOverride } from './resolveGreetingOverride';
import { buildGreetingSynthesisCandidates } from './buildGreetingSynthesisCandidates';
import { selectGreetingSynthesisSources } from './selectGreetingSynthesisSources';
import {
  buildGreetingSynthesisPromptPayload,
  buildCrisisOverridePrompt,
  buildFirstSessionOverridePrompt,
  buildMissingDataOverridePrompt,
} from './buildGreetingSynthesisPrompt';

// ─── V3 Engine Result ───────────────────────────────────────────────────────

export interface SessionGreetingV3EngineResult {
  mode: 'SYNTHESIS' | 'CRISIS_OVERRIDE' | 'FIRST_SESSION' | 'MISSING_DATA';
  override: GreetingOverrideResult | null;
  /** For SYNTHESIS mode: structured payload for GPT */
  synthesisPayload: GreetingSynthesisPromptPayload | null;
  /** For OVERRIDE modes: simple prompt string for GPT */
  overridePrompt: string | null;
  /** Selected sources (empty for override modes) */
  selectedSources: SelectedSynthesisSource[];
  /** Debug information */
  debug: SessionGreetingV3Debug;
}

// ─── Main Engine ────────────────────────────────────────────────────────────

export function sessionGreetingEngineV3(
  input: SessionGreetingInitInput,
): SessionGreetingV3EngineResult {
  const {
    userDat,
    stateDat,
    projectionsDat,
    logsDat: _logsDat,
    diaryMetadata,
    gratitudeMetadata,
    nowIso,
    timezone,
  } = input;

  // ─── Step 1: Evaluate Freshness ─────────────────────────────────────────────
  const { localCalendarDate } = input;
  const freshness = evaluateGreetingFreshness({
    stateDat,
    diaryMetadata,
    gratitudeMetadata,
    userDat,
    nowIso,
    localCalendarDate,
    timezone,
  });

  const sessionNumber = userDat?.sessionStats.currentSessionNumber ?? 0;

  // ─── Step 2: Resolve Override ───────────────────────────────────────────────
  const override = resolveGreetingOverride({
    userDat,
    stateDat,
    freshness,
  });

  if (override) {
    const userName = userDat?.userName ?? '';
    let overridePrompt: string;

    switch (override.mode) {
      case 'CRISIS_OVERRIDE':
        overridePrompt = buildCrisisOverridePrompt(
          userName,
          (override.payload.craving as number) ?? 0,
        );
        break;
      case 'FIRST_SESSION':
        overridePrompt = buildFirstSessionOverridePrompt(
          (override.payload.userName as string) ?? null,
        );
        break;
      case 'MISSING_DATA':
        overridePrompt = buildMissingDataOverridePrompt(userName);
        break;
      default:
        overridePrompt = buildMissingDataOverridePrompt(userName);
    }

    return {
      mode: override.mode,
      override,
      synthesisPayload: null,
      overridePrompt,
      selectedSources: [],
      debug: buildDebug({
        nowIso,
        sessionNumber,
        freshness,
        override,
        synthesisCandidates: [],
        selectedSources: [],
        moodMetric: null,
        mode: override.mode,
      }),
    };
  }

  // ─── Step 3: Build Synthesis Candidates ─────────────────────────────────────
  const { candidates, moodMetric } = buildGreetingSynthesisCandidates({
    userDat,
    stateDat,
    projectionsDat,
    diaryMetadata,
    gratitudeMetadata,
    freshness,
  });

  // ─── Step 4: Select Sources ─────────────────────────────────────────────────
  const selectedSources = selectGreetingSynthesisSources({
    candidates,
    moodMetric,
  });

  // ─── Step 5: Build Prompt Payload ───────────────────────────────────────────
  const userName = userDat?.userName ?? '';
  const synthesisPayload = buildGreetingSynthesisPromptPayload(userName, selectedSources);

  return {
    mode: 'SYNTHESIS',
    override: null,
    synthesisPayload,
    overridePrompt: null,
    selectedSources,
    debug: buildDebug({
      nowIso,
      sessionNumber,
      freshness,
      override: null,
      synthesisCandidates: candidates,
      selectedSources,
      moodMetric,
      mode: 'SYNTHESIS',
    }),
  };
}

// ─── Debug Builder ──────────────────────────────────────────────────────────

function buildDebug(params: SessionGreetingV3Debug): SessionGreetingV3Debug {
  return { ...params };
}
