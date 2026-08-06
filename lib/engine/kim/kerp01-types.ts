/**
 * KERP01 — Kim Eigen Regie Plan Types
 *
 * Data model for the structured Eigen Regie Plan.
 * Analogous to VspStructuredPlan for Elias, but focused on:
 * - Self-loss recognition (zelfverlies)
 * - Over-involvement (overbetrokkenheid)
 * - Boundary exhaustion (grensuitputting)
 * - Emotional takeover (emotionele overname)
 * - Recovery of self-direction (herstel eigen koers)
 *
 * STORAGE: backpack.eigenRegiePlan (Kim only)
 * NEVER auto-modified by the system — user-controlled.
 */

// ─── Zone Entry ──────────────────────────────────────────────

export type EigenRegieZoneId = 'rood' | 'oranje' | 'geel' | 'lichtgroen' | 'donkergroen';

export interface EigenRegieZoneEntry {
  /** Zone label (e.g., "Rood — Ik verlies mezelf volledig") */
  label: string;
  /** What this zone means for the user */
  userMeaning: string;
  /** Recognition signals (thoughts, feelings, behaviors) */
  signals: string[];
  /** Body signals (physical sensations) */
  bodySignals: string[];
  /** Typical thoughts in this zone */
  thoughts: string[];
  /** Typical behaviours in this zone */
  behaviour: string[];
  /** What helps in this zone (concrete actions) */
  whatHelps: string[];
  /** Boundary actions (grensacties) */
  boundaryActions: string[];
  /** Contact rule for this zone */
  contactRule: string;
  /** Personal anchor sentence for this zone */
  anchorSentence: string;
  /** CONNECTION INTENT: What kind of connection is possible/desired in this zone */
  connectionIntent: string;
  /** BRIDGE SENTENCE: A sentence that keeps the door to the other person open in this zone */
  bridgeSentence: string;
  /** REPAIR CONDITION: What needs to happen before connection can deepen in this zone */
  repairCondition: string;
  /** SAFETY EXCEPTION: When connection is NOT safe in this zone (overrides connectionIntent) */
  safetyException: string;
}

// ─── Trigger ─────────────────────────────────────────────────

export interface EigenRegieTrigger {
  /** The trigger that undermines self-direction */
  trigger: string;
  /** The pattern of losing self-direction when this trigger fires */
  lossOfRegiePattern: string;
  /** The healthy response to this trigger */
  healthyResponse: string;
}

// ─── Source Metadata ─────────────────────────────────────────

export type KimBackpackSectionId =
  | 'my_story'
  | 'the_relationship'
  | 'the_impact'
  | 'my_boundaries'
  | 'my_strength';

export interface EigenRegiePlanSource {
  /** How the plan was created */
  createdFrom: 'manual' | 'wizard' | 'life_story_wizard' | 'mixed';
  /** Which backpack sections were used as source */
  usedBackpackSections: KimBackpackSectionId[];
  /** When the plan was generated (null if manual) */
  generatedAt: string | null;
  /** Whether the user has reviewed and confirmed the plan */
  userReviewed: boolean;
}

// ─── Main Plan ───────────────────────────────────────────────

export interface EigenRegiePlan {
  /** Schema version */
  version: 1;
  /** Persona lock — Kim only */
  persona: 'kim';
  /** Zone entries (5 zones) */
  zones: {
    rood: EigenRegieZoneEntry;
    oranje: EigenRegieZoneEntry;
    geel: EigenRegieZoneEntry;
    lichtgroen: EigenRegieZoneEntry;
    donkergroen: EigenRegieZoneEntry;
  };
  /** Personal triggers that undermine self-direction */
  triggers: EigenRegieTrigger[];
  /** Personal boundary rules */
  boundaryRules: string[];
  /** The overarching anchor sentence */
  mainAnchorSentence: string;
  /** Source metadata */
  source: EigenRegiePlanSource;
  /** Last updated timestamp */
  lastUpdated: string | null;
}

// ─── Default Empty Plan ──────────────────────────────────────

const EMPTY_ZONE: EigenRegieZoneEntry = {
  label: '',
  userMeaning: '',
  signals: [],
  bodySignals: [],
  thoughts: [],
  behaviour: [],
  whatHelps: [],
  boundaryActions: [],
  contactRule: '',
  anchorSentence: '',
  connectionIntent: '',
  bridgeSentence: '',
  repairCondition: '',
  safetyException: '',
};

