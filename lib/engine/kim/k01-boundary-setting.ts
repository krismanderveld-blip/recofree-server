/**
 * K01 — Boundary Setting (Kim Default Module)
 *
 * PURPOSE: Help caregivers set, maintain, and repair healthy boundaries
 * without demonizing the partner or making the caregiver responsible for
 * the other person's recovery.
 *
 * CORE PRINCIPLES:
 * 1. A boundary is not punishment — it is information
 * 2. Love does not require self-destruction
 * 3. Guilt after a boundary is normal, not proof of wrongdoing
 * 4. Kim never demonizes the partner
 * 5. Kim never makes the caregiver responsible for the other's recovery
 *
 * K01 is the DEFAULT module: when no stronger signal fires, Kim defaults here.
 * K02 (Enabling Awareness) routes to K01 when boundary intervention is needed.
 *
 * DETECTED STATES: Boundary fatigue, Guilt after boundary, Boundary collapse,
 * Fear of abandonment, Boundary confusion, Overgiving pattern
 *
 * INTERVENTION TYPES: validate_boundary_need, normalize_guilt, boundary_repair,
 * boundary_education, boundary_practice
 */

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export type K01BoundaryState =
  | 'boundary_fatigue'
  | 'guilt_after_boundary'
  | 'boundary_collapse'
  | 'fear_of_abandonment'
  | 'boundary_confusion'
  | 'overgiving'
  | 'none';

export type K01InterventionType =
  | 'validate_boundary_need'
  | 'normalize_guilt'
  | 'boundary_repair'
  | 'boundary_education'
  | 'boundary_practice';

export type K01Severity = 'mild' | 'moderate' | 'severe';

export interface K01DetectionResult {
  activated: boolean;
  primaryState: K01BoundaryState;
  secondaryStates: K01BoundaryState[];
  severity: K01Severity;
  signals: string[];
  collapseRisk: boolean;
  repeatedViolationCount: number;
}

export interface K01RoutingResult {
  activated: boolean;
  interventionType: K01InterventionType;
  primaryState: K01BoundaryState;
  severity: K01Severity;
  collapseRisk: boolean;
  boundaryStatement: string | null;
  doNots: string[];
  promptBlock: string | null;
}

export interface K01Progress {
  sessionsWithBoundaryFatigue: number;
  sessionsWithGuiltAfterBoundary: number;
  sessionsWithCollapse: number;
  sessionsWithAbandonmentFear: number;
  boundaryRepairAttempts: number;
  boundaryPracticeCount: number;
  lastInterventionType: K01InterventionType | null;
  lastSessionDate: string | null;
  boundaryStabilityTrend: 'improving' | 'stable' | 'declining' | 'unknown';
}

