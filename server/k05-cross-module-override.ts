/**
 * K05 CROSS-MODULE OVERRIDE ENGINE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Runtime enforcement: scans Kim's GPT response AFTER generation.
 * Ensures every boundary statement contains a repair path,
 * unless safety-first or RELATIONAL_HARM_PATTERN is active.
 *
 * TWO LAYERS:
 * 1. Deterministic pattern scan (always, cheap)
 * 2. Classification call (only when Layer 1 detects boundary without repair path)
 *
 * OUTPUT CONTRACT of classifier:
 * {
 *   containsBoundaryStatement: boolean,
 *   containsRepairPath: boolean,
 *   requiresCorrection: boolean,
 *   reason: "boundary_without_repair_path" | "no_boundary" | "repair_path_present"
 *           | "safety_exception" | "relational_harm_exception" | "unclear"
 * }
 *
 * The classifier may NOT generate therapeutic text, rewrite content,
 * determine intent, or give advice. It only assesses presence of
 * boundary + repair path.
 */

import { invokeLLM } from './_core/llm';

// ─── Types ─────────────────────────────────────────────────────────────

export interface K05OverrideInput {
  /** The generated Kim response text */
  responseText: string;
  /** Whether safety-first/crisis is active */
  safetyActive: boolean;
  /** Whether RELATIONAL_HARM_PATTERN is active */
  relationalHarmActive: boolean;
  /** The active Kim module that generated the response */
  activeModule: string;
}

export interface ClassificationResult {
  containsBoundaryStatement: boolean;
  containsRepairPath: boolean;
  requiresCorrection: boolean;
  reason:
    | 'boundary_without_repair_path'
    | 'no_boundary'
    | 'repair_path_present'
    | 'safety_exception'
    | 'relational_harm_exception'
    | 'unclear';
}

export interface K05OverrideResult {
  /** Whether the override was applied */
  overrideApplied: boolean;
  /** The (possibly corrected) response text */
  correctedText: string;
  /** Layer 1 scan result */
  layer1: {
    boundaryDetected: boolean;
    repairPathDetected: boolean;
    needsLayer2: boolean;
  };
  /** Layer 2 classification result (null if Layer 2 was not needed) */
  layer2: ClassificationResult | null;
  /** Which correction method was used (null if no correction) */
  correctionMethod: 'deterministic_fallback' | 'deterministic_fallback_distance' | null;
  /** Debug log */
  debugLog: string[];
}

// ─── Layer 1: Deterministic Pattern Scan ───────────────────────────────

const BOUNDARY_SIGNAL_PATTERNS = [
  // NL — boundary / stop / distance / refusal / pause / limit
  'ik wil niet meer', 'ik stop met', 'ik neem afstand', 'ik kan dit niet accepteren',
  'ik weiger', 'ik ga niet meer', 'dit is mijn grens', 'ik trek een grens',
  'ik kan dit niet', 'ik wil dit niet', 'ik doe dit niet meer',
  'ik heb genoeg', 'ik stap eruit', 'ik ga weg', 'ik neem pauze',
  'ik kan niet meer', 'dit gaat te ver', 'dit accepteer ik niet',
  'ik laat dit niet toe', 'ik zeg nee', 'ik bescherm mezelf',
  'ik trek me terug', 'ik neem ruimte', 'ik heb rust nodig',
  // EN
  'i will not', 'i refuse', 'i am taking distance', 'i cannot accept this',
  'this is my boundary', 'i am done', 'i need space', 'i am stepping away',
  'i am taking a break', 'i need to step back', 'i cannot do this anymore',
  'enough is enough', 'i am setting a limit',
];

const REPAIR_PATH_PATTERNS = [
  // NL — invitation / bridge / return / condition for contact
  'wil je', 'wanneer we', 'als er genoeg', 'als er rust is',
  'ik wil wel', 'laten we', 'kunnen we', 'als we allebei',
  'ik wil contact', 'ik wil verbonden', 'ik wil er zijn',
  'als er veiligheid', 'als er eerlijkheid', 'als er respect',
  'om elkaar te horen', 'om dit te bespreken', 'om verder te praten',
  'straks', 'later', 'wanneer het rustiger is', 'wanneer we rustiger zijn',
  'ik wil niet verbreken', 'ik wil niet stoppen met',
  'de deur staat open', 'contact is mogelijk',
  // EN
  'can we', 'when we', 'if there is enough', 'i want to stay connected',
  'let us', 'when it is calmer', 'when we are both', 'i do not want to break',
  'the door is open', 'contact is possible',
];