export const DEFAULT_EIGEN_REGIE_PLAN: EigenRegiePlan = {
  version: 1,
  persona: 'kim',
  zones: {
    rood: { ...EMPTY_ZONE, label: 'Rood — Ik verlies mezelf volledig', userMeaning: 'Mijn dag, stemming en keuzes worden bijna volledig bepaald door de ander.', connectionIntent: 'Verbinding is nu niet veilig — eerst stabiliseren.', bridgeSentence: '', repairCondition: 'Ik moet eerst terug bij mezelf komen voordat contact mogelijk is.', safetyException: 'Bij gevaar, geweld of acute crisis: geen contact, alleen veiligheid.' },
    oranje: { ...EMPTY_ZONE, label: 'Oranje — Ik draai vooral rond de ander', userMeaning: 'Ik functioneer nog, maar mijn aandacht, energie en keuzes gaan vooral naar de ander.', connectionIntent: 'Kort, begrensd contact is mogelijk als ik bij mezelf blijf.', bridgeSentence: 'Ik wil er zijn, maar niet op een manier die mij kapotmaakt.', repairCondition: 'Contact alleen als ik mijn eigen grens kan vasthouden.', safetyException: '' },
    geel: { ...EMPTY_ZONE, label: 'Geel — Ik wissel tussen mezelf en de ander', userMeaning: 'Ik merk dat ik soms bij mezelf blijf en soms opnieuw word meegezogen.', connectionIntent: 'Verbinding is mogelijk met bewuste grenzen.', bridgeSentence: 'Ik wil verbonden blijven en tegelijk bij mezelf blijven.', repairCondition: '', safetyException: '' },
    lichtgroen: { ...EMPTY_ZONE, label: 'Lichtgroen — Ik kom terug bij mezelf', userMeaning: 'Ik hou rekening met de ander, maar mijn eigen leven blijft bestaan.', connectionIntent: 'Gezonde verbinding is mogelijk — ik kan aanwezig zijn zonder mezelf te verliezen.', bridgeSentence: 'Ik ben er voor jou en ook voor mezelf.', repairCondition: '', safetyException: '' },
    donkergroen: { ...EMPTY_ZONE, label: 'Donkergroen — Ik leef mijn eigen leven', userMeaning: 'Ik voel mij vrij genoeg om mijn eigen keuzes te maken, ongeacht wat de ander doet.', connectionIntent: 'Vrije verbinding — ik kies bewust wanneer en hoe ik er ben.', bridgeSentence: 'Ik ben beschikbaar vanuit keuze, niet vanuit angst.', repairCondition: '', safetyException: '' },
  },
  triggers: [],
  boundaryRules: [],
  mainAnchorSentence: '',
  source: {
    createdFrom: 'manual',
    usedBackpackSections: [],
    generatedAt: null,
    userReviewed: false,
  },
  lastUpdated: null,
};

// ─── Zone Mapping (from EigenRegieZone to EigenRegieZoneId) ──

/** Map the engine zone (ROOD/ORANJE/GEEL/LICHTGROEN/GROEN) to plan zone id */
export function engineZoneToZoneId(engineZone: string): EigenRegieZoneId {
  const map: Record<string, EigenRegieZoneId> = {
    'ROOD': 'rood',
    'ORANJE': 'oranje',
    'GEEL': 'geel',
    'LICHTGROEN': 'lichtgroen',
    'GROEN': 'donkergroen',
  };
  return map[engineZone] ?? 'geel';
}

// ─── Pipeline Context Builder ────────────────────────────────

/**
 * Build the prompt injection context from the Eigen Regie Plan.
 * Only injects the CURRENT zone entry + anchor + max 3 boundary rules.
 */
