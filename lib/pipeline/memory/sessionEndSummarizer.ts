/**
 * Session End Summarizer — Generates a session summary via GPT-4o-mini.
 * Called when a session ends (app background, explicit end, or timeout).
 * store:false on all OpenAI calls.
 *
 * Routes the GPT call to the Railway backend (/api/signal-engine) which is
 * reachable from both sandbox (web) and device (APK). The apiBaseUrl is
 * resolved via getApiBaseUrl() which returns Railway URL on device.
 */
import type { SessionBuffer } from "@/lib/types/memory/sessionBuffer.types";
import type { SessionLogSummary } from "@/lib/types/memory/logsDat.types";
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import { estimateTokens } from "@/lib/utils/tokens/estimateTokens";
import { LocalDeviceTimeService } from "@/lib/core/time";
import { callMinimalProxy } from '@/lib/ai/minimal-proxy-client';

export interface SessionSummaryRequest {
  persona: RecoFreePersona;
  sessionId: string;
  buffer: SessionBuffer;
  apiBaseUrl: string;
}

export interface SessionSummaryResponse {
  summary: SessionLogSummary;
  rawGptOutput: string;
  tokenCount: number;
}

/**
 * Build the prompt for session summarization.
 */
export function buildSessionSummaryPrompt(buffer: SessionBuffer): string {
  const messages = buffer.compactMessages
    .map((m) => `[${m.role}] ${m.text}`)
    .join("\n");

  const detections = buffer.turnSnapshots
    .map((s) => `Turn ${s.turnId}: fears=${s.detectedCounts?.fears || 0}, hopes=${s.detectedCounts?.hopes || 0}, triggers=${s.detectedCounts?.triggers || 0}`)
    .join("\n");

  return `Je bent een therapeutisch sessie-analysesysteem. Analyseer de volgende sessie en extraheer een gestructureerde samenvatting.

SESSIE BERICHTEN:
${messages}

DETECTIES PER TURN:
${detections}

Retourneer ALLEEN geldige JSON in dit formaat:
{
  "compressedNarrative": "string - korte samenvatting van de sessie (max 200 woorden)",
  "discussedTopics": ["string - max 5 besproken thema's"],
  "emotionalThemes": [{"label": "string", "intensity": 0.0-1.0}],
  "breakthroughs": [{"label": "string", "description": "string", "confidence": 0.0-1.0}],
  "relapseOrRiskEvents": [{"eventType": "none|relapse|near_relapse|craving_spike|caregiver_overload|crisis", "description": "string", "severity": 0-10}],
  "openEndpoints": [{"label": "string", "category": "unresolved_question|follow_up|risk_monitor|emotion_unfinished|other"}],
  "suggestedFollowUp": ["string - max 3 suggesties voor volgende sessie"]
}`;
}

/**
 * Build a minimal but valid SessionLogSummary (used as fallback or when GPT is unreachable).
 * IMPORTANT: The narrative must NEVER contain raw error messages or technical details.
 */
function buildMinimalSummary(request: SessionSummaryRequest): SessionLogSummary {
  const snapshot = LocalDeviceTimeService.now();
  const now = snapshot.utcIso;

  // Extract a clean narrative from user messages (no error text)
  const userMessages = request.buffer.compactMessages
    .filter((m) => m.role === "user")
    .slice(-5)
    .map((m) => m.text.slice(0, 300));

  const narrative = userMessages.length > 0
    ? `Sessie-inhoud (${request.buffer.compactMessages.length} berichten): ${userMessages.join(" | ")}`.slice(0, 1500)
    : `Sessie met ${request.buffer.compactMessages.length} berichten`;

  return {
    summaryId: `summary_${request.sessionId}_${snapshot.epochMs}`,
    sessionId: request.sessionId,
    persona: request.persona,
    startedAt: request.buffer.startedAt,
    endedAt: now,
    createdAt: now,
    summaryModel: "gpt-4o-mini",
    summarySchemaVersion: "session_summary.v1",
    compressedNarrative: narrative,
    discussedTopics: [],
    emotionalThemes: [],
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
    moduleTrace: [],
    zoneTrace: [],
    inputTokenEstimate: 0,
    outputTokenEstimate: 0,
  };
}

/**
 * Call GPT-4o-mini to generate session summary.
 * Falls back to a clean minimal summary if the call fails.
 * NEVER stores raw error messages in the compressedNarrative.
 */
