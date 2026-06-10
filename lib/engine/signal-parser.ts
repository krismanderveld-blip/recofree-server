/**
 * Engine Signal Parser
 * 
 * Parses the <engine_signals> JSON block from LLM responses.
 * Splits the response into user-facing text and structured engine signals.
 */

// ─── Types ─────────────────────────────────────────────────────────

export interface EngineSignalPerson {
  name: string;
  relationship: string;
  valence: 'positive' | 'negative' | 'ambivalent' | 'neutral';
}

export interface EngineSignalTrigger {
  label: string;
  confidence: number;
  layer: 'state.dat' | 'user.dat' | 'projections.dat';
}

export interface EngineSignalSchema {
  name: string;
  confidence: number;
}

export interface EngineSignalModuleRelevance {
  moduleId: string;
  confidence: number;
}

export interface EngineSignals {
  persons: EngineSignalPerson[];
  triggers: EngineSignalTrigger[];
  schemas: EngineSignalSchema[];
  emotionalShift: string;
  topicProgression: string;
  therapeuticMove: string;
  moduleRelevance: EngineSignalModuleRelevance[];
}

export interface ParsedResponse {
  /** The user-facing therapeutic text (without engine_signals or clinical tags) */
  userText: string;
  /** Parsed engine signals (null if parsing failed or block missing) */
  signals: EngineSignals | null;
  /** The clinical annotation block if present */
  clinicalBlock: string | null;
  /** Raw response for logging */
  rawResponse: string;
}

// ─── Default empty signals ─────────────────────────────────────────

export const EMPTY_SIGNALS: EngineSignals = {
  persons: [],
  triggers: [],
  schemas: [],
  emotionalShift: 'none',
  topicProgression: 'none',
  therapeuticMove: 'none',
  moduleRelevance: [],
};

// ─── Parser ────────────────────────────────────────────────────────

const ENGINE_SIGNALS_REGEX = /<engine_signals>\s*([\s\S]*?)\s*<\/engine_signals>/;
const CLINICAL_REGEX = /<clinical>\s*([\s\S]*?)\s*<\/clinical>/;

/**
 * Parse an LLM response into user text, engine signals, and clinical block.
 * Gracefully handles missing or malformed blocks.
 */
export function parseEngineResponse(rawResponse: string): ParsedResponse {
  let userText = rawResponse;
  let signals: EngineSignals | null = null;
  let clinicalBlock: string | null = null;

  // 1. Extract clinical block (if present)
  const clinicalMatch = userText.match(CLINICAL_REGEX);
  if (clinicalMatch) {
    clinicalBlock = clinicalMatch[1].trim();
    userText = userText.replace(CLINICAL_REGEX, '').trim();
  }

  // 2. Extract engine_signals block
  const signalsMatch = userText.match(ENGINE_SIGNALS_REGEX);
  if (signalsMatch) {
    userText = userText.replace(ENGINE_SIGNALS_REGEX, '').trim();
    try {
      const parsed = JSON.parse(signalsMatch[1]);
      signals = validateSignals(parsed);
    } catch (e) {
      console.warn('[SignalParser] Failed to parse engine_signals JSON:', e);
      signals = null;
    }
  }

  return {
    userText,
    signals,
    clinicalBlock,
    rawResponse,
  };
}

/**
 * Validate and normalize parsed signals, applying defaults for missing fields.
 */
function validateSignals(raw: any): EngineSignals {
  return {
    persons: Array.isArray(raw.persons)
      ? raw.persons.filter((p: any) => p && typeof p.name === 'string' && p.name.length > 0).map((p: any) => ({
          name: String(p.name),
          relationship: String(p.relationship || 'unknown'),
          valence: ['positive', 'negative', 'ambivalent', 'neutral'].includes(p.valence) ? p.valence : 'neutral',
        }))
      : [],
    triggers: Array.isArray(raw.triggers)
      ? raw.triggers.filter((t: any) => t && typeof t.label === 'string' && t.label.length > 0).map((t: any) => ({
          label: String(t.label),
          confidence: Math.max(0, Math.min(1, Number(t.confidence) || 0)),
          layer: ['state.dat', 'user.dat', 'projections.dat'].includes(t.layer) ? t.layer : 'state.dat',
        }))
      : [],
    schemas: Array.isArray(raw.schemas)
      ? raw.schemas.filter((s: any) => s && typeof s.name === 'string' && s.name.length > 0 && Number(s.confidence) > 0.5).map((s: any) => ({
          name: String(s.name),
          confidence: Math.max(0, Math.min(1, Number(s.confidence) || 0)),
        }))
      : [],
    emotionalShift: typeof raw.emotionalShift === 'string' ? raw.emotionalShift : 'none',
    topicProgression: typeof raw.topicProgression === 'string' ? raw.topicProgression : 'none',
    therapeuticMove: typeof raw.therapeuticMove === 'string' ? raw.therapeuticMove : 'none',
    moduleRelevance: Array.isArray(raw.moduleRelevance)
      ? raw.moduleRelevance.filter((m: any) => m && typeof m.moduleId === 'string').map((m: any) => ({
          moduleId: String(m.moduleId),
          confidence: Math.max(0, Math.min(1, Number(m.confidence) || 0)),
        }))
      : [],
  };
}
