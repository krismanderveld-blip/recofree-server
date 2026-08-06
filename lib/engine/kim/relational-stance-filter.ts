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
 * Perspective curiosity is mandatory unless safety or relational harm pattern overrides.
 *
 * THREE LEVELS:
 * 1. Normal relational friction → perspective shift + bridge boundaries
 * 2. RELATIONAL_HARM_PATTERN → harm validation first, perspective only after conditions
 * 3. Safety/crisis → safety override, no relational processing
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
  /** HARM LAYER: Whether repeated betrayal signals are present */
  repeatedBetrayalSignal?: boolean;
  /** HARM LAYER: Whether repeated boundary violation signals are present */
  repeatedBoundaryViolationSignal?: boolean;
  /** HARM LAYER: Whether chronic trust damage signals are present */
  chronicTrustDamageSignal?: boolean;
  /** HARM LAYER: Whether the user is already over-empathizing with the other */
  userAlreadyOverEmpathizing?: boolean;
  /** HARM LAYER: Whether there is risk of minimizing the user's pain */
  minimizationRisk?: boolean;
  /** HARM LAYER: Combined signal — relational harm pattern detected */
  relationalHarmPatternSignal?: boolean;
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
  /** HARM LAYER: Whether harm validation must come first */
  requireHarmValidationFirst: boolean;
  /** HARM LAYER: Whether early perspective shift is blocked */
  blockEarlyPerspectiveShift: boolean;
  /** HARM LAYER: Whether repair conditions must be stated */
  requireRepairConditions: boolean;
  /** HARM LAYER: Whether accountability (without shame) must be included */
  requireAccountabilityWithoutShame: boolean;
  /** HARM LAYER: Whether connection is only allowed after validation */
  allowConnectionOnlyAfterValidation: boolean;
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

// ─── RELATIONAL HARM PATTERN keywords ──────────────────────────────────────

const REPEATED_BETRAYAL_KEYWORDS = [
  // NL
  'opnieuw vreemdgegaan', 'weer vreemdgegaan', 'niet de eerste keer',
  'opnieuw bedrogen', 'weer bedrogen', 'herhaald bedrog',
  'opnieuw ontrouw', 'weer ontrouw', 'telkens opnieuw',
  // EN
  'cheated again', 'not the first time', 'repeated betrayal',
  'again unfaithful', 'keeps cheating',
];

const REPEATED_LYING_KEYWORDS = [
  // NL
  'telkens leugens', 'steeds opnieuw leugens', 'weer gelogen',
  'opnieuw gelogen', 'blijft liegen', 'herhaald liegen',
  'zegt telkens', 'belooft telkens', 'de laatste keer',
  'steeds opnieuw beloven', 'telkens beloven en verbreken',
  // EN
  'keeps lying', 'lies again', 'repeated lying', 'always promises',
  'breaks promises again',
];

const REPEATED_BOUNDARY_VIOLATION_KEYWORDS = [
  // NL
  'gaat telkens over mijn grens', 'respecteert mijn grens niet',
  'negeert mijn grens', 'overschrijdt telkens', 'herhaald grensoverschrijdend',
  'steeds opnieuw over mijn grens', 'telkens opnieuw dezelfde grens',
  // EN
  'keeps crossing my boundary', 'ignores my boundary',
  'repeatedly violates', 'crosses the line again',
];

const CHRONIC_TRUST_DAMAGE_KEYWORDS = [
  // NL
  'vertrouw niets meer', 'vertrouwen is weg', 'vertrouwen kapot',
  'structureel vertrouwen', 'vertrouwen beschadigd', 'kan niets meer geloven',
  'weet niet meer wat ik moet geloven', 'geloof er niets meer van',
  'telkens opnieuw raakt', 'telkens opnieuw beschadigd',
  // EN
  'trust is gone', 'trust is broken', 'cannot believe anything',
  'trust completely damaged', 'nothing left to trust',
];

const OVER_EMPATHIZING_KEYWORDS = [
  // NL
  'ik begrijp het wel', 'ik snap het wel', 'ik probeer het te begrijpen',
  'ik weet dat het moeilijk is voor de ander', 'ik moet meer geduld hebben',
  'misschien is het mijn schuld', 'ik moet meer begrip tonen',
  'ik probeer het al zo lang te begrijpen',
  // EN
  'i understand why', 'i try to understand', 'maybe it is my fault',
  'i should be more patient', 'i need to show more understanding',
];

const PATTERN_REPETITION_MARKERS = [
  // NL — markers that indicate this is NOT a single incident
  'telkens', 'steeds opnieuw', 'herhaald', 'altijd weer',
  'niet de eerste keer', 'dit is niet één keer', 'dit gebeurt telkens',
  'patroon', 'structureel', 'al zo lang', 'al jaren',
  'elke keer', 'keer op keer', 'weer dezelfde',
  // EN
  'every time', 'again and again', 'repeated', 'always the same',
  'not the first time', 'pattern', 'keeps happening', 'for years',
];