export function buildEigenRegiePromptContext(
  plan: EigenRegiePlan,
  currentZoneId: EigenRegieZoneId,
): string {
  const zone = plan.zones[currentZoneId];
  if (!zone || !zone.label) return '';

  const lines: string[] = [
    'KIM_EIGEN_REGIE_CONTEXT:',
    `currentZone: ${currentZoneId.toUpperCase()}`,
    `zoneMeaning: ${zone.userMeaning}`,
  ];

  if (zone.signals.length > 0) {
    lines.push('userSignals:');
    zone.signals.slice(0, 5).forEach(s => lines.push(`- ${s}`));
  }

  if (zone.whatHelps.length > 0) {
    lines.push('whatHelps:');
    zone.whatHelps.slice(0, 5).forEach(s => lines.push(`- ${s}`));
  }

  if (zone.boundaryActions.length > 0) {
    lines.push('boundaryActions:');
    zone.boundaryActions.slice(0, 3).forEach(s => lines.push(`- ${s}`));
  }

  if (zone.anchorSentence) {
    lines.push(`anchorSentence: ${zone.anchorSentence}`);
  }

  // Connection intent and relational fields
  if (zone.connectionIntent) {
    lines.push(`connectionIntent: ${zone.connectionIntent}`);
  }
  if (zone.bridgeSentence) {
    lines.push(`bridgeSentence: ${zone.bridgeSentence}`);
  }
  if (zone.repairCondition) {
    lines.push(`repairCondition: ${zone.repairCondition}`);
  }
  if (zone.safetyException) {
    lines.push(`safetyException: ${zone.safetyException}`);
  }

  if (plan.mainAnchorSentence) {
    lines.push(`mainAnchorSentence: ${plan.mainAnchorSentence}`);
  }

  // Max 3 boundary rules
  if (plan.boundaryRules.length > 0) {
    lines.push('boundaryRules:');
    plan.boundaryRules.slice(0, 3).forEach(r => lines.push(`- ${r}`));
  }

  lines.push('');
  lines.push('Kim instruction:');
  lines.push('Gebruik deze informatie als persoonlijke woorden van de gebruiker. Verwijs er alleen naar wanneer het natuurlijk en steunend is. Niet citeren als checklist. Niet beschuldigend gebruiken.');
  lines.push('RELATIONAL RULE: Use Eigen Regie Plan boundaries as bridge to safer contact, unless safety-first or RELATIONAL_HARM_PATTERN is active.');
  lines.push('- Normal friction: bridgeSentence may be actively used by Kim.');
  lines.push('- RELATIONAL_HARM_PATTERN: repairCondition first, bridgeSentence only after repair conditions are named.');
  lines.push('- Safety-first: safetyException first, do NOT force connection.');
  lines.push('- Low emotional load: connectionIntent to keep connection warm.');
  lines.push('- High emotional load: regulate first, then bridgeSentence.');
  lines.push('Use connectionIntent to guide how much connection Kim offers. Use bridgeSentence as the user\'s own words for staying connected. Use repairCondition to set conditions before deepening contact. If safetyException is set, it overrides connectionIntent — safety first.');

  return lines.join('\n');
}

// ─── Relevance Detection (LIVE_MESSAGE) ──────────────────────

const REGIE_KEYWORDS_NL = [
  'grens', 'grenzen', 'eigen regie', 'regie', 'controle', 'controleren',
  'schuld', 'schuldgevoel', 'uitputting', 'uitgeput', 'overbetrokken',
  'overbetrokkenheid', 'zelfverlies', 'mezelf kwijt', 'mezelf verlies',
  'redden', 'redder', 'reddersrol', 'opofferen', 'opoffering',
  'verantwoordelijk', 'verantwoordelijkheid', 'beschikbaar',
  'eigen behoeften', 'eigen leven', 'eigen koers', 'eigen keuzes',
  'begrenzen', 'nee zeggen', 'afstand', 'loslaten',
];

const REGIE_KEYWORDS_EN = [
  'boundary', 'boundaries', 'self-direction', 'control', 'controlling',
  'guilt', 'exhaustion', 'exhausted', 'over-involved', 'over-involvement',
  'self-loss', 'losing myself', 'rescuing', 'rescuer', 'sacrifice',
  'responsible', 'responsibility', 'available',
  'own needs', 'own life', 'own choices',
  'set limits', 'say no', 'distance', 'let go',
];

/**
 * Detect whether a message is relevant to eigen regie topics.
 * Used in LIVE_MESSAGE to decide whether to inject zone context.
 */
export function isRegieRelevant(message: string): boolean {
  const lower = message.toLowerCase();
  return REGIE_KEYWORDS_NL.some(kw => lower.includes(kw)) ||
    REGIE_KEYWORDS_EN.some(kw => lower.includes(kw));
}