export function createDefaultK01Progress(): K01Progress {
  return {
    sessionsWithBoundaryFatigue: 0,
    sessionsWithGuiltAfterBoundary: 0,
    sessionsWithCollapse: 0,
    sessionsWithAbandonmentFear: 0,
    boundaryRepairAttempts: 0,
    boundaryPracticeCount: 0,
    lastInterventionType: null,
    lastSessionDate: null,
    boundaryStabilityTrend: 'unknown',
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// DETECTOR — Deterministic marker-based detection
// ════════════════════════════════════════════════════════════════════════════════

const BOUNDARY_FATIGUE_MARKERS = [
  // EN
  'too much', 'can\'t keep doing this', 'giving everything', 'nothing left for me',
  'always putting them first', 'no space for myself', 'drained', 'used up',
  'they take everything', 'i have no limits left', 'boundary fatigue',
  'can\'t say no', 'keep giving in', 'doormat', 'walked over',
  'always available', 'never my turn', 'sacrificing myself',
  // NL
  'te veel', 'kan dit niet blijven doen', 'geef alles', 'niets meer over voor mij',
  'altijd hen eerst', 'geen ruimte voor mezelf', 'leeggetrokken', 'opgebruikt',
  'ze nemen alles', 'ik heb geen grenzen meer', 'grensmoeheid',
  'kan geen nee zeggen', 'geef steeds toe', 'voetveeg', 'over me heen gelopen',
  'altijd beschikbaar', 'nooit mijn beurt', 'offer mezelf op',
];

const GUILT_AFTER_BOUNDARY_MARKERS = [
  // EN
  'feel guilty', 'selfish', 'bad person', 'shouldn\'t have said no',
  'maybe i was too harsh', 'they need me', 'abandoning them',
  'feel terrible for setting', 'wrong to say no', 'cruel',
  'they\'ll think i don\'t care', 'guilt after', 'guilty for',
  'am i being unfair', 'too strict', 'heartless',
  // NL
  'voel me schuldig', 'egoïstisch', 'slecht persoon', 'had geen nee moeten zeggen',
  'misschien was ik te hard', 'ze hebben me nodig', 'laat ze in de steek',
  'voel me verschrikkelijk', 'fout om nee te zeggen', 'wreed',
  'ze denken dat ik niet geef', 'schuld na', 'schuldig over',
  'ben ik oneerlijk', 'te streng', 'harteloos', 'schuldgevoel',
];

const BOUNDARY_COLLAPSE_MARKERS = [
  // EN
  'gave in again', 'couldn\'t hold', 'broke my own rule', 'said yes again',
  'let them cross', 'boundary collapsed', 'failed to maintain',
  'went back on my word', 'caved', 'couldn\'t stick to it',
  'they pushed and i gave in', 'my boundary didn\'t hold', 'folded',
  // NL
  'weer toegegeven', 'kon niet vasthouden', 'eigen regel gebroken', 'weer ja gezegd',
  'liet ze over mijn grens', 'grens ingestort', 'niet kunnen handhaven',
  'teruggekomen op mijn woord', 'bezweken', 'kon er niet aan vasthouden',
  'ze duwden en ik gaf toe', 'mijn grens hield niet', 'gezwicht',
];

const FEAR_OF_ABANDONMENT_MARKERS = [
  // EN
  'they\'ll leave', 'lose them', 'push them away', 'alone if i set',
  'afraid they\'ll go', 'can\'t risk losing', 'they\'ll choose',
  'abandoned', 'left behind', 'if i say no they\'ll',
  'scared of rejection', 'they won\'t love me', 'end the relationship',
  // NL
  'ze gaan weg', 'hen verliezen', 'duw ze weg', 'alleen als ik',
  'bang dat ze weggaan', 'kan niet riskeren', 'ze kiezen',
  'verlaten', 'achtergelaten', 'als ik nee zeg dan',
  'bang voor afwijzing', 'ze houden niet meer van me', 'relatie beëindigen',
];

const BOUNDARY_CONFUSION_MARKERS = [
  // EN
  'don\'t know what\'s reasonable', 'am i asking too much', 'is this a boundary',
  'what\'s normal', 'confused about limits', 'don\'t know where the line is',
  'what am i allowed to ask', 'is this okay to want', 'overreacting',
  'maybe i\'m the problem', 'don\'t know my rights',
  // NL
  'weet niet wat redelijk is', 'vraag ik te veel', 'is dit een grens',
  'wat is normaal', 'verward over grenzen', 'weet niet waar de lijn is',
  'wat mag ik vragen', 'is dit oké om te willen', 'overdrijf ik',
  'misschien ben ik het probleem', 'weet mijn rechten niet',
];

const OVERGIVING_MARKERS = [
  // EN
  'do everything for them', 'take care of everything', 'they don\'t lift a finger',
  'i carry it all', 'one-sided', 'all the responsibility', 'never reciprocated',
  'give and give', 'nothing in return', 'always me who',
  'i fix everything', 'hold everything together',
  // NL
  'doe alles voor ze', 'zorg voor alles', 'ze doen niets', 'ik draag alles',
  'eenzijdig', 'alle verantwoordelijkheid', 'nooit wederkerig',
  'geven en geven', 'niets terug', 'altijd ik die',
  'ik los alles op', 'houd alles bij elkaar',
];

const REPEATED_VIOLATION_MARKERS = [
  // EN
  'again', 'keeps happening', 'every time', 'same thing', 'they always',
  'never respects', 'ignores my boundary', 'crosses the line again',
  // NL
  'weer', 'blijft gebeuren', 'elke keer', 'hetzelfde', 'ze doen altijd',
  'respecteert nooit', 'negeert mijn grens', 'gaat weer over de grens',
];

function countMarkerHits(text: string, markers: string[]): number {
  let count = 0;
  for (const marker of markers) {
    if (text.includes(marker)) count++;
  }
  return count;
}

// Session state for collapse tracking
let sessionBoundaryStates: K01BoundaryState[] = [];

export function resetK01SessionState(): void {
  sessionBoundaryStates = [];
}

export function detectK01BoundaryState(
  message: string,
  recentMessages: string[] = [],
): K01DetectionResult {
  const text = message.toLowerCase();
  const allText = [text, ...recentMessages.map(m => m.toLowerCase())].join(' ');

  const fatigueHits = countMarkerHits(text, BOUNDARY_FATIGUE_MARKERS);
  const guiltHits = countMarkerHits(text, GUILT_AFTER_BOUNDARY_MARKERS);
  const collapseHits = countMarkerHits(text, BOUNDARY_COLLAPSE_MARKERS);
  const abandonmentHits = countMarkerHits(text, FEAR_OF_ABANDONMENT_MARKERS);
  const confusionHits = countMarkerHits(text, BOUNDARY_CONFUSION_MARKERS);
  const overgivingHits = countMarkerHits(text, OVERGIVING_MARKERS);
  const violationHits = countMarkerHits(allText, REPEATED_VIOLATION_MARKERS);

  const scores: { state: K01BoundaryState; hits: number }[] = [
    { state: 'boundary_fatigue', hits: fatigueHits },
    { state: 'guilt_after_boundary', hits: guiltHits },
    { state: 'boundary_collapse', hits: collapseHits },
    { state: 'fear_of_abandonment', hits: abandonmentHits },
    { state: 'boundary_confusion', hits: confusionHits },
    { state: 'overgiving', hits: overgivingHits },
  ];

  // Sort by hits descending
  scores.sort((a, b) => b.hits - a.hits);

  const primaryState = scores[0].hits > 0 ? scores[0].state : 'none' as K01BoundaryState;
  const secondaryStates = scores
    .slice(1)
    .filter(s => s.hits > 0)
    .map(s => s.state);

  const totalHits = scores.reduce((sum, s) => sum + s.hits, 0);
  const activated = totalHits > 0;

  // Determine severity
  let severity: K01Severity = 'mild';
  if (totalHits >= 5 || collapseHits >= 3 || (fatigueHits >= 3 && guiltHits >= 2)) {
    severity = 'severe';
  } else if (totalHits >= 3 || collapseHits >= 2 || violationHits >= 3) {
    severity = 'moderate';
  }

  // Collapse risk: boundary collapse detected OR repeated violations + fatigue
  const collapseRisk = collapseHits >= 1 || (violationHits >= 2 && fatigueHits >= 2);

  // Track session state
  if (activated) {
    sessionBoundaryStates.push(primaryState);
  }

  // Collect signal descriptions
  const signals: string[] = [];
  if (fatigueHits > 0) signals.push(`fatigue(${fatigueHits})`);
  if (guiltHits > 0) signals.push(`guilt(${guiltHits})`);
  if (collapseHits > 0) signals.push(`collapse(${collapseHits})`);
  if (abandonmentHits > 0) signals.push(`abandonment_fear(${abandonmentHits})`);
  if (confusionHits > 0) signals.push(`confusion(${confusionHits})`);
  if (overgivingHits > 0) signals.push(`overgiving(${overgivingHits})`);
  if (violationHits > 0) signals.push(`violations(${violationHits})`);
  if (collapseRisk) signals.push('collapse_risk');

  return {
    activated,
    primaryState,
    secondaryStates,
    severity,
    signals,
    collapseRisk,
    repeatedViolationCount: violationHits,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// ROUTER — Intervention type selection based on detection + sliders
// ════════════════════════════════════════════════════════════════════════════════

const DO_NOTS = [
  'Do NOT demonize the partner',
  'Do NOT make the caregiver responsible for the other person\'s recovery',
  'Do NOT frame boundaries as punishment',
  'Do NOT encourage guilt as proof of wrongdoing',
  'Do NOT suggest the caregiver is being selfish for having limits',
  'Do NOT pressure the caregiver to forgive or reconcile prematurely',
];

function selectInterventionType(
  detection: K01DetectionResult,
  boundaryFatigue: number,
): K01InterventionType {
  // High boundary fatigue → validate the need
  if (boundaryFatigue >= 6) return 'validate_boundary_need';

  // Guilt signals dominant → normalize guilt
  if (detection.primaryState === 'guilt_after_boundary') return 'normalize_guilt';

  // Collapse detected or collapse risk → boundary repair
  if (detection.primaryState === 'boundary_collapse' || detection.collapseRisk) return 'boundary_repair';

  // Confusion or no strong signal → boundary education (default)
  if (detection.primaryState === 'boundary_confusion' || detection.primaryState === 'none') return 'boundary_education';

  // Repeated violations → boundary practice (concrete formulation)
  if (detection.repeatedViolationCount >= 2) return 'boundary_practice';

  // Fear of abandonment → validate + educate
  if (detection.primaryState === 'fear_of_abandonment') return 'validate_boundary_need';

  // Overgiving → validate boundary need
  if (detection.primaryState === 'overgiving') return 'validate_boundary_need';

  // Fatigue without high slider → boundary education
  if (detection.primaryState === 'boundary_fatigue') return 'validate_boundary_need';

  // Default
  return 'boundary_education';
}

function generateBoundaryStatement(
  detection: K01DetectionResult,
  interventionType: K01InterventionType,
): string | null {
  // Only provide concrete boundary statements for practice/repair
  if (interventionType !== 'boundary_practice' && interventionType !== 'boundary_repair') {
    return null;
  }

  switch (detection.primaryState) {
    case 'boundary_fatigue':
      return '"Ik heb ruimte nodig om voor mezelf te zorgen. Dat is geen straf, dat is informatie." / "I need space to take care of myself. That is not punishment, that is information."';
    case 'boundary_collapse':
      return '"Mijn grens is niet veranderd. Ik kies ervoor om hem opnieuw neer te zetten." / "My boundary has not changed. I choose to set it again."';
    case 'overgiving':
      return '"Ik kan van je houden zonder mezelf te verliezen." / "I can love you without losing myself."';
    case 'fear_of_abandonment':
      return '"Een grens stellen is geen vertrekken. Het is zeggen: ik blijf, maar niet op deze manier." / "Setting a boundary is not leaving. It is saying: I stay, but not like this."';
    default:
      return null;
  }
}

export function routeK01Engine(
  detection: K01DetectionResult,
  boundaryFatigue: number,
  progress: K01Progress | undefined,
): K01RoutingResult {
  if (!detection.activated) {
    return {
      activated: false,
      interventionType: 'boundary_education',
      primaryState: 'none',
      severity: 'mild',
      collapseRisk: false,
      boundaryStatement: null,
      doNots: [],
      promptBlock: null,
    };
  }

  const interventionType = selectInterventionType(detection, boundaryFatigue);
  const boundaryStatement = generateBoundaryStatement(detection, interventionType);

  const result: K01RoutingResult = {
    activated: true,
    interventionType,
    primaryState: detection.primaryState,
    severity: detection.severity,
    collapseRisk: detection.collapseRisk,
    boundaryStatement,
    doNots: DO_NOTS,
    promptBlock: null,
  };

  result.promptBlock = buildK01PromptBlock(result, detection, progress);
  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ════════════════════════════════════════════════════════════════════════════════

const INTERVENTION_GUIDANCE: Record<K01InterventionType, string> = {
  validate_boundary_need: 'VALIDATE BOUNDARY NEED: The caregiver\'s boundary is justified. Affirm their right to limits. "A boundary is not punishment — it is information about what you need to stay whole."',
  normalize_guilt: 'NORMALIZE GUILT: Guilt after a boundary is normal, not proof of wrongdoing. "Guilt tells you that you care, not that you were wrong. The discomfort of a boundary is not the same as causing harm."',
  boundary_repair: 'BOUNDARY REPAIR: A boundary that collapsed can be reset. No shame. "A boundary that fell is not a failure. It is a practice. You can set it again, right now."',
  boundary_education: 'BOUNDARY EDUCATION: Help the caregiver understand what a boundary is. "A boundary is not a wall. It is a door with a handle on your side. It tells the other person where you end and they begin."',
  boundary_practice: 'BOUNDARY PRACTICE: Help the caregiver formulate a concrete boundary. Use simple, non-aggressive language. No justification needed. "I" statements. Short. Clear.',
};

const STATE_CONTEXT: Record<K01BoundaryState, string> = {
  boundary_fatigue: 'BOUNDARY FATIGUE: The caregiver is exhausted from repeated boundary violations. Validate their fatigue. Do not add more tasks.',
  guilt_after_boundary: 'GUILT AFTER BOUNDARY: The caregiver set a boundary and now feels guilty. This is normal. Do not reinforce the guilt.',
  boundary_collapse: 'BOUNDARY COLLAPSE: A previously set boundary has fallen. No shame. Help rebuild without judgment.',
  fear_of_abandonment: 'FEAR OF ABANDONMENT: The caregiver fears losing the relationship if they set boundaries. Validate the fear, then separate boundary from abandonment.',
  boundary_confusion: 'BOUNDARY CONFUSION: The caregiver does not know what is reasonable. Help clarify without prescribing.',
  overgiving: 'OVERGIVING: The caregiver gives more than they have. Help them see the pattern without blame.',
  none: '',
};

const COLLAPSE_RISK_INSTRUCTION = `COLLAPSE RISK ACTIVE:
- The caregiver's boundary is at risk of falling
- Priority: stabilize the boundary before exploring emotions
- Short, clear affirmations of the boundary's validity
- Do NOT add complexity or relational processing now`;

function buildK01PromptBlock(
  routing: K01RoutingResult,
  detection: K01DetectionResult,
  progress: K01Progress | undefined,
): string {
  const lines: string[] = [];
  lines.push('=== K01 BOUNDARY SETTING (KIM DEFAULT MODULE) ===');
  lines.push('Core principles:');
  lines.push('1. A boundary is not punishment — it is information');
  lines.push('2. Love does not require self-destruction');
  lines.push('3. Guilt after a boundary is normal, not proof of wrongdoing');
  lines.push('4. Never demonize the partner');
  lines.push('5. Never make the caregiver responsible for the other\'s recovery');
  lines.push('');

  // State context
  lines.push(`Primary state: ${detection.primaryState} (severity: ${detection.severity})`);
  if (detection.secondaryStates.length > 0) {
    lines.push(`Secondary states: ${detection.secondaryStates.join(', ')}`);
  }
  if (detection.primaryState !== 'none') {
    lines.push(STATE_CONTEXT[detection.primaryState]);
  }
  lines.push('');

  // Intervention type
  lines.push(`Intervention: ${routing.interventionType}`);
  lines.push(INTERVENTION_GUIDANCE[routing.interventionType]);
  lines.push('');

  // Collapse risk
  if (routing.collapseRisk) {
    lines.push(COLLAPSE_RISK_INSTRUCTION);
    lines.push('');
  }

  // Boundary statement (if available)
  if (routing.boundaryStatement) {
    lines.push(`BOUNDARY STATEMENT (offer if appropriate): ${routing.boundaryStatement}`);
    lines.push('');
  }

  // Repeated violations
  if (detection.repeatedViolationCount >= 2) {
    lines.push(`REPEATED VIOLATIONS (${detection.repeatedViolationCount}): This boundary has been crossed multiple times. Acknowledge the pattern without blame. Help the caregiver decide what consequence fits.`);
    lines.push('');
  }

  // Progress context
  if (progress) {
    if (progress.sessionsWithCollapse >= 3) {
      lines.push(`RECURRING COLLAPSE PATTERN: This caregiver has experienced boundary collapse in ${progress.sessionsWithCollapse} sessions. Consider exploring what makes the boundary hard to maintain.`);
      lines.push('');
    }
    if (progress.sessionsWithGuiltAfterBoundary >= 3) {
      lines.push(`RECURRING GUILT PATTERN: Guilt after boundaries appears in ${progress.sessionsWithGuiltAfterBoundary} sessions. This guilt may be conditioned. Gently explore its origin.`);
      lines.push('');
    }
    if (progress.boundaryStabilityTrend === 'declining') {
      lines.push(`DECLINING STABILITY: Boundary stability is declining over sessions. Consider whether external pressure is increasing or internal resources are depleted.`);
      lines.push('');
    }
  }

  // Do NOTs
  lines.push('DO NOTs:');
  for (const doNot of DO_NOTS) {
    lines.push(`- ${doNot}`);
  }

  lines.push('=== END K01 ===');
  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════════════════
// PROGRESS UPDATE
// ════════════════════════════════════════════════════════════════════════════════

export function updateK01Progress(
  current: K01Progress | undefined,
  detection: K01DetectionResult,
  interventionType: K01InterventionType,
): K01Progress {
  const p = current ?? createDefaultK01Progress();
  const updated: K01Progress = { ...p };

  if (detection.primaryState === 'boundary_fatigue') updated.sessionsWithBoundaryFatigue++;
  if (detection.primaryState === 'guilt_after_boundary') updated.sessionsWithGuiltAfterBoundary++;
  if (detection.primaryState === 'boundary_collapse') updated.sessionsWithCollapse++;
  if (detection.primaryState === 'fear_of_abandonment') updated.sessionsWithAbandonmentFear++;

  if (interventionType === 'boundary_repair') updated.boundaryRepairAttempts++;
  if (interventionType === 'boundary_practice') updated.boundaryPracticeCount++;

  updated.lastInterventionType = interventionType;
  updated.lastSessionDate = new Date().toISOString();

  // Trend calculation
  const totalSessions = updated.sessionsWithBoundaryFatigue + updated.sessionsWithGuiltAfterBoundary +
    updated.sessionsWithCollapse + updated.sessionsWithAbandonmentFear;

  if (totalSessions <= 2) {
    updated.boundaryStabilityTrend = 'unknown';
  } else if (updated.sessionsWithCollapse >= 3 || (updated.sessionsWithBoundaryFatigue >= 4 && updated.sessionsWithCollapse >= 2)) {
    updated.boundaryStabilityTrend = 'declining';
  } else if (updated.boundaryPracticeCount >= 3 && updated.sessionsWithCollapse <= 1) {
    updated.boundaryStabilityTrend = 'improving';
  } else {
    updated.boundaryStabilityTrend = 'stable';
  }

  return updated;
}