// ─── Detect signals from user message ──────────────────────────────────────

export interface DetectedRelationalSignals {
  relationshipConflictSignal: boolean;
  boundaryAdvicePresent: boolean;
  partnerJudgmentRisk: boolean;
  distanceAdviceRisk: boolean;
  connectionOpportunity: boolean;
  // Harm layer signals
  repeatedBetrayalSignal: boolean;
  repeatedBoundaryViolationSignal: boolean;
  chronicTrustDamageSignal: boolean;
  userAlreadyOverEmpathizing: boolean;
  minimizationRisk: boolean;
  relationalHarmPatternSignal: boolean;
}

export function detectRelationalSignals(userMessage: string): DetectedRelationalSignals {
  const lower = userMessage.toLowerCase();

  const relationshipConflictSignal = CONFLICT_KEYWORDS.some(kw => lower.includes(kw));
  const boundaryAdvicePresent = BOUNDARY_KEYWORDS.some(kw => lower.includes(kw));
  const partnerJudgmentRisk = BLAME_RISK_KEYWORDS.some(kw => lower.includes(kw));
  const distanceAdviceRisk = DISTANCE_RISK_KEYWORDS.some(kw => lower.includes(kw));

  // Harm layer detection
  const repeatedBetrayalSignal = REPEATED_BETRAYAL_KEYWORDS.some(kw => lower.includes(kw))
    || (REPEATED_LYING_KEYWORDS.some(kw => lower.includes(kw)));
  const repeatedBoundaryViolationSignal = REPEATED_BOUNDARY_VIOLATION_KEYWORDS.some(kw => lower.includes(kw));
  const chronicTrustDamageSignal = CHRONIC_TRUST_DAMAGE_KEYWORDS.some(kw => lower.includes(kw));
  const userAlreadyOverEmpathizing = OVER_EMPATHIZING_KEYWORDS.some(kw => lower.includes(kw));
  const hasRepetitionMarker = PATTERN_REPETITION_MARKERS.some(kw => lower.includes(kw));

  // Combined harm pattern signal: any harm indicator + repetition marker
  const relationalHarmPatternSignal = (repeatedBetrayalSignal || repeatedBoundaryViolationSignal || chronicTrustDamageSignal)
    || (hasRepetitionMarker && relationshipConflictSignal);

  // Minimization risk: harm pattern present, so early perspective shift would minimize
  const minimizationRisk = relationalHarmPatternSignal || userAlreadyOverEmpathizing;

  // Connection opportunity: conflict present but no harm pattern and no distance risk
  const connectionOpportunity = relationshipConflictSignal && !distanceAdviceRisk && !relationalHarmPatternSignal;

  return {
    relationshipConflictSignal,
    boundaryAdvicePresent,
    partnerJudgmentRisk,
    distanceAdviceRisk,
    connectionOpportunity,
    repeatedBetrayalSignal,
    repeatedBoundaryViolationSignal,
    chronicTrustDamageSignal,
    userAlreadyOverEmpathizing,
    minimizationRisk,
    relationalHarmPatternSignal,
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
      requireHarmValidationFirst: false,
      blockEarlyPerspectiveShift: false,
      requireRepairConditions: false,
      requireAccountabilityWithoutShame: false,
      allowConnectionOnlyAfterValidation: false,
      gptDirective: buildSafetyDirective(),
    };
  }

  // Rule 2: RELATIONAL_HARM_PATTERN (middle layer)
  const harmActive = input.relationalHarmPatternSignal ?? false;

  if (harmActive) {
    const requireHarmValidationFirst = true;
    const blockEarlyPerspectiveShift = (input.repeatedBetrayalSignal ?? false)
      || (input.chronicTrustDamageSignal ?? false)
      || (input.userAlreadyOverEmpathizing ?? false);
    const requireRepairConditions = (input.repeatedBoundaryViolationSignal ?? false)
      || (input.repeatedBetrayalSignal ?? false)
      || (input.chronicTrustDamageSignal ?? false);
    const requireAccountabilityWithoutShame = requireRepairConditions;
    const allowConnectionOnlyAfterValidation = true;

    return {
      allowResponse: true,
      requirePerspectiveShift: false, // Blocked at harm level
      requireBridgeBoundary: false, // Replaced by repair conditions
      blockBlameLanguage: true, // Still no demonization
      blockDistanceAdvice: input.distanceAdviceRisk,
      requireSafetyOverride: false,
      requireHarmValidationFirst,
      blockEarlyPerspectiveShift,
      requireRepairConditions,
      requireAccountabilityWithoutShame,
      allowConnectionOnlyAfterValidation,
      gptDirective: buildHarmPatternDirective({
        blockEarlyPerspectiveShift,
        requireRepairConditions,
        requireAccountabilityWithoutShame,
        userAlreadyOverEmpathizing: input.userAlreadyOverEmpathizing ?? false,
        minimizationRisk: input.minimizationRisk ?? false,
      }),
    };
  }

  // Rule 3: Normal relational friction — perspective shift + bridge boundaries
  const requirePerspectiveShift = input.relationshipConflictSignal && !(input.minimizationRisk ?? false);
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
    requireHarmValidationFirst: false,
    blockEarlyPerspectiveShift: false,
    requireRepairConditions: false,
    requireAccountabilityWithoutShame: false,
    allowConnectionOnlyAfterValidation: false,
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