export function scanLayer1(text: string): { boundaryDetected: boolean; repairPathDetected: boolean; needsLayer2: boolean } {
  const lower = text.toLowerCase();
  const boundaryDetected = BOUNDARY_SIGNAL_PATTERNS.some(p => lower.includes(p));
  const repairPathDetected = REPAIR_PATH_PATTERNS.some(p => lower.includes(p));
  const needsLayer2 = boundaryDetected && !repairPathDetected;
  return { boundaryDetected, repairPathDetected, needsLayer2 };
}

// ─── Layer 2: Classification Call ──────────────────────────────────────

const CLASSIFIER_SYSTEM_PROMPT = `You are a boundary/repair-path classifier. You receive a text and determine:
1. Does it contain a relational boundary statement (a limit, refusal, pause, distance, or stop)?
2. Does it contain a concrete repair path (an invitation, condition, or bridge to safer future contact)?

You may NOT generate therapeutic text, rewrite content, determine intent behind the relationship, or give advice.
You only assess the PRESENCE of boundary + repair path.

Respond with the exact JSON schema provided. Nothing else.`;

export async function classifyLayer2(
  responseText: string,
  safetyActive: boolean,
  relationalHarmActive: boolean,
): Promise<ClassificationResult> {
  // Exception checks BEFORE calling the model
  if (safetyActive) {
    return {
      containsBoundaryStatement: true,
      containsRepairPath: false,
      requiresCorrection: false,
      reason: 'safety_exception',
    };
  }
  if (relationalHarmActive) {
    return {
      containsBoundaryStatement: true,
      containsRepairPath: false,
      requiresCorrection: false,
      reason: 'relational_harm_exception',
    };
  }

  try {
    const result = await invokeLLM({
      messages: [
        { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
        { role: 'user', content: `Classify this text:\n\n${responseText}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'boundary_repair_classification',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              containsBoundaryStatement: { type: 'boolean' },
              containsRepairPath: { type: 'boolean' },
            },
            required: ['containsBoundaryStatement', 'containsRepairPath'],
            additionalProperties: false,
          },
        },
      },
    });

    const content = result.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return { containsBoundaryStatement: true, containsRepairPath: false, requiresCorrection: true, reason: 'unclear' };
    }

    const parsed = JSON.parse(content as string) as { containsBoundaryStatement: boolean; containsRepairPath: boolean };
    const requiresCorrection = parsed.containsBoundaryStatement && !parsed.containsRepairPath;

    return {
      containsBoundaryStatement: parsed.containsBoundaryStatement,
      containsRepairPath: parsed.containsRepairPath,
      requiresCorrection,
      reason: requiresCorrection
        ? 'boundary_without_repair_path'
        : parsed.containsBoundaryStatement
          ? 'repair_path_present'
          : 'no_boundary',
    };
  } catch (error) {
    console.error('[K05-Override] Layer 2 classification failed:', error);
    // On failure, assume correction is needed (safe default)
    return {
      containsBoundaryStatement: true,
      containsRepairPath: false,
      requiresCorrection: true,
      reason: 'unclear',
    };
  }
}

// ─── Correction: Deterministic Fallback ────────────────────────────────

const FALLBACK_REPAIR_PATH =
  '\n\nIk wil contact niet verbreken, maar ik kan dit alleen verder bespreken wanneer er genoeg rust en veiligheid is om elkaar echt te horen.';

const FALLBACK_REPAIR_PATH_DISTANCE =
  '\n\nIk neem nu afstand van dit gesprek, niet om te straffen, maar om te voorkomen dat we elkaar verder beschadigen. Als er later genoeg rust en respect is, kunnen we bekijken of contact opnieuw mogelijk is.';

function containsDistanceIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const distanceMarkers = [
    'ik neem afstand', 'ik ga weg', 'ik stap eruit', 'ik trek me terug',
    'i am taking distance', 'i am stepping away', 'i am leaving',
  ];
  return distanceMarkers.some(m => lower.includes(m));
}

function applyDeterministicCorrection(responseText: string): { correctedText: string; method: 'deterministic_fallback' | 'deterministic_fallback_distance' } {
  if (containsDistanceIntent(responseText)) {
    return {
      correctedText: responseText + FALLBACK_REPAIR_PATH_DISTANCE,
      method: 'deterministic_fallback_distance',
    };
  }
  return {
    correctedText: responseText + FALLBACK_REPAIR_PATH,
    method: 'deterministic_fallback',
  };
}

// ─── Main Override Function ────────────────────────────────────────────

export async function applyK05CrossModuleOverride(input: K05OverrideInput): Promise<K05OverrideResult> {
  const debugLog: string[] = [];
  debugLog.push(`[K05-Override] Module: ${input.activeModule}, Safety: ${input.safetyActive}, Harm: ${input.relationalHarmActive}`);

  // Exception: safety-first — no correction
  if (input.safetyActive) {
    debugLog.push('[K05-Override] Safety active → skip override');
    return {
      overrideApplied: false,
      correctedText: input.responseText,
      layer1: { boundaryDetected: false, repairPathDetected: false, needsLayer2: false },
      layer2: { containsBoundaryStatement: false, containsRepairPath: false, requiresCorrection: false, reason: 'safety_exception' },
      correctionMethod: null,
      debugLog,
    };
  }

  // Exception: relational harm pattern — no forced connection
  if (input.relationalHarmActive) {
    debugLog.push('[K05-Override] Relational harm active → skip override (boundary without bridge is temporarily correct)');
    return {
      overrideApplied: false,
      correctedText: input.responseText,
      layer1: { boundaryDetected: false, repairPathDetected: false, needsLayer2: false },
      layer2: { containsBoundaryStatement: false, containsRepairPath: false, requiresCorrection: false, reason: 'relational_harm_exception' },
      correctionMethod: null,
      debugLog,
    };
  }

  // Layer 1: Deterministic pattern scan
  const layer1 = scanLayer1(input.responseText);
  debugLog.push(`[K05-Override] Layer 1: boundary=${layer1.boundaryDetected}, repairPath=${layer1.repairPathDetected}, needsLayer2=${layer1.needsLayer2}`);

  if (!layer1.needsLayer2) {
    // No boundary detected, or boundary + repair path both present → no correction needed
    return {
      overrideApplied: false,
      correctedText: input.responseText,
      layer1,
      layer2: null,
      correctionMethod: null,
      debugLog,
    };
  }

  // Layer 2: Classification call (only when Layer 1 detected boundary without repair path)
  debugLog.push('[K05-Override] Layer 1 triggered → calling Layer 2 classifier');
  const layer2 = await classifyLayer2(input.responseText, input.safetyActive, input.relationalHarmActive);
  debugLog.push(`[K05-Override] Layer 2: boundary=${layer2.containsBoundaryStatement}, repairPath=${layer2.containsRepairPath}, correction=${layer2.requiresCorrection}, reason=${layer2.reason}`);

  if (!layer2.requiresCorrection) {
    // Classifier says no correction needed (maybe it found a repair path Layer 1 missed)
    debugLog.push('[K05-Override] Layer 2 says no correction needed');
    return {
      overrideApplied: false,
      correctedText: input.responseText,
      layer1,
      layer2,
      correctionMethod: null,
      debugLog,
    };
  }

  // Correction: apply deterministic fallback
  debugLog.push('[K05-Override] Applying deterministic correction');
  const { correctedText, method } = applyDeterministicCorrection(input.responseText);
  debugLog.push(`[K05-Override] Correction applied: ${method}`);

  return {
    overrideApplied: true,
    correctedText,
    layer1,
    layer2,
    correctionMethod: method,
    debugLog,
  };
}
