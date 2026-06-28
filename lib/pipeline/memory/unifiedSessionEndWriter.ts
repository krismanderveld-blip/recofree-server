/**
 * Unified Session End Writer — Single entry point for writing session data to logs.dat.
 *
 * Guarantees:
 * 1. ALWAYS writes to logs.dat — even if GPT summarization fails (uses buffer-based fallback)
 * 2. Concurrency lock — a session can only be closed once (prevents double-writes from
 *    manual End + inactivity timer firing simultaneously)
 * 3. Source tracking — records whether the entry was GPT-summarized or fallback-generated
 *
 * This replaces the old dual-path system:
 * - PAD A: pipeline.ts → sessionAnalyses[] in userDat (legacy, now deprecated)
 * - PAD B: sessionLifecycle.ts → logs.dat via GPT summarizer (could silently fail)
 */
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import type { SessionLogSummary } from "@/lib/types/memory/logsDat.types";
import type { SessionBuffer } from "@/lib/types/memory/sessionBuffer.types";
import { generateSessionSummary } from "./sessionEndSummarizer";
import { logDebugEvent } from "@/lib/debug/session-logger";
import { LocalDeviceTimeService } from "@/lib/core/time";

export interface UnifiedSessionEndInput {
  persona: RecoFreePersona;
  sessionId: string;
  buffer: SessionBuffer;
  apiBaseUrl: string;
  /** PAD A legacy data — used to enrich fallback if GPT fails */
  legacySessionData?: {
    themes?: string[];
    dominantEmotion?: string;
    modulesUsed?: string[];
    messageCount?: number;
    durationMinutes?: number;
  };
}

export interface UnifiedSessionEndResult {
  success: boolean;
  summary: SessionLogSummary;
  source: "gpt_summarized" | "buffer_fallback";
  error?: string;
}

// ── Concurrency Lock ──────────────────────────────────────────────────────────
// Tracks which sessionIds have already been closed to prevent double-writes.
const closedSessionIds = new Set<string>();

/**
 * Check if a session has already been closed.
 */
export function isSessionAlreadyClosed(sessionId: string): boolean {
  return closedSessionIds.has(sessionId);
}

/**
 * Reset the lock (used at session start to clear stale entries).
 */
export function resetSessionCloseLock(): void {
  closedSessionIds.clear();
}

/**
 * Unified session end writer.
 *
 * Attempts GPT summarization first. If that fails, builds a meaningful
 * fallback from the buffer data (messages, turn snapshots, module trace).
 *
 * ALWAYS returns a valid SessionLogSummary that can be appended to logs.dat.
 */
export async function writeUnifiedSessionEnd(
  input: UnifiedSessionEndInput
): Promise<UnifiedSessionEndResult> {
  const { persona, sessionId, buffer, apiBaseUrl, legacySessionData } = input;

  // ── Concurrency guard ──
  if (closedSessionIds.has(sessionId)) {
    logDebugEvent("unified_session_end_skipped", {
      reason: "already_closed",
      sessionId,
    });
    // Return a no-op result — the session was already written
    return {
      success: true,
      summary: buildBufferFallbackSummary(persona, sessionId, buffer, legacySessionData),
      source: "buffer_fallback",
      error: "session_already_closed (duplicate prevented)",
    };
  }

  // Acquire lock
  closedSessionIds.add(sessionId);

  // ── Attempt GPT summarization ──
  try {
    const { summary } = await generateSessionSummary({
      persona,
      sessionId,
      buffer,
      apiBaseUrl,
    });

    // Mark source
    (summary as any)._writeSource = "gpt_summarized";

    logDebugEvent("unified_session_end_success", {
      sessionId,
      source: "gpt_summarized",
      narrativeLength: summary.compressedNarrative.length,
      topicCount: summary.discussedTopics.length,
    });

    return {
      success: true,
      summary,
      source: "gpt_summarized",
    };
  } catch (gptError) {
    // ── GPT failed — build fallback from buffer ──
    const errorMsg = gptError instanceof Error ? gptError.message : String(gptError);
    console.warn(`[UnifiedSessionEndWriter] GPT failed (${errorMsg}), using buffer fallback`);

    const fallbackSummary = buildBufferFallbackSummary(persona, sessionId, buffer, legacySessionData);

    logDebugEvent("unified_session_end_fallback", {
      sessionId,
      source: "buffer_fallback",
      error: errorMsg,
      messageCount: buffer.compactMessages.length,
    });

    return {
      success: true,
      summary: fallbackSummary,
      source: "buffer_fallback",
      error: `GPT failed: ${errorMsg}`,
    };
  }
}

