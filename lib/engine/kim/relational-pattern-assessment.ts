/**
 * ══════════════════════════════════════════════════════════════════════════
 * KIM RELATIONAL PATTERN ASSESSMENT MODE
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Activates when the user explicitly asks Kim for a relational assessment.
 * Produces a structured 6-step GPT directive that replaces the normal
 * relational stance filter when active.
 *
 * Kim may:
 * - name patterns, inequality, instability, trust damage
 * - name the caregiver's role and the addicted person's responsibility
 * - state that sobriety alone is not enough
 * - say recovery requires behaviour, transparency, repetition over time
 *
 * Kim may NOT:
 * - choose sides, diagnose, advise leaving/staying
 * - force forgiveness or trust
 * - minimize damage
 * - make the caregiver responsible for the addicted person's recovery
 *
 * Core rule: Kim does not choose between people. Kim chooses truth in the pattern.
 */

// ─── Activation Detection ────────────────────────────────────────────────────

const ASSESSMENT_TRIGGER_PATTERNS_NL = [
  /wat vind (je|jij) van (mijn|onze|deze) relatie/i,
  /is (deze|mijn|onze) relatie (nog )?(gezond|goed|ok|oké)/i,
  /is dit nog gelijkwaardig/i,
  /zie (je|jij) dit nog goedkomen/i,
  /ben ik (te )?hard/i,
  /ben ik onredelijk/i,
  /wat (zie|merk) (je|jij) (tussen ons|in onze relatie)/i,
  /wat is (hier )?het patroon/i,
  /wat (zegt|toont) mijn rugzak over (onze|mijn) relatie/i,
  /op basis van (alles )?wat (je|jij) weet/i,
  /hoe (zie|beoordeel) (je|jij) (onze|mijn|deze) (relatie|situatie)/i,
  /is er nog hoop/i,
  /kan dit nog goed komen/i,
  /wat denk (je|jij) (echt|eerlijk)/i,
  /geef (me )?je eerlijke mening/i,
  /wees eerlijk/i,
];

