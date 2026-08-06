/**
 * KO1 — Recognition & Validation Module (Kim Only)
 *
 * Canon: RECOFREE_KO1_RECOGNITION_AND_VALIDATION_FINAL_CANON_ENDSTATE
 *
 * Core principle: "Recognition without boundaries becomes enabling.
 * Boundaries without recognition become rejection. Healthy care requires both."
 *
 * Primary sequence: Recognition → Validation → Boundary → Next safe step.
 * Kim = boundary-first.
 *
 * This module provides:
 * 1. KO1 pattern detection (lying/manipulation, hypervigilance, reassurance addiction, ghosting, burnout)
 * 2. Six validation levels (L1-L6) mapped to Kim's recognition sequence
 * 3. Routing logic with safety gating
 * 4. Prompt injection block builder
 * 5. Session state and progress tracking
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type KO1ValidationLevel = 'L1_PRESENCE' | 'L2_REFLECTION' | 'L3_EMOTION_RECOGNITION' | 'L4_CONTEXT_VALIDATION' | 'L5_NORMALIZATION' | 'L6_RADICAL_GENUINENESS';

export type KO1PatternId =
  | 'LYING_MANIPULATION'
  | 'HYPERVIGILANCE'
  | 'REASSURANCE_ADDICTION'
  | 'BURNOUT_RED_STATE'
  | 'GHOSTING'
  | 'SELF_ERASURE'
  | 'GUILT_COMPLIANCE'
  | 'RESCUE_FIRST'
  | 'CONFLICT_ESCALATION'
  | 'COMPASSION_WITHOUT_BOUNDARY';

export type KO1ResponseMode =
  | 'RECOGNITION_FIRST'
  | 'BOUNDARY_FIRST'
  | 'REGULATE_FIRST'
  | 'CONTROLLED_CONFRONTATION'
  | 'PAUSE_AND_DISTANCE'
  | 'REDUCE_DEPENDENCY'
  | 'CO_REGULATION';

export interface KO1Signal {
  patternId: KO1PatternId;
  confidence: number;
  evidence: string;
}

export interface KO1DetectionResult {
  signals: KO1Signal[];
  dominantPattern: KO1PatternId | null;
  dominantConfidence: number;
}

export interface KO1Decision {
  activated: boolean;
  validationLevel: KO1ValidationLevel;
  responseMode: KO1ResponseMode;
  dominantPattern: KO1PatternId | null;
  reason: string;
  julesRuleActive: boolean;
  boundaryOverride: boolean;
}

export interface KO1EngineResult {
  activated: boolean;
  decision: KO1Decision;
  promptBlock: string | null;
}

export interface KO1Progress {
  lastPatternDetected: KO1PatternId | null;
  lastSessionDate: string | null;
  validationPreferences: KO1ValidationLevel[];
  repairPatterns: string[];
  burnoutSignalCount: number;
  reassuranceLoopCount: number;
}

export interface KO1EngineInput {
  message: string;
  userType: string;
  vspLevel: string;
  crisisLevel: number;
  frustrationScore: number;
  eigenRegieScore: number | null;
  hasChildren: boolean;
  sessionMessageCount: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export const ALL_KO1_VALIDATION_LEVELS: readonly KO1ValidationLevel[] = [
  'L1_PRESENCE', 'L2_REFLECTION', 'L3_EMOTION_RECOGNITION',
  'L4_CONTEXT_VALIDATION', 'L5_NORMALIZATION', 'L6_RADICAL_GENUINENESS',
] as const;

export function createDefaultKO1Progress(): KO1Progress {
  return {
    lastPatternDetected: null,
    lastSessionDate: null,
    validationPreferences: [],
    repairPatterns: [],
    burnoutSignalCount: 0,
    reassuranceLoopCount: 0,
  };
}

// ─── Pattern Markers (deterministic detection) ─────────────────────────────

const LYING_MANIPULATION_MARKERS = [
  'lying', 'lied', 'manipulate', 'manipulating', 'deceive', 'deceived',
  'hiding', 'secret', 'caught', 'found out', 'not telling the truth',
  'covering up', 'gaslighting', 'denying', 'twisting',
  // Dutch
  'liegt', 'gelogen', 'manipuleert', 'bedriegt', 'bedrogen', 'verbergt',
  'geheim', 'betrapt', 'ontdekt', 'liegt tegen', 'verdraait', 'ontkent',
];

const HYPERVIGILANCE_MARKERS = [
  'checking', 'checking phone', 'monitoring', 'watching', 'suspicious',
  'tracking', 'following', 'spying', 'controlling', 'cant stop checking',
  'need to know', 'where is he', 'where is she', 'what is he doing',
  // Dutch
  'controleren', 'telefoon checken', 'in de gaten houden', 'achterdochtig',
  'volgen', 'bespioneren', 'kan niet stoppen met checken', 'waar is hij',
  'waar is zij', 'wat doet hij', 'wat doet zij',
];

const REASSURANCE_MARKERS = [
  'promise me', 'tell me it will be ok', 'are you sure', 'will it be fine',
  'do you think', 'what if it happens again', 'i need to hear',
  'just tell me', 'reassure me', 'say it again',
  // Dutch
  'beloof me', 'zeg dat het goed komt', 'weet je het zeker', 'komt het goed',
  'denk je', 'wat als het weer gebeurt', 'ik moet het horen',
  'zeg het nog eens', 'stel me gerust',
];

const BURNOUT_MARKERS = [
  'cant do this anymore', 'exhausted', 'done', 'give up', 'no energy',
  'burned out', 'nothing left', 'empty', 'depleted', 'breaking point',
  'falling apart', 'cant keep going', 'too much',
  // Dutch
  'kan niet meer', 'uitgeput', 'klaar', 'geef het op', 'geen energie',
  'opgebrand', 'niets meer over', 'leeg', 'breekpunt', 'val uit elkaar',
  'kan niet doorgaan', 'te veel',
];

const GHOSTING_MARKERS = [
  'disappeared', 'not responding', 'no contact', 'gone silent',
  'ignoring me', 'vanished', 'ghosting', 'radio silence', 'no answer',
  // Dutch
  'verdwenen', 'reageert niet', 'geen contact', 'stil', 'negeert me',
  'weg', 'geen antwoord', 'radiostilte',
];

const SELF_ERASURE_MARKERS = [
  'my needs dont matter', 'i should just accept', 'its my fault',
  'i deserve this', 'i should try harder', 'maybe im too demanding',
  'i should be more patient', 'its not that bad',
  // Dutch
  'mijn behoeften doen er niet toe', 'ik moet het maar accepteren',
  'het is mijn schuld', 'ik verdien dit', 'ik moet harder proberen',
  'misschien ben ik te veeleisend', 'ik moet geduldiger zijn', 'het valt wel mee',
];

const GUILT_COMPLIANCE_MARKERS = [
  'feel guilty', 'cant say no', 'he needs me', 'she needs me',
  'if i leave', 'its my responsibility', 'who else will help',
  'i owe', 'cant abandon',
  // Dutch
  'voel me schuldig', 'kan geen nee zeggen', 'hij heeft me nodig',
  'zij heeft me nodig', 'als ik wegga', 'het is mijn verantwoordelijkheid',
  'wie anders helpt', 'ik ben het verschuldigd', 'kan niet achterlaten',
];

const RESCUE_FIRST_MARKERS = [
  'i need to save', 'fix this for', 'make it better for',
  'take care of', 'protect from themselves', 'if i just try harder',
  'one more chance', 'this time will be different',
  // Dutch
  'ik moet redden', 'oplossen voor', 'beter maken voor',
  'zorgen voor', 'beschermen tegen zichzelf', 'als ik harder probeer',
  'nog een kans', 'dit keer wordt het anders',
];

const CONFLICT_ESCALATION_MARKERS = [
  'going to tell', 'going to confront', 'send the message',
  'had enough', 'going to explode', 'cant hold back',
  'going to say everything', 'ultimatum',
  // Dutch
  'ga het zeggen', 'ga confronteren', 'stuur het bericht',
  'heb er genoeg van', 'ga ontploffen', 'kan me niet inhouden',
  'ga alles zeggen', 'ultimatum',
];

const COMPASSION_NO_BOUNDARY_MARKERS = [
  'but i understand why', 'its the addiction', 'not really their fault',
  'they cant help it', 'i should be more understanding',
  'maybe i overreacted', 'they had a hard childhood',
  // Dutch
  'maar ik begrijp waarom', 'het is de verslaving', 'niet echt hun schuld',
  'ze kunnen er niets aan doen', 'ik moet meer begrip hebben',
  'misschien reageerde ik overdreven', 'ze hadden een moeilijke jeugd',
];

// ─── Detector ──────────────────────────────────────────────────────────────

function detectPattern(message: string, markers: string[]): { found: boolean; evidence: string } {
  const lower = message.toLowerCase();
  const match = markers.find(m => lower.includes(m));
  return match ? { found: true, evidence: match } : { found: false, evidence: '' };
}

export function detectKO1Patterns(message: string): KO1DetectionResult {
  const signals: KO1Signal[] = [];

  const patterns: Array<{ id: KO1PatternId; markers: string[]; baseConfidence: number }> = [
    { id: 'LYING_MANIPULATION', markers: LYING_MANIPULATION_MARKERS, baseConfidence: 0.80 },
    { id: 'HYPERVIGILANCE', markers: HYPERVIGILANCE_MARKERS, baseConfidence: 0.75 },
    { id: 'REASSURANCE_ADDICTION', markers: REASSURANCE_MARKERS, baseConfidence: 0.70 },
    { id: 'BURNOUT_RED_STATE', markers: BURNOUT_MARKERS, baseConfidence: 0.85 },
    { id: 'GHOSTING', markers: GHOSTING_MARKERS, baseConfidence: 0.75 },
    { id: 'SELF_ERASURE', markers: SELF_ERASURE_MARKERS, baseConfidence: 0.80 },
    { id: 'GUILT_COMPLIANCE', markers: GUILT_COMPLIANCE_MARKERS, baseConfidence: 0.75 },
    { id: 'RESCUE_FIRST', markers: RESCUE_FIRST_MARKERS, baseConfidence: 0.80 },
    { id: 'CONFLICT_ESCALATION', markers: CONFLICT_ESCALATION_MARKERS, baseConfidence: 0.85 },
    { id: 'COMPASSION_WITHOUT_BOUNDARY', markers: COMPASSION_NO_BOUNDARY_MARKERS, baseConfidence: 0.70 },
  ];

  for (const p of patterns) {
    const result = detectPattern(message, p.markers);
    if (result.found) {
      signals.push({ patternId: p.id, confidence: p.baseConfidence, evidence: result.evidence });
    }
  }

  // Sort by confidence descending
  signals.sort((a, b) => b.confidence - a.confidence);

  return {
    signals,
    dominantPattern: signals.length > 0 ? signals[0].patternId : null,
    dominantConfidence: signals.length > 0 ? signals[0].confidence : 0,
  };
}

// ─── Router ────────────────────────────────────────────────────────────────

// Session state tracking
let sessionKO1PatternsUsed: KO1PatternId[] = [];

export function resetKO1SessionState(): void {
  sessionKO1PatternsUsed = [];
}

export function getSessionKO1PatternsUsed(): KO1PatternId[] {
  return [...sessionKO1PatternsUsed];
}

function resolveValidationLevel(vspLevel: string, frustrationScore: number): KO1ValidationLevel {
  // Higher frustration/VSP → lower validation level (presence only)
  if (vspLevel === 'ROOD' || vspLevel === 'PAARS' || frustrationScore >= 8) {
    return 'L1_PRESENCE';
  }
  if (vspLevel === 'ORANJE' || frustrationScore >= 6) {
    return 'L2_REFLECTION';
  }
  if (vspLevel === 'GEEL' || frustrationScore >= 4) {
    return 'L3_EMOTION_RECOGNITION';
  }
  if (frustrationScore >= 2) {
    return 'L4_CONTEXT_VALIDATION';
  }
  return 'L5_NORMALIZATION';
}

function resolveResponseMode(pattern: KO1PatternId | null, vspLevel: string, crisisLevel: number): KO1ResponseMode {
  // Crisis override
  if (crisisLevel >= 2 || vspLevel === 'ROOD' || vspLevel === 'PAARS') {
    return 'BOUNDARY_FIRST';
  }

  if (!pattern) return 'RECOGNITION_FIRST';

  switch (pattern) {
    case 'LYING_MANIPULATION':
      return 'CONTROLLED_CONFRONTATION';
    case 'HYPERVIGILANCE':
      return 'REDUCE_DEPENDENCY';
    case 'REASSURANCE_ADDICTION':
      return 'REDUCE_DEPENDENCY';
    case 'BURNOUT_RED_STATE':
      return 'PAUSE_AND_DISTANCE';
    case 'GHOSTING':
      return 'REGULATE_FIRST';
    case 'SELF_ERASURE':
      return 'BOUNDARY_FIRST';
    case 'GUILT_COMPLIANCE':
      return 'BOUNDARY_FIRST';
    case 'RESCUE_FIRST':
      return 'BOUNDARY_FIRST';
    case 'CONFLICT_ESCALATION':
      return 'REGULATE_FIRST';
    case 'COMPASSION_WITHOUT_BOUNDARY':
      return 'RECOGNITION_FIRST';
    default:
      return 'RECOGNITION_FIRST';
  }
}

export function routeKO1Engine(input: KO1EngineInput, progress: KO1Progress): KO1EngineResult {
  // ─── Gate: Kim only ──────────────────────────────────────────────────────
  if (input.userType !== 'kim') {
    return {
      activated: false,
      decision: {
        activated: false,
        validationLevel: 'L1_PRESENCE',
        responseMode: 'RECOGNITION_FIRST',
        dominantPattern: null,
        reason: 'KO1 is Kim-only module',
        julesRuleActive: false,
        boundaryOverride: false,
      },
      promptBlock: null,
    };
  }

  // ─── Detect patterns ─────────────────────────────────────────────────────
  const detection = detectKO1Patterns(input.message);

  if (detection.signals.length === 0) {
    return {
      activated: false,
      decision: {
        activated: false,
        validationLevel: resolveValidationLevel(input.vspLevel, input.frustrationScore),
        responseMode: 'RECOGNITION_FIRST',
        dominantPattern: null,
        reason: 'No KO1 patterns detected',
        julesRuleActive: false,
        boundaryOverride: false,
      },
      promptBlock: null,
    };
  }

  // ─── Resolve validation level ────────────────────────────────────────────
  const validationLevel = resolveValidationLevel(input.vspLevel, input.frustrationScore);

  // ─── Resolve response mode ───────────────────────────────────────────────
  const responseMode = resolveResponseMode(detection.dominantPattern, input.vspLevel, input.crisisLevel);

  // ─── Jules Rule: co-regulation first when children involved ──────────────
  const julesRuleActive = input.hasChildren && (
    detection.dominantPattern === 'CONFLICT_ESCALATION' ||
    detection.dominantPattern === 'BURNOUT_RED_STATE' ||
    input.crisisLevel >= 2
  );

  // ─── Boundary override: when safety requires boundary above recognition ─
  const boundaryOverride = (
    input.crisisLevel >= 2 ||
    input.vspLevel === 'ROOD' ||
    input.vspLevel === 'PAARS' ||
    detection.dominantPattern === 'SELF_ERASURE' ||
    detection.dominantPattern === 'GUILT_COMPLIANCE'
  );

  // ─── Track session usage ─────────────────────────────────────────────────
  if (detection.dominantPattern) {
    sessionKO1PatternsUsed.push(detection.dominantPattern);
  }

  // ─── Build prompt block ──────────────────────────────────────────────────
  const promptBlock = buildKO1PromptBlock(
    detection.dominantPattern!,
    validationLevel,
    responseMode,
    julesRuleActive,
    boundaryOverride,
  );

  const decision: KO1Decision = {
    activated: true,
    validationLevel,
    responseMode,
    dominantPattern: detection.dominantPattern,
    reason: `KO1 pattern=${detection.dominantPattern} conf=${detection.dominantConfidence.toFixed(2)} mode=${responseMode}`,
    julesRuleActive,
    boundaryOverride,
  };

  return {
    activated: true,
    decision,
    promptBlock,
  };
}

// ─── Prompt Builder ────────────────────────────────────────────────────────
// Budget: max 5 lines + wrapper. Compact injection for GPT context window.

function buildKO1PromptBlock(
  pattern: KO1PatternId,
  validationLevel: KO1ValidationLevel,
  responseMode: KO1ResponseMode,
  julesRuleActive: boolean,
  boundaryOverride: boolean,
): string {
  const lines: string[] = [
    `[KO1_RECOGNITION_VALIDATION]`,
    `Sequence: recognition → validation → system pattern → perspective opening → boundary as bridge → next safe contact step`,
    `Pattern: ${formatPattern(pattern)} | Validation: ${formatValidationLevel(validationLevel)} | Mode: ${formatResponseMode(responseMode)}`,
  ];

  if (boundaryOverride) {
    lines.push(`OVERRIDE: Safety above connection. Self-protection priority. No perspective shift required.`);
  }

  if (julesRuleActive) {
    lines.push(`JULES RULE: Co-regulation first. Child safety is higher-order override.`);
  }

  // Pattern-specific forbidden behaviors
  const forbidden = getForbiddenBehavior(pattern);
  if (forbidden) {
    lines.push(`Forbidden: ${forbidden}`);
  }

  // Relational stance inheritance: perspective shift + connection
  if (!boundaryOverride && !julesRuleActive) {
    lines.push(`RELATIONAL STANCE: After validating the caregiver, check whether the response risks increasing distance or resentment. If no safety risk, include one sentence that keeps curiosity about the other person alive. Example: "What do you think the other person might be trying to say underneath that reaction?"`);
    lines.push(`FORBIDDEN FRAMING: Never frame the other person as attacker, manipulator, or enemy. Name the pattern, not the person.`);
  }

  lines.push(`[/KO1_RECOGNITION_VALIDATION]`);
  return lines.join('\n');
}

function formatPattern(pattern: KO1PatternId): string {
  const map: Record<KO1PatternId, string> = {
    'LYING_MANIPULATION': 'lying/manipulation detected → recognition first, then controlled confrontation',
    'HYPERVIGILANCE': 'hypervigilance → validate fear, distinguish safety from anxiety',
    'REASSURANCE_ADDICTION': 'reassurance loop → recognize fear, validate, reduce dependency',
    'BURNOUT_RED_STATE': 'burnout/red state → pause, distance, support, self-protection',
    'GHOSTING': 'ghosting → regulate Kim first, one healthy contact attempt, no chasing',
    'SELF_ERASURE': 'self-erasure → boundary-first, restore self-worth',
    'GUILT_COMPLIANCE': 'guilt compliance → boundary-first, responsibility with right person',
    'RESCUE_FIRST': 'rescue impulse → boundary-first, separate care from rescue',
    'CONFLICT_ESCALATION': 'conflict escalation → regulate first, do not send from this state',
    'COMPASSION_WITHOUT_BOUNDARY': 'compassion without boundary → recognition + add boundary',
  };
  return map[pattern] ?? pattern;
}

function formatValidationLevel(level: KO1ValidationLevel): string {
  const map: Record<KO1ValidationLevel, string> = {
    'L1_PRESENCE': 'L1 Presence (be here, hold space)',
    'L2_REFLECTION': 'L2 Reflection (mirror back what was said)',
    'L3_EMOTION_RECOGNITION': 'L3 Emotion Recognition (name the feeling)',
    'L4_CONTEXT_VALIDATION': 'L4 Context Validation (makes sense given history)',
    'L5_NORMALIZATION': 'L5 Normalization (anyone would feel this)',
    'L6_RADICAL_GENUINENESS': 'L6 Radical Genuineness (full authentic presence)',
  };
  return map[level] ?? level;
}

function formatResponseMode(mode: KO1ResponseMode): string {
  const map: Record<KO1ResponseMode, string> = {
    'RECOGNITION_FIRST': 'recognize → validate → boundary → next step',
    'BOUNDARY_FIRST': 'boundary above relationship preservation',
    'REGULATE_FIRST': 'regulate activation before any action',
    'CONTROLLED_CONFRONTATION': 'recognition → confrontation → boundary → safe step',
    'PAUSE_AND_DISTANCE': 'pause, distance, support, self-protection',
    'REDUCE_DEPENDENCY': 'recognize fear → validate → reduce dependency → action',
    'CO_REGULATION': 'co-regulation first, then boundary',
  };
  return map[mode] ?? mode;
}

function getForbiddenBehavior(pattern: KO1PatternId): string | null {
  const map: Record<KO1PatternId, string> = {
    'LYING_MANIPULATION': 'Never validate lying/manipulation/harmful behavior. Validate emotion only.',
    'HYPERVIGILANCE': 'Never encourage compulsive checking or panic surveillance.',
    'REASSURANCE_ADDICTION': 'Never feed reassurance loop. Validate fear, then return to action/boundary.',
    'BURNOUT_RED_STATE': 'Never ask Kim to absorb more. Boundary above relationship preservation.',
    'GHOSTING': 'Never encourage chasing. One healthy contact attempt max.',
    'SELF_ERASURE': 'Never enable self-erasure through compassion. Restore boundary.',
    'GUILT_COMPLIANCE': 'Never use guilt to maintain compliance. Responsibility with right person.',
    'RESCUE_FIRST': 'Never support rescue-first. Separate care from rescue.',
    'CONFLICT_ESCALATION': 'Never support sending from activated state. Regulate first.',
    'COMPASSION_WITHOUT_BOUNDARY': 'Never let understanding excuse impact. Mentalizing explains, does not excuse.',
  };
  return map[pattern] ?? null;
}
