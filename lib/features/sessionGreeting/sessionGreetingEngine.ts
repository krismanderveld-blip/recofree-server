/**
 * Session Greeting Engine — Main Orchestrator
 * 
 * Calls: evaluateGreetingFreshness → buildGreetingAnchorCandidates → resolveGreetingAnchorPriority → buildGreetingPromptPayload
 * Then makes GPT-4o call (store:false, max_tokens:150, temperature:0.7) via server endpoint.
 * Returns: { greeting, anchor, debugLog, estimatedTokens }
 */

import type {
  SessionGreetingInitInput,
  SelectedGreetingAnchor,
  GreetingAnchorCandidate,
  GreetingFreshnessResult,
} from './sessionGreeting.types';
import { evaluateGreetingFreshness } from './evaluateGreetingFreshness';
import { buildGreetingAnchorCandidates } from './buildGreetingAnchorCandidates';
import { resolveGreetingAnchorPriority } from './resolveGreetingAnchorPriority';
import { buildGreetingPromptPayload, enforceGreetingOutputRules } from './buildGreetingPromptPayload';
import { callMinimalProxy } from '@/lib/ai/minimal-proxy-client';

export interface SessionGreetingResult {
  greeting: string;
  anchor: SelectedGreetingAnchor;
  debugLog: string;
  estimatedTokens: number;
}

export interface SessionGreetingEngineOptions {
  apiBaseUrl: string;
}

/**
 * Main entry point for the Session Greeting Engine.
 * Engine decides the anchor deterministically, GPT only generates the text.
 */
export async function runSessionGreetingEngine(
  input: SessionGreetingInitInput,
  options: SessionGreetingEngineOptions,
): Promise<SessionGreetingResult> {
  const { nowIso, localCalendarDate, timezone, userDat, stateDat, projectionsDat, logsDat, diaryMetadata, gratitudeMetadata } = input;
  const { apiBaseUrl } = options;

  // Step 1: Evaluate freshness of all data sources
  const freshness: GreetingFreshnessResult = evaluateGreetingFreshness({
    nowIso,
    localCalendarDate,
    timezone,
    stateDat,
    userDat,
    diaryMetadata,
    gratitudeMetadata,
  });

  // Step 2: Build all 9 anchor candidates with eligibility flags
  const candidates: GreetingAnchorCandidate[] = buildGreetingAnchorCandidates({
    nowIso,
    userDat,
    stateDat,
    projectionsDat,
    logsDat,
    diaryMetadata,
    gratitudeMetadata,
    freshness,
  });

  // Step 3: Select highest-priority eligible anchor
  const anchor: SelectedGreetingAnchor = resolveGreetingAnchorPriority(candidates);

  // Step 4: Build GPT prompt payload
  const { systemPrompt, estimatedTokens } = buildGreetingPromptPayload(anchor, userDat);

  // Step 5: Call GPT via server endpoint
  const userName = userDat?.userName ?? 'daar';
  let rawGreeting: string;

  try {
    rawGreeting = await callSessionGreetingEndpoint(apiBaseUrl, systemPrompt, userName);
  } catch (error) {
    // Fallback greeting if GPT call fails
    console.warn('[SessionGreeting] GPT call failed, using fallback:', error);
    rawGreeting = `${userName}, fijn dat je er bent. Hoe gaat het met je vandaag?`;
  }

  // Step 6: Enforce output rules
  const { greeting, violations } = enforceGreetingOutputRules(rawGreeting, userName);

  // Step 7: Build debug log
  const debugLog = buildDebugLog(anchor, estimatedTokens, violations);

  return {
    greeting,
    anchor,
    debugLog,
    estimatedTokens,
  };
}

/**
 * Calls the server endpoint POST /api/session-greeting.
 */
async function callSessionGreetingEndpoint(
  _apiBaseUrl: string,
  systemPrompt: string,
  userName: string,
): Promise<string> {
  const result = await callMinimalProxy({
    persona: 'elias',
    systemPrompt,
    messages: [{ role: 'user', content: `Generate a personal greeting for ${userName}.` }],
    model: 'gpt-4o-mini',
    maxTokens: 400,
    temperature: 0.7,
    promptBuildVersion: 'session-greeting-v1-client-v2',
  });
  if (!result.text.trim()) {
    throw new Error('Invalid response from session greeting endpoint');
  }
  return result.text.trim();
}

/**
 * Builds the debug log string.
 * Format: [SessionGreeting] anchor=RECENT_DIARY reason="..." tokens=~320
 */
function buildDebugLog(
  anchor: SelectedGreetingAnchor,
  estimatedTokens: number,
  violations: string[],
): string {
  let log = `[SessionGreeting] anchor=${anchor.anchorType} reason="${anchor.reason}" tokens=~${estimatedTokens}`;
  if (violations.length > 0) {
    log += ` violations=[${violations.join(', ')}]`;
  }
  return log;
}
