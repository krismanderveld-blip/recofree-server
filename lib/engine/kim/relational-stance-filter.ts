/**
 * ══════════════════════════════════════════════════════════════════════════
 * KIM RELATIONAL STANCE FILTER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Runs BEFORE every non-crisis Kim response.
 * Determines what relational guardrails must be applied to the GPT output.
 *
 * This filter does NOT generate text. It produces directives that are
 * injected into the GPT prompt so the model formulates within bounds.
 *
 * Core principle: Kim validates the caregiver without polarizing against
 * the person with addiction. Boundaries are bridges, not walls.
 * Perspective curiosity is mandatory unless safety overrides.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RelationalStanceFilterInput {
  /** Currently selected Kim module (e.g. 'K01', 'KO1', 'K02', 'KDL01') */
  selectedModule: string;
  /** Current safety level from pipeline */
  safetyLevel: 'none' | 'mild' | 'elevated' | 'crisis';
  /** User distress level (0-100 from zone system) */
  userDistress: number;
  /** Whether the current message contains relationship conflict signals */
  relationshipConflictSignal: boolean;
  /** Whether the module's response is likely to contain boundary advice */
  boundaryAdvicePresent: boolean;
  /** Whether the response risks judging/blaming the partner */
  partnerJudgmentRisk: boolean;
  /** Whether the response risks advising distance/separation */
  distanceAdviceRisk: boolean;
  /** Whether there is an opportunity to strengthen connection */
  connectionOpportunity: boolean;
}

export interface RelationalStanceFilterOutput {
  /** Whether the response is allowed to proceed */
  allowResponse: boolean;
  /** Whether a perspective shift toward the other person is required */
  requirePerspectiveShift: boolean;
  /** Whether boundary advice must include a reconnection path */
  requireBridgeBoundary: boolean;
  /** Whether blame/judgment language toward the partner must be blocked */
  blockBlameLanguage: boolean;
  /** Whether distance/separation advice must be blocked */
  blockDistanceAdvice: boolean;
  /** Whether safety override takes precedence (no relational processing) */
  requireSafetyOverride: boolean;
  /** Compiled GPT instruction block based on filter decisions */
  gptDirective: string;
}

// ─── Safety-level check ────────────────────────────────────────────────────

function isSafetyActive(safetyLevel: string): boolean {
  return safetyLevel === 'crisis' || safetyLevel === 'elevated';
}

// ─── Conflict signal detection helpers ─────────────────────────────────────

const CONFLICT_KEYWORDS = [
  // NL
  'ruzie', 'boos op', 'kwaad op', 'onder druk', 'manipuleert', 'liegt',
  'vertrouw', 'bedrogen', 'oneerlijk', 'schreeuwt', 'dreigt', 'controleert',
  'negeert', 'afstand', 'breuk', 'scheiding', 'weggaan', 'verlaten',
  'schuld', 'beschuldigt', 'verwijt', 'conflict', 'escaleer',
  // EN
  'angry at', 'fight', 'argue', 'pressure', 'manipulate', 'lying',
  'trust', 'betrayed', 'unfair', 'yelling', 'threatening', 'controlling',
  'ignoring', 'distance', 'break', 'separation', 'leaving', 'abandoned',
  'blame', 'accuse', 'conflict', 'escalat',
  // FR
  'dispute', 'colère', 'pression', 'manipule', 'ment', 'confiance',
  'trahi', 'injuste', 'crie', 'menace', 'contrôle', 'ignore',
];

const BOUNDARY_KEYWORDS = [
  'grens', 'boundary', 'limit', 'genoeg', 'enough', 'stop',
  'niet meer', 'no more', 'afstand', 'distance', 'space',
  'weiger', 'refuse', 'limite', 'frontière',
];

const BLAME_RISK_KEYWORDS = [
  'doet mij aan', 'doing to me', 'zijn schuld', 'haar schuld',
  'his fault', 'her fault', 'maakt mij kapot', 'destroying me',
  'zet mij onder druk', 'putting pressure', 'niet eerlijk',
  'unfair', 'manipuleert mij', 'manipulating me',
];

const DISTANCE_RISK_KEYWORDS = [
  'weggaan', 'leave', 'vertrekken', 'go away', 'contact verbreken',
  'cut contact', 'afstand nemen', 'take distance', 'loslaten',
  'let go', 'scheiden', 'separate', 'eruit', 'get out',
];

// ─── Detect signals from user message ──────────────────────────────────────

export function detectRelationalSignals(userMessage: string): {
  relationshipConflictSignal: boolean;
  boundaryAdvicePresent: boolean;
  partnerJudgmentRisk: boolean;
  distanceAdviceRisk: boolean;
  connectionOpportunity: boolean;
} {
  const lower = userMessage.toLowerCase();

  const relationshipConflictSignal = CONFLICT_KEYWORDS.some(kw => lower.includes(kw));
  const boundaryAdvicePresent = BOUNDARY_KEYWORDS.some(kw => lower.includes(kw));
  const partnerJudgmentRisk = BLAME_RISK_KEYWORDS.some(kw => lower.includes(kw));
  const distanceAdviceRisk = DISTANCE_RISK_KEYWORDS.some(kw => lower.includes(kw));
  // Connection opportunity: conflict present but no safety issue
  const connectionOpportunity = relationshipConflictSignal && !distanceAdviceRisk;

  return {
    relationshipConflictSignal,
    boundaryAdvicePresent,
    partnerJudgmentRisk,
    distanceAdviceRisk,
    connectionOpportunity,
  };
}