const ASSESSMENT_TRIGGER_PATTERNS_EN = [
  /what do you think (of|about) (my|our|this) relationship/i,
  /is (this|my|our) relationship (still )?(healthy|good|ok)/i,
  /is this still equal/i,
  /do you see this working out/i,
  /am i (too )?hard/i,
  /am i (being )?unreasonable/i,
  /what do you see (between us|in our relationship)/i,
  /what('s| is) the pattern (here)?/i,
  /what does my (backpack|data) say about (our|my) relationship/i,
  /based on (everything|all) you know/i,
  /how do you (see|assess|judge) (our|my|this) (relationship|situation)/i,
  /is there still hope/i,
  /can this still work/i,
  /what do you (really|honestly) think/i,
  /give me your honest (opinion|assessment)/i,
  /be honest (with me)?/i,
];

const ASSESSMENT_TRIGGER_PATTERNS_FR = [
  /que penses-tu de (ma|notre|cette) relation/i,
  /est-ce que (cette|ma|notre) relation est (encore )?(saine|bonne)/i,
  /est-ce encore équilibré/i,
  /tu vois ça s'arranger/i,
  /suis-je trop (dur|sévère)/i,
  /suis-je déraisonnable/i,
  /que vois-tu entre nous/i,
  /quel est le (schéma|patron) ici/i,
  /sur base de tout ce que tu sais/i,
  /donne-moi ton avis honnête/i,
  /sois honnête/i,
];

/**
 * Detect whether the user is explicitly asking for a relational assessment.
 */
export function detectAssessmentRequest(userMessage: string): boolean {
  const allPatterns = [
    ...ASSESSMENT_TRIGGER_PATTERNS_NL,
    ...ASSESSMENT_TRIGGER_PATTERNS_EN,
    ...ASSESSMENT_TRIGGER_PATTERNS_FR,
  ];
  return allPatterns.some(p => p.test(userMessage));
}

// ─── Assessment Inputs ───────────────────────────────────────────────────────

export interface RelationalAssessmentInput {
  /** The user's current message */
  currentUserMessage: string;
  /** Safety level from pipeline */
  safetyLevel: 'none' | 'mild' | 'elevated' | 'crisis';
  /** Whether RELATIONAL_HARM_PATTERN is active */
  relationalHarmPatternActive: boolean;
  /** Trust damage signals detected */
  trustDamageSignals: boolean;
  /** Role confusion signals detected */
  roleConfusionSignals: boolean;
  /** Boundary fatigue signals detected */
  boundaryFatigueSignals: boolean;
  /** Recovery responsibility signals (user taking on partner's recovery) */
  recoveryResponsibilitySignals: boolean;
  /** Connection intent from KERP01 */
  connectionIntent?: string;
  /** Repair condition from KERP01 */
  repairCondition?: string;
  /** Bridge sentence from KERP01 */
  bridgeSentence?: string;
  /** Safety exception from KERP01 */
  safetyException?: string;
  /** Whether there is sufficient data to make an assessment */
  hasBackpackData: boolean;
  /** Whether there is conversation history with relational content */
  hasRelationalHistory: boolean;
}

export interface RelationalAssessmentOutput {
  /** Whether assessment mode is active */
  isActive: boolean;
  /** The GPT directive for assessment mode */
  gptDirective: string;
}

// ─── Forbidden / Required formulations ───────────────────────────────────────

const FORBIDDEN_FORMULATIONS = [
  'de ander is het probleem',
  'je moet weg',
  'je moet blijven',
  'de ander manipuleert je',
  'de ander gebruikt je',
  'jij hebt niets verkeerd gedaan',
  'dit is gewoon trauma',
  'dit is toxisch',
  'dit is niet herstelbaar',
  'je moet vergeven',
  'je moet opnieuw vertrouwen',
  'the other person is the problem',
  'you should leave',
  'you should stay',
  'the other is manipulating you',
  'the other is using you',
  'you did nothing wrong',
  'this is just trauma',
  'this is toxic',
  'this is not repairable',
  'you must forgive',
  'you must trust again',
];

const REQUIRED_FORMULATIONS = [
  'Op basis van wat je beschrijft...',
  'Dat betekent niet automatisch dat de relatie verloren is.',
  'Maar het betekent wel dat...',
  'Jij bent niet verantwoordelijk voor het herstel van de ander.',
  'Herstel vraagt zichtbaar gedrag over tijd.',
];

// ─── Build Assessment Directive ──────────────────────────────────────────────

/**
 * Build the RELATIONAL_PATTERN_ASSESSMENT_MODE GPT directive.
 * This replaces the normal relational stance filter when active.
 */
export function buildAssessmentDirective(input: RelationalAssessmentInput): RelationalAssessmentOutput {
  // Safety override: no assessment, safety first
  if (input.safetyLevel === 'crisis' || input.safetyLevel === 'elevated') {
    return {
      isActive: true,
      gptDirective: buildSafetyAssessmentDirective(),
    };
  }

  // Insufficient data: honest limitation
  if (!input.hasBackpackData && !input.hasRelationalHistory) {
    return {
      isActive: true,
      gptDirective: buildInsufficientDataDirective(),
    };
  }

  // Full assessment mode
  return {
    isActive: true,
    gptDirective: buildFullAssessmentDirective(input),
  };
}

function buildSafetyAssessmentDirective(): string {
  return `[RELATIONAL_PATTERN_ASSESSMENT_MODE — SAFETY OVERRIDE]
The user asks for a relational assessment, but safety is currently active.
RESPONSE RULES:
1. Address safety FIRST. Stabilize.
2. After safety acknowledgment, you may add ONE short pattern sentence maximum.
3. Do NOT provide a full relational analysis while safety is active.
4. Do NOT advise leaving or staying.
Example: "Eerst wil ik zeker weten dat je nu veilig bent. [safety response]. Op basis van wat je beschrijft zie ik een patroon dat aandacht verdient — maar dat bespreken we wanneer je veilig en stabiel bent."`;
}

function buildInsufficientDataDirective(): string {
  return `[RELATIONAL_PATTERN_ASSESSMENT_MODE — INSUFFICIENT DATA]
The user asks for a relational assessment, but there is not enough information to provide one.
RESPONSE:
Say honestly: "Ik kan dit niet stevig beoordelen op basis van wat ik nu weet. Vertel me meer over jullie relatie — hoe lang, wat er speelt, wat je mist, wat je raakt — zodat ik een eerlijker beeld kan vormen."
Do NOT guess or fill in blanks.
Do NOT provide a generic assessment.
Ask specific follow-up questions to gather the information needed.`;
}

function buildFullAssessmentDirective(input: RelationalAssessmentInput): string {
  const harmBlock = input.relationalHarmPatternActive
    ? `\nRELATIONAL_HARM_PATTERN IS ACTIVE:
- Do NOT open perspective early ("probeer ook zijn/haar kant te zien")
- FIRST name the damage and its repetition clearly
- THEN state repair conditions
- ONLY AFTER repair conditions may you add limited perspective
- Repair conditions BEFORE bridge sentence`
    : '';

  const signalContext = buildSignalContext(input);

  return `[RELATIONAL_PATTERN_ASSESSMENT_MODE — ACTIVE]
The user explicitly asks for a relational assessment. This overrides normal validation-only mode.

CORE RULE: Kim does not choose between people. Kim DOES choose truth in the pattern.

You MUST respond in these 6 steps IN ORDER:

STEP 1 — DIRECT BUT CAREFUL CONCLUSION:
State what you see. Use "Op basis van wat je beschrijft..." as opener.
Be clear: name inequality, instability, or trust damage if present.
Example: "Op basis van wat je beschrijft lijkt jullie relatie momenteel niet gelijkwaardig en ook niet stabiel."

STEP 2 — EVIDENCE-BOUND REASONING:
Only name patterns that come from the data/context you have.
Never invent or assume. Reference specific things the user has shared.
Example: "Niet door één conflict, maar door de combinatie van herhaalde vertrouwensschade, ontregeling en jouw groeiende sturende rol."

STEP 3 — DUAL PERSPECTIVE WITHOUT NEUTRALIZING:
Name both sides without making them equal when they are not.
The caregiver's withdrawal is understandable. The other's behaviour still needs change.
Example: "Jouw terughoudendheid is begrijpelijk na schade. Tegelijk kan jouw sturende rol voor de ander als controle voelen."
${input.relationalHarmPatternActive ? 'NOTE: Because RELATIONAL_HARM_PATTERN is active, place this step AFTER step 4 (repair conditions). Do NOT open perspective before naming damage.' : ''}

STEP 4 — RESPONSIBILITY PLACEMENT:
The caregiver is NOT responsible for the other's recovery.
But when the caregiver stops managing, the other must actually take over.
Say: "Jij bent niet verantwoordelijk voor het herstel van de ander."
Example: "Maar wanneer jij stopt met sturen, moet de ander die verantwoordelijkheid ook echt zelf opnemen."

STEP 5 — REPAIR CONDITIONS:
Recovery requires more than sobriety: initiative, honesty, transparency, predictability, responsibility, repeated behaviour over time.
Say: "Herstel vraagt zichtbaar gedrag over tijd."
Example: "Herstel vraagt meer dan nuchterheid: initiatief, eerlijkheid, transparantie, voorspelbaarheid, verantwoordelijkheid en herhaald gedrag over tijd."

STEP 6 — NO RELATIONSHIP DECISION, BUT A CLEAR TEST QUESTION:
Never advise to stay or leave.
Instead, formulate a clear test question the user can observe over time.
Say: "Dat betekent niet automatisch dat de relatie verloren is."
Example: "De vraag is niet of jij zachter moet worden of de ander harder moet proberen. De vraag is of er over langere tijd genoeg zelfstandig betrouwbaar gedrag komt om opnieuw gelijkwaardigheid te laten groeien."
${harmBlock}
${signalContext}

FORBIDDEN (never say any of these):
${FORBIDDEN_FORMULATIONS.map(f => `- "${f}"`).join('\n')}

REQUIRED FORMULATIONS (use at least 3 of these naturally):
${REQUIRED_FORMULATIONS.map(f => `- "${f}"`).join('\n')}

IMPORTANT:
- Do NOT use fixed person names. Use "de ander", "je partner", "de persoon met verslaving".
- Do NOT diagnose (no "codependent", "toxic", "narcissist").
- Do NOT advise leaving or staying.
- Do NOT force forgiveness or trust.
- Do NOT minimize damage.
- K05 override remains active: if your response contains a boundary statement, it MUST include a repair path (unless RELATIONAL_HARM_PATTERN is active, then repair conditions come first).`;
}

function buildSignalContext(input: RelationalAssessmentInput): string {
  const signals: string[] = [];
  if (input.trustDamageSignals) signals.push('TRUST DAMAGE detected — name trust erosion explicitly');
  if (input.roleConfusionSignals) signals.push('ROLE CONFUSION detected — name the caregiver taking over without blame');
  if (input.boundaryFatigueSignals) signals.push('BOUNDARY FATIGUE detected — acknowledge exhaustion from repeated boundary-setting');
  if (input.recoveryResponsibilitySignals) signals.push('RECOVERY RESPONSIBILITY MISPLACEMENT detected — clearly state the other must own their recovery');
  if (input.connectionIntent) signals.push(`CONNECTION INTENT from Eigen Regie: "${input.connectionIntent}"`);
  if (input.repairCondition) signals.push(`REPAIR CONDITION from Eigen Regie: "${input.repairCondition}"`);

  if (signals.length === 0) return '';
  return `\nDETECTED SIGNALS (use these in your assessment):\n${signals.map(s => `• ${s}`).join('\n')}`;
}

// ─── Signal Detection Helpers ────────────────────────────────────────────────

const TRUST_DAMAGE_KEYWORDS = [
  'vertrouwen', 'trust', 'bedrogen', 'betrayed', 'gelogen', 'lied',
  'oneerlijk', 'dishonest', 'geheim', 'secret', 'verborgen', 'hidden',
  'betrapt', 'caught', 'confiance', 'trahi', 'menti',
];

const ROLE_CONFUSION_KEYWORDS = [
  'ik moet alles regelen', 'i have to manage everything',
  'ik ben de ouder', 'i am the parent', 'ik stuur alles',
  'ik controleer', 'i control', 'zonder mij lukt het niet',
  'ik neem alles over', 'i take over everything',
  'je dois tout gérer', 'je contrôle tout',
];

const BOUNDARY_FATIGUE_KEYWORDS = [
  'moe van grenzen', 'tired of boundaries', 'altijd dezelfde grens',
  'always the same boundary', 'hoeveel keer nog', 'how many more times',
  'ik geef het op', 'i give up', 'het heeft geen zin',
  'it makes no sense', 'fatiguée des limites',
];

const RECOVERY_RESPONSIBILITY_KEYWORDS = [
  'ik moet hem helpen', 'i have to help him', 'zonder mij lukt het niet',
  'without me it won\'t work', 'ik ben verantwoordelijk',
  'i am responsible', 'als ik niet', 'if i don\'t',
  'ik moet zorgen dat', 'i have to make sure',
  'je dois l\'aider', 'c\'est ma responsabilité',
];

/**
 * Detect assessment-relevant signals from the user message and conversation context.
 */
export function detectAssessmentSignals(
  userMessage: string,
  conversationHistory?: string[],
): {
  trustDamageSignals: boolean;
  roleConfusionSignals: boolean;
  boundaryFatigueSignals: boolean;
  recoveryResponsibilitySignals: boolean;
} {
  const text = [userMessage, ...(conversationHistory || [])].join(' ').toLowerCase();
  return {
    trustDamageSignals: TRUST_DAMAGE_KEYWORDS.some(k => text.includes(k)),
    roleConfusionSignals: ROLE_CONFUSION_KEYWORDS.some(k => text.includes(k.toLowerCase())),
    boundaryFatigueSignals: BOUNDARY_FATIGUE_KEYWORDS.some(k => text.includes(k.toLowerCase())),
    recoveryResponsibilitySignals: RECOVERY_RESPONSIBILITY_KEYWORDS.some(k => text.includes(k.toLowerCase())),
  };
}