export async function generateSessionSummary(
  request: SessionSummaryRequest
): Promise<SessionSummaryResponse> {
  const prompt = buildSessionSummaryPrompt(request.buffer);

  try {
    const responseJson = await callMinimalProxy({
      persona: request.persona,
      systemPrompt: prompt,
      messages: [{ role: 'user', content: 'Return the session summary JSON now.' }],
      model: 'gpt-4o-mini',
      maxTokens: 1200,
      temperature: 0.1,
      promptBuildVersion: 'session-end-summary-client-v2',
    });
    let data: any = {};
    try {
      data = JSON.parse(responseJson.text || '{}');
    } catch {
      // If GPT returned non-JSON, use it as narrative
      data = { compressedNarrative: (responseJson.text || '').slice(0, 1500) };
    }
    const rawOutput = JSON.stringify(data);

    // Parse GPT output into valid SessionLogSummary
    const parsed = parseSessionSummaryOutput(data);
    const snapshot = LocalDeviceTimeService.now();
    const now = snapshot.utcIso;

    const summary: SessionLogSummary = {
      summaryId: `summary_${request.sessionId}_${snapshot.epochMs}`,
      sessionId: request.sessionId,
      persona: request.persona,
      startedAt: request.buffer.startedAt,
      endedAt: now,
      createdAt: now,
      summaryModel: "gpt-4o-mini",
      summarySchemaVersion: "session_summary.v1",
      compressedNarrative: parsed.compressedNarrative || `Sessie met ${request.buffer.compactMessages.length} berichten`,
      discussedTopics: parsed.discussedTopics || [],
      emotionalThemes: parsed.emotionalThemes || [],
      breakthroughs: parsed.breakthroughs || [],
      relapseOrRiskEvents: parsed.relapseOrRiskEvents || [{ eventType: "none", description: "", severity: 0 }],
      openEndpoints: parsed.openEndpoints || [],
      extractedCandidates: {
        fears: [],
        hopes: [],
        triggers: [],
        schemaTendencies: [],
        modeTendencies: [],
      },
      moduleTrace: request.buffer.turnSnapshots
        .filter((s) => s.activeModule)
        .map((s) => ({
          moduleId: s.activeModule!.moduleId,
          responseMode: s.activeModule!.responseMode || "default",
          count: 1,
        })),
      zoneTrace: request.buffer.turnSnapshots
        .filter((s) => s.zone)
        .map((s) => ({
          zone: s.zone!.zone,
          count: 1,
        })),
      inputTokenEstimate: estimateTokens(prompt),
      outputTokenEstimate: estimateTokens(rawOutput),
    };

    return {
      summary,
      rawGptOutput: rawOutput,
      tokenCount: estimateTokens(prompt) + estimateTokens(rawOutput),
    };
  } catch (err) {
    // Graceful fallback — clean minimal summary WITHOUT error text in narrative
    console.warn(`[SessionEndSummarizer] GPT call failed: ${err instanceof Error ? err.message : String(err)}`);
    const fallbackSummary = buildMinimalSummary(request);

    return {
      summary: fallbackSummary,
      rawGptOutput: `error: ${err instanceof Error ? err.message : String(err)}`,
      tokenCount: 0,
    };
  }
}

interface ParsedSummaryFields {
  compressedNarrative?: string;
  discussedTopics?: string[];
  emotionalThemes?: Array<{ label: string; intensity: number }>;
  breakthroughs?: Array<{ label: string; description: string; confidence: number }>;
  relapseOrRiskEvents?: Array<{ eventType: "relapse" | "near_relapse" | "craving_spike" | "caregiver_overload" | "crisis" | "none"; description: string; severity: number }>;
  openEndpoints?: Array<{ label: string; category: "unresolved_question" | "follow_up" | "risk_monitor" | "emotion_unfinished" | "other" }>;
  suggestedFollowUp?: string[];
}

function parseSessionSummaryOutput(data: any): ParsedSummaryFields {
  try {
    if (typeof data === "object" && data !== null) {
      // If the response has our expected format directly
      if (data.compressedNarrative) return data as ParsedSummaryFields;
      // If it's the signal-engine format, adapt
      return {
        compressedNarrative: data.fears?.length > 0
          ? `Sessie met focus op angst/spanning: ${(data.fears || []).slice(0, 3).join(", ")}`
          : "Sessie verwerkt via signaalanalyse",
        discussedTopics: [
          ...(data.fears || []).slice(0, 2),
          ...(data.hopes || []).slice(0, 2),
        ].slice(0, 5),
        emotionalThemes: [],
        breakthroughs: [],
        relapseOrRiskEvents: [{ eventType: "none" as const, description: "", severity: 0 }],
        openEndpoints: (data.triggers || []).slice(0, 3).map((t: string) => ({
          label: t,
          category: "risk_monitor" as const,
        })),
      };
    }
  } catch {
    // ignore parse errors
  }
  return {};
}