// ─── Main Filter ───────────────────────────────────────────────────────────

export function applyRelationalStanceFilter(input: RelationalStanceFilterInput): RelationalStanceFilterOutput {
  const safetyActive = isSafetyActive(input.safetyLevel);

  // Rule 1: Safety override
  if (safetyActive) {
    return {
      allowResponse: true,
      requirePerspectiveShift: false,
      requireBridgeBoundary: false,
      blockBlameLanguage: true, // Even in safety: no character judgment
      blockDistanceAdvice: false, // Safety may require distance
      requireSafetyOverride: true,
      gptDirective: buildSafetyDirective(),
    };
  }

  // Non-crisis path: apply relational guardrails
  const requirePerspectiveShift = input.relationshipConflictSignal;
  const requireBridgeBoundary = input.boundaryAdvicePresent;
  const blockBlameLanguage = input.partnerJudgmentRisk;
  const blockDistanceAdvice = input.distanceAdviceRisk;

  const gptDirective = buildRelationalDirective({
    requirePerspectiveShift,
    requireBridgeBoundary,
    blockBlameLanguage,
    blockDistanceAdvice,
    connectionOpportunity: input.connectionOpportunity,
  });

  return {
    allowResponse: true,
    requirePerspectiveShift,
    requireBridgeBoundary,
    blockBlameLanguage,
    blockDistanceAdvice,
    requireSafetyOverride: false,
    gptDirective,
  };
}

// ─── Directive Builders ────────────────────────────────────────────────────

function buildSafetyDirective(): string {
  return [
    `[RELATIONAL_STANCE_FILTER: SAFETY OVERRIDE]`,
    `Safety comes before connection. Name the danger without character judgment.`,
    `No relational commands. No deep exploration. Stabilize and offer concrete next step.`,
    `Do NOT judge the other person. Do NOT say "they are dangerous/toxic/abusive."`,
    `DO say: "Right now safety comes before connection. You should not face this risk alone."`,
    `[/RELATIONAL_STANCE_FILTER]`,
  ].join('\n');
}

function buildRelationalDirective(flags: {
  requirePerspectiveShift: boolean;
  requireBridgeBoundary: boolean;
  blockBlameLanguage: boolean;
  blockDistanceAdvice: boolean;
  connectionOpportunity: boolean;
}): string {
  const lines: string[] = [`[RELATIONAL_STANCE_FILTER]`];

  // Always active: core relational stance
  lines.push(`Kim validates the user without making the other person the enemy.`);
  lines.push(`Kim names patterns, not villains. Kim sees the relationship as a system.`);

  if (flags.requirePerspectiveShift) {
    lines.push(`PERSPECTIVE SHIFT REQUIRED: After validating the user, include one sentence that opens curiosity about what the other person might be feeling or trying to communicate underneath their behavior (fear, shame, pain, loss of control). Example: "What do you think the other person might be trying to say underneath that reaction?"`);
  }

  if (flags.requireBridgeBoundary) {
    lines.push(`BRIDGE BOUNDARY REQUIRED: Any boundary advice must include a path to reconnection. Structure: care/context + own need + own limit + own action + reconnection path. Example: "I want to stay connected, but I can only do that when the conversation stays calm. If it escalates, I will pause and come back to it when we are both calmer."`);
  }

  if (flags.blockBlameLanguage) {
    lines.push(`BLAME LANGUAGE BLOCKED: Do NOT say "the other person is putting pressure on you", "this is not fair of them", "they are manipulating you", "they are making you feel this way." Instead name the PATTERN: "this pattern puts you under pressure", "this dynamic is exhausting for you."`);
  }

  if (flags.blockDistanceAdvice) {
    lines.push(`DISTANCE ADVICE BLOCKED: Do NOT advise to leave, separate, cut contact, or take distance as a solution. Instead explore: "What would you need to feel safe enough to stay in contact?" If the user themselves wants distance, validate their autonomy without reinforcing it as the only option.`);
  }

  if (flags.connectionOpportunity) {
    lines.push(`CONNECTION OPPORTUNITY: Include one sentence that keeps the possibility of connection alive. Example: "Even in this difficult moment, the fact that you are thinking about this relationship shows something important about what it means to you."`);
  }

  lines.push(`RESPONSE CHECKLIST: 1) Validates without polarizing. 2) Names pattern not person. 3) Contains perspective space. 4) Boundaries as bridge. 5) No relational decisions. 6) No fixed person names. 7) No diagnosis. 8) No moral judgment.`);
  lines.push(`[/RELATIONAL_STANCE_FILTER]`);

  return lines.join('\n');
}
