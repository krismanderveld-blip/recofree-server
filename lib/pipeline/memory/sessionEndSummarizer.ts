/**
 * Session End Summarizer — Generates a session summary via GPT-4o-mini.
 * Called when a session ends (app background, explicit end, or timeout).
 * store:false on all OpenAI calls.
 */
import type { SessionBuffer } from "@/lib/types/memory/sessionBuffer.types";
import type { SessionLogSummary } from "@/lib/types/memory/logsDat.types";
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import { estimateTokens } from "@/lib/utils/tokens/estimateTokens";
import { LocalDeviceTimeService } from "@/lib/core/time";

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
 */
function buildMinimalSummary(request: SessionSummaryRequest, narrative: string): SessionLogSummary {
  const snapshot = LocalDeviceTimeService.now();
  const now = snapshot.utcIso;
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
 * Falls back to a minimal summary if the call fails.
 */
export async function generateSessionSummary(
  request: SessionSummaryRequest
): Promise<SessionSummaryResponse> {
  const prompt = buildSessionSummaryPrompt(request.buffer);

  try {
    const response = await fetch(`${request.apiBaseUrl}/api/signal-engine`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const responseJson = await response.json();
    // signal-engine returns { result: "..." } — parse the JSON string from GPT
    let data: any = {};
    try {
      data = JSON.parse(responseJson.result || '{}');
    } catch {
      // If GPT returned non-JSON, use it as narrative
      data = { compressedNarrative: (responseJson.result || '').slice(0, 1500) };
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
    // Graceful fallback — minimal summary without GPT
    const narrative = `Sessie beëindigd (${request.buffer.compactMessages.length} berichten). GPT-samenvatting niet beschikbaar: ${err instanceof Error ? err.message : String(err)}`;
    const fallbackSummary = buildMinimalSummary(request, narrative);

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