// ─── HARM PATTERN Directive Builder ────────────────────────────────────────

function buildHarmPatternDirective(flags: {
  blockEarlyPerspectiveShift: boolean;
  requireRepairConditions: boolean;
  requireAccountabilityWithoutShame: boolean;
  userAlreadyOverEmpathizing: boolean;
  minimizationRisk: boolean;
}): string {
  const lines: string[] = [`[RELATIONAL_STANCE_FILTER: RELATIONAL_HARM_PATTERN]`];

  lines.push(`CATEGORY: This is NOT ordinary friction. This is repeated, pattern-based relational harm.`);
  lines.push(`Kim still does not demonize the other person. Kim still does not make relational decisions.`);
  lines.push(`But Kim does NOT minimize repeated harm by asking for early perspective-taking.`);

  // Response sequence for harm pattern
  lines.push(`RESPONSE SEQUENCE FOR RELATIONAL HARM:`);
  lines.push(`1. Acknowledge the severity and repetition ("This is not one difficult moment — this is a pattern that keeps damaging trust.")`);
  lines.push(`2. Name that this is NOT ordinary miscommunication`);
  lines.push(`3. Validate that trust is structurally damaged`);
  lines.push(`4. Help the user distinguish between understanding and continuing to carry`);
  lines.push(`5. Formulate repair conditions (what would need to change)`);
  lines.push(`6. Only AFTER validation: limited, careful perspective space (if appropriate)`);
  lines.push(`7. Connection only under conditions — not as default`);

  if (flags.blockEarlyPerspectiveShift) {
    lines.push(`EARLY PERSPECTIVE SHIFT BLOCKED: Do NOT start with "what might the other person feel?" or "what is underneath their behavior?" The user has likely already tried understanding many times. First validate their pain and the pattern.`);
  }

  if (flags.requireRepairConditions) {
    lines.push(`REPAIR CONDITIONS REQUIRED: Connection can only be offered WITH conditions. Use the framework: 1) Acknowledgment (the other recognizes what happened) 2) Responsibility (ownership without humiliation) 3) Transparency 4) Consistency (repeated safer behavior, not one good conversation) 5) Time (trust may rebuild slowly) 6) Boundary (what is no longer bearable) 7) Reconnection (contact possible when conditions are safe enough).`);
  }

  if (flags.requireAccountabilityWithoutShame) {
    lines.push(`ACCOUNTABILITY WITHOUT SHAME: The other person's responsibility can be named without demonization. "This pattern has real impact" is different from "they are a bad person."`);
  }

  if (flags.userAlreadyOverEmpathizing) {
    lines.push(`USER OVER-EMPATHIZING DETECTED: The user is already trying too hard to understand the other. Do NOT reinforce this. Instead: "Understanding can be helpful, but it should not erase your pain." Help them see that empathy without boundaries becomes self-erasure.`);
  }

  if (flags.minimizationRisk) {
    lines.push(`MINIMIZATION RISK: Any response that starts with perspective-taking or "maybe the other person..." risks minimizing real, repeated harm. Validate first. Always.`);
  }

  // Forbidden at harm level
  lines.push(`FORBIDDEN AT HARM LEVEL:`);
  lines.push(`- Do NOT quickly relativize the user's pain`);
  lines.push(`- Do NOT immediately ask what the other person feels`);
  lines.push(`- Do NOT frame repeated betrayal as ordinary miscommunication`);
  lines.push(`- Do NOT suggest trust repair without conditions`);
  lines.push(`- Do NOT seek connection without acknowledging damage`);
  lines.push(`- Do NOT say the user should keep the bridge open without the other taking responsibility`);
  lines.push(`- Do NOT treat boundaries as merely emotional regulation`);

  // Allowed at harm level
  lines.push(`ALLOWED AT HARM LEVEL:`);
  lines.push(`- Name the repetition and pattern`);
  lines.push(`- Name trust as a damaged system`);
  lines.push(`- Ask for accountability without humiliation`);
  lines.push(`- Formulate boundaries as repair conditions`);
  lines.push(`- Connect connection to honesty, consistency, and time`);
  lines.push(`- Help the user speak without attack`);
  lines.push(`- Still do not demonize the other person`);
  lines.push(`- Still take the impact seriously`);

  lines.push(`TEMPLATE: "This does not sound like one difficult moment, but like a pattern that keeps damaging trust. Then it is not enough to only look for what the other person meant. Your pain and your boundary must be taken seriously first. Connection can only repair here if there is also honesty, responsibility, and repeated safer behavior."`);
  lines.push(`[/RELATIONAL_STANCE_FILTER]`);

  return lines.join('\n');
}
