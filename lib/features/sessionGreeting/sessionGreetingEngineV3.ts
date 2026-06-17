/**
 * Session Greeting Engine V3 — Main Orchestrator (with Absence Awareness)
 *
 * Flow:
 * 1. Evaluate freshness (reuse from V1)
 * 2. Calculate session absence (days since lastSessionStartedAt)
 * 3. Resolve override (CRISIS > FIRST > RETURN_AFTER_ABSENCE > MISSING) → handle each mode
 * 4. Build synthesis candidates (score all 6 source types)
 * 5. Select sources:
 *    - RETURN_AFTER_ABSENCE: max 2 sources via selectReturnAfterAbsenceSources
 *    - SYNTHESIS: max 3 sources via selectGreetingSynthesisSources
 * 6. Build prompt payload (with absence context if applicable)
 * 7. Return payload for GPT call (server-side)
 *
 * CRITICAL: lastSessionStartedAt must be read BEFORE sessionStats is updated.
 * The engine receives the pre-update value. Update happens AFTER greeting is generated.
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
  GreetingSynthesisMode,
} from './sessionGreetingV3.types';

import { evaluateGreetingFreshness } from './evaluateGreetingFreshness';
import { resolveGreetingOverride } from './resolveGreetingOverride';
import { buildGreetingSynthesisCandidates } from './buildGreetingSynthesisCandidates';
import {
  selectGreetingSynthesisSources,
  selectReturnAfterAbsenceSources,
} from './selectGreetingSynthesisSources';
import {
  buildGreetingSynthesisPromptPayload,
  buildCrisisOverridePrompt,
  buildFirstSessionOverridePrompt,
  buildMissingDataOverridePrompt,
} from './buildGreetingSynthesisPrompt';
import {
  calculateSessionAbsence,
  type SessionAbsenceResult,
} from './calculateSessionAbsence';

// ─── V3 Engine Result ───────────────────────────────────────────────────────

export interface SessionGreetingV3EngineResult {
  mode: GreetingSynthesisMode;
  override: GreetingOverrideResult | null;
  absence: SessionAbsenceResult;
  /** For SYNTHESIS and RETURN_AFTER_ABSENCE modes: structured payload for GPT */
  synthesisPayload: GreetingSynthesisPromptPayload | null;
  /** For OVERRIDE modes (CRISIS/FIRST/MISSING): simple prompt string for GPT */
  overridePrompt: string | null;
  /** Selected sources (empty for bypass override modes) */
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
    vspSection,
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

  // ─── Step 2: Calculate Session Absence ──────────────────────────────────────
  const lastSessionStartedAt = userDat?.sessionStats.lastSessionStartedAt ?? null;
  const absence = calculateSessionAbsence({
    lastSessionStartedAt,
    nowIso,
  });

  // ─── Step 3: Build Synthesis Candidates (needed for override resolution) ────
  const { candidates, moodMetric } = buildGreetingSynthesisCandidates({
    userDat,
    stateDat,
    projectionsDat,
    logsDat: _logsDat,
    diaryMetadata,
    gratitudeMetadata,
    freshness,
  });

  // ─── Step 4: Resolve Override ───────────────────────────────────────────────
  const override = resolveGreetingOverride({
    userDat,
    stateDat,
    freshness,
    synthesisCandidates: candidates,
    absence,
  });

  // Handle bypass overrides (CRISIS, FIRST_SESSION, MISSING_DATA)
  if (override && override.shouldBypassSynthesis) {
    const userName = userDat?.userName ?? '';
    let overridePrompt: string;

    switch (override.mode) {
      case 'CRISIS_OVERRIDE':
        overridePrompt = buildCrisisOverridePrompt(
          userName,
          (override.payload.craving as number) ?? 0,
          stateDat?.vspZone,
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
      absence,
      synthesisPayload: null,
      overridePrompt,
      selectedSources: [],
      debug: buildDebug({
        nowIso,
        sessionNumber,
        freshness,
        absence,
        override,
        synthesisCandidates: [],
        selectedSources: [],
        moodMetric: null,
        mode: override.mode,
      }),
    };
  }

  // Handle RETURN_AFTER_ABSENCE (prefix with absence, optional 2 sources)
  if (override && override.shouldPrefixSynthesisWithAbsence) {
    const selectedSources = selectReturnAfterAbsenceSources({
      candidates,
      absence,
    });

    const userName = userDat?.userName ?? '';
    const synthesisPayload = buildGreetingSynthesisPromptPayload({
      userName,
      selectedSources,
      absence,
      mode: 'RETURN_AFTER_ABSENCE',
      vspZone: stateDat?.vspZone,
      vspSection: vspSection ?? undefined,
    });

    return {
      mode: 'RETURN_AFTER_ABSENCE',
      override,
      absence,
      synthesisPayload,
      overridePrompt: null,
      selectedSources,
      debug: buildDebug({
        nowIso,
        sessionNumber,
        freshness,
        absence,
        override,
        synthesisCandidates: candidates,
        selectedSources,
        moodMetric,
        mode: 'RETURN_AFTER_ABSENCE',
      }),
    };
  }

  // ─── Step 5: Normal Synthesis — Select Sources ─────────────────────────────
  const selectedSources = selectGreetingSynthesisSources({
    candidates,
    moodMetric,
  });

  // ─── Step 6: Build Prompt Payload ──────────────────────────────────────────
  const userName = userDat?.userName ?? '';
  const synthesisPayload = buildGreetingSynthesisPromptPayload({
    userName,
    selectedSources,
    absence,
    mode: 'SYNTHESIS',
    vspZone: stateDat?.vspZone,
    vspSection: vspSection ?? undefined,
  });

  return {
    mode: 'SYNTHESIS',
    override: null,
    absence,
    synthesisPayload,
    overridePrompt: null,
    selectedSources,
    debug: buildDebug({
      nowIso,
      sessionNumber,
      freshness,
      absence,
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
