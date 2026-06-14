/**
 * Session End Summarizer — Generates a session summary via GPT-4o-mini.
 * Called when a session ends (app background, explicit end, or timeout).
 * store:false on all OpenAI calls.
 */
import type { SessionBuffer } from "@/lib/types/memory/sessionBuffer.types";
import type { SessionLogSummary } from "@/lib/types/memory/logsDat.types";
import type { RecoFreePersona } from "@/lib/types/memory/memoryCore.types";
import { estimateTokens } from "@/lib/utils/tokens/estimateTokens";

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
  "dominantThemes": ["string - max 5 dominante thema's"],
  "emotionalArc": "string - korte beschrijving van emotioneel verloop",
  "keyInsights": ["string - max 3 belangrijke inzichten"],
  "unresolvedTensions": ["string - max 3 onopgeloste spanningen"],
  "therapeuticProgress": "string - korte beschrijving van therapeutische voortgang",
  "suggestedFollowUp": ["string - max 3 suggesties voor volgende sessie"]
}`;
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
      body: JSON.stringify({
        userId: "session-summarizer",
        conversationHistory: [{ role: "user", content: prompt }],
        bufferSnapshot: { zone: "GREEN", persona: request.persona },
        _internal: {
          model: "gpt-4o-mini",
          store: false,
          maxTokens: 500,
          purpose: "session_summary",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const rawOutput = JSON.stringify(data);

    // Parse GPT output
    const parsed = parseSessionSummaryOutput(data);

    const summary: SessionLogSummary = {
      sessionId: request.sessionId,
      persona: request.persona,
      startedAt: request.buffer.startedAt,
      endedAt: new Date().toISOString(),
      turnCount: request.buffer.turnSnapshots.length,
      messageCount: request.buffer.compactMessages.length,
      dominantThemes: parsed.dominantThemes || [],
      emotionalArc: parsed.emotionalArc || "onbekend",
      keyInsights: parsed.keyInsights || [],
      unresolvedTensions: parsed.unresolvedTensions || [],
      therapeuticProgress: parsed.therapeuticProgress || "niet bepaald",
      suggestedFollowUp: parsed.suggestedFollowUp || [],
    };

    return {
      summary,
      rawGptOutput: rawOutput,
      tokenCount: estimateTokens(prompt) + estimateTokens(rawOutput),
    };
  } catch (err) {
    // Graceful fallback — minimal summary without GPT
    const fallbackSummary: SessionLogSummary = {
      sessionId: request.sessionId,
      persona: request.persona,
      startedAt: request.buffer.startedAt,
      endedAt: new Date().toISOString(),
      turnCount: request.buffer.turnSnapshots.length,
      messageCount: request.buffer.compactMessages.length,
      dominantThemes: [],
      emotionalArc: "sessie beëindigd zonder samenvatting (GPT niet bereikbaar)",
      keyInsights: [],
      unresolvedTensions: [],
      therapeuticProgress: "niet bepaald",
      suggestedFollowUp: [],
    };

    return {
      summary: fallbackSummary,
      rawGptOutput: `error: ${err instanceof Error ? err.message : String(err)}`,
      tokenCount: 0,
    };
  }
}

function parseSessionSummaryOutput(data: any): Partial<SessionLogSummary> {
  // The signal-engine endpoint returns fears/hopes/goals/triggers
  // We need to adapt this to our summary format
  try {
    if (typeof data === "object" && data !== null) {
      // If the response has our expected format directly
      if (data.dominantThemes) return data;
      // If it's the signal-engine format, adapt
      return {
        dominantThemes: [
          ...(data.fears || []).slice(0, 2),
          ...(data.hopes || []).slice(0, 2),
        ].slice(0, 5),
        emotionalArc: data.fears?.length > data.hopes?.length ? "overwegend angstig" : "gemengd",
        keyInsights: data.goals || [],
        unresolvedTensions: data.triggers || [],
        therapeuticProgress: "bepaald via signaalanalyse",
        suggestedFollowUp: [],
      };
    }
  } catch {
    // ignore parse errors
  }
  return {};
}