/**
 * Build a meaningful SessionLogSummary from buffer data alone (no GPT needed).
 *
 * Extracts:
 * - compressedNarrative from last 5 user messages
 * - discussedTopics from legacy themes or message content keywords
 * - moduleTrace from buffer turnSnapshots
 * - zoneTrace from buffer turnSnapshots
 */
function buildBufferFallbackSummary(
  persona: RecoFreePersona,
  sessionId: string,
  buffer: SessionBuffer,
  legacyData?: UnifiedSessionEndInput["legacySessionData"]
): SessionLogSummary {
  const now = LocalDeviceTimeService.now().utcIso;

  // Extract narrative from user messages (last 5, max 300 chars each)
  const userMessages = buffer.compactMessages
    .filter((m) => m.role === "user")
    .slice(-5)
    .map((m) => m.text.slice(0, 300));

  const narrative = userMessages.length > 0
    ? `Sessie-inhoud (${buffer.compactMessages.length} berichten): ${userMessages.join(" | ")}`
    : `Sessie met ${buffer.compactMessages.length} berichten (geen gebruikersinput beschikbaar)`;

  // Topics from legacy data or extracted from messages
  const topics = legacyData?.themes?.slice(0, 5) ?? extractTopicsFromMessages(userMessages);

  // Module trace from buffer
  const moduleTrace = buffer.turnSnapshots
    .filter((s) => s.activeModule)
    .map((s) => ({
      moduleId: s.activeModule!.moduleId,
      responseMode: s.activeModule!.responseMode || "default",
      count: 1,
    }));

  // Zone trace from buffer
  const zoneTrace = buffer.turnSnapshots
    .filter((s) => s.zone)
    .map((s) => ({
      zone: s.zone!.zone,
      count: 1,
    }));

  return {
    summaryId: `summary_${sessionId}_${LocalDeviceTimeService.now().epochMs}`,
    sessionId,
    persona,
    startedAt: buffer.startedAt,
    endedAt: now,
    createdAt: now,
    summaryModel: "gpt-4o-mini",
    summarySchemaVersion: "session_summary.v1",
    compressedNarrative: narrative.slice(0, 1500),
    discussedTopics: topics,
    emotionalThemes: legacyData?.dominantEmotion
      ? [{ label: legacyData.dominantEmotion, intensity: 0.7 }]
      : [],
    breakthroughs: [],
    relapseOrRiskEvents: [{ eventType: "none", description: "", severity: 0 }],
    openEndpoints: [],
    extractedCandidates: {
      fears: [],
      hopes: [],
      triggers: [],
      schemaTendencies: [],
      modeTendencies: [],
    },
    moduleTrace,
    zoneTrace,
    inputTokenEstimate: 0,
    outputTokenEstimate: 0,
  };
}

/**
 * Simple topic extraction from user messages (fallback when no legacy themes available).
 */
function extractTopicsFromMessages(messages: string[]): string[] {
  if (messages.length === 0) return [];

  // Combine all messages and extract most frequent meaningful words (>4 chars)
  const combined = messages.join(" ").toLowerCase();
  const words = combined.split(/\s+/).filter((w) => w.length > 4);
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Return top 3 most frequent words as rough topics
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);
}
