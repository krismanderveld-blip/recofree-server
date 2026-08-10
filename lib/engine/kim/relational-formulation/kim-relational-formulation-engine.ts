/**
 * Kim Relational Formulation Engine V1
 * Pure client-side deterministic engine.
 * No runtime integration. No server calls. No memory writes.
 * Produces a KimRelationalFormulationContext based on explicit input.
 */

import type {
  KimFormulationMode,
  KimRelationalSeverity,
  KimRelationalDomain,
  KimRelationalFormulationContext,
  KimRelationalFact,
  KimImpactStatement,
  KimBehaviorFunction,
  KimResponsibilityMapItem,
  KimDomainSeparation,
  KimRepairCondition,
} from './kim-relational-formulation-types';

import {
  createEmptyKimRelationalFormulationContext,
  validateKimRelationalFormulationContext,
  getAllowedKimFormulationLayers,
} from './kim-relational-formulation-contract';

// ── Input Type ──

export interface KimRelationalFormulationInput {
  userMessage: string;
  persona: 'kim' | string;
  effectiveDepth: 'none' | 'low' | 'medium' | 'high';
  safetyActive: boolean;
  crisisActive: boolean;
  relationalHarmPatternActive: boolean;
  guidanceDepth?: 'light' | 'normal' | 'deep';
  currentZone?: 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'unknown';
  moduleId?: string | null;
  memoryFacts?: string[];
  engineSignals?: string[];
  localTimestamp: string;
  normalizedMessage?: string;
  semanticThemes?: string[];
  semanticResolvedModule?: string | null;
  semanticMatchedTheme?: string | null;
  semanticSource?: 'nano' | 'local_llm' | 'deterministic' | 'none';
  cmdMemory?: import('@/lib/engine/shared/clinical-memory-distillation/clinical-memory-distillation-types').KimMemoryBridge | null;
}

// ── Pattern Detection Types ──

interface DetectedPattern {
  domains: KimRelationalDomain[];
  severity: KimRelationalSeverity;
  mustMention: string[];
  mustAvoid: string[];
  facts: KimRelationalFact[];
  caregiverImpacts: KimImpactStatement[];
  domainSeparations: KimDomainSeparation[];
  repairConditions: KimRepairCondition[];
  behaviorFunctions: KimBehaviorFunction[];
}

// ── Repetition markers ──

const REPETITION_MARKERS = /weer|alweer|nog eens|meerdere keren|telkens|opnieuw|altijd|al vaak|again|repeatedly|every time/i;

// ── Pattern 1: Trust / lying / betrayal ──

const TRUST_TRIGGERS = /liegen|gelogen|bedrogen|vreemdgegaan|vertrouwen kapot|verraad|geheim|niet eerlijk|broken trust|cheated|lied|betrayal/i;

function detectTrust(text: string): DetectedPattern | null {
  if (!TRUST_TRIGGERS.test(text)) return null;
  const isRepeated = REPETITION_MARKERS.test(text);
  return {
    domains: ['trust', 'honesty', 'relationship_repair'],
    severity: isRepeated ? 'repeated_pattern' : 'single_event',
    mustMention: [
      'herhaald vertrouwen herstellen vraagt meer dan stoppen met liegen',
      'herstel vraagt voorspelbaar gedrag over tijd',
    ],
    mustAvoid: ['vergeef hem', 'vertrouw hem opnieuw', 'je moet blijven', 'je moet weggaan'],
    facts: [{ id: 'f-trust-1', text: 'vertrouwensbreuk gedetecteerd', source: 'user_message', confidence: isRepeated ? 'high' : 'medium' }],
    caregiverImpacts: [{ id: 'ci-trust-1', domain: 'trust', text: 'vertrouwen is beschadigd door herhaald of eenmalig liegen/bedrog', confidence: isRepeated ? 'high' : 'medium' }],
    domainSeparations: [],
    repairConditions: [{ id: 'rc-trust-1', condition: 'consistente eerlijkheid over langere periode', owner: 'dependent_person', nonNegotiable: true, confidence: 'high' }],
    behaviorFunctions: isRepeated ? [{ id: 'bf-trust-1', behavior: 'herhaald liegen', possibleFunction: 'schaamte of consequenties vermijden', explanationNotExcuse: true, owner: 'dependent_person', confidence: 'medium' }] : [],
  };
}

// ── Pattern 2: Affection / intimacy / sex pressure ──

const AFFECTION_TRIGGERS = /geen affectie|geen zin in seks|seks|intimiteit|aanraking|druk|ik duw|hij duwt|verplicht|tegen mijn zin|affection|intimacy|sex|pressure/i;
const SEX_PRESSURE_TRIGGERS = /druk|verplicht|tegen mijn zin|hij duwt|pressure|moet seks/i;

function detectAffection(text: string): DetectedPattern | null {
  if (!AFFECTION_TRIGGERS.test(text)) return null;
  const hasSexPressure = SEX_PRESSURE_TRIGGERS.test(text);
  const hasNuchterheid = /nuchter|sober|gestopt met drinken|clean/i.test(text) && /geen affectie|vertrouwen|relatie|afstand|koud|intimiteit/i.test(text);
  return {
    domains: hasSexPressure ? ['affection', 'intimacy', 'sexual_pressure', 'trust'] : ['affection', 'intimacy', 'trust'],
    severity: REPETITION_MARKERS.test(text) ? 'repeated_pattern' : 'single_event',
    mustMention: [
      'affectie kan verdwijnen wanneer veiligheid of vrijheid ontbreekt',
      'seks of nabijheid mag nooit als herstelbewijs worden opgeëist',
      'verlangen en druk moeten uit elkaar gehouden worden',
      ...(hasSexPressure ? ['seksuele nabijheid is pas veilig wanneer nee zeggen veilig voelt', 'vrij voelen betekent dat stoppen, vertragen of weigeren geen straf, druk of verwijt oproept'] : []),
      ...(hasNuchterheid ? ['nuchter worden is niet hetzelfde als relationeel herstellen'] : []),
    ],
    mustAvoid: ['seks hoort erbij', 'je moet seks hebben', 'als je van hem houdt dan'],
    facts: [{ id: 'f-aff-1', text: 'affectie/intimiteit thema gedetecteerd', source: 'user_message', confidence: 'medium' }],
    caregiverImpacts: [{ id: 'ci-aff-1', domain: hasSexPressure ? 'sexual_pressure' : 'affection', text: 'affectie of nabijheid voelt niet veilig of vrij', confidence: 'medium' }],
    domainSeparations: [
      { id: 'ds-aff-1', domainA: 'intimacy', domainB: 'sexual_pressure', distinction: 'Intimiteit vraagt vrije veiligheid; druk maakt nabijheid minder veilig.', mustMention: hasSexPressure },
      ...(hasNuchterheid ? [{ id: 'ds-aff-nuchter', domainA: 'addiction_recovery' as KimRelationalDomain, domainB: 'relationship_repair' as KimRelationalDomain, distinction: 'Nuchter worden is niet hetzelfde als relationeel herstellen. Verslaving stoppen herstelt niet automatisch vertrouwen of affectie.', mustMention: true }] : []),
    ],
    repairConditions: [{ id: 'rc-aff-1', condition: 'nabijheid zonder druk of verwachting', owner: 'both', nonNegotiable: true, confidence: 'medium' }],
    behaviorFunctions: [],
  };
}

// ── Pattern 3: Stay / leave / decision pressure ──

const DECISION_TRIGGERS = /moet ik blijven|moet ik weggaan|relatie stoppen|uit elkaar|scheiden|is dit nog herstelbaar|should I stay|should I leave|break up/i;

function detectDecision(text: string): DetectedPattern | null {
  if (!DECISION_TRIGGERS.test(text)) return null;
  return {
    domains: ['boundary_pressure', 'relationship_repair', 'safety'],
    severity: 'unknown',
    mustMention: [
      'Kim neemt de beslissing niet over',
      'herstelbaarheid hangt af van veiligheid, eerlijkheid, verantwoordelijkheid en gedrag over tijd',
      'geen beslissing nemen is soms ook tijdelijk reguleren, niet falen',
    ],
    mustAvoid: ['je moet blijven', 'je moet weggaan'],
    facts: [{ id: 'f-dec-1', text: 'beslissingsdruk gedetecteerd', source: 'user_message', confidence: 'high' }],
    caregiverImpacts: [{ id: 'ci-dec-1', domain: 'boundary_pressure', text: 'druk om een relationele beslissing te nemen', confidence: 'high' }],
    domainSeparations: [],
    repairConditions: [{ id: 'rc-dec-1', condition: 'veiligheid, eerlijkheid en verantwoordelijkheid als voorwaarden voor herstel', owner: 'both', nonNegotiable: false, confidence: 'medium' }],
    behaviorFunctions: [],
  };
}

// ── Pattern 4: Caregiving load / self-loss ──

const CAREGIVING_TRIGGERS = /ik draag alles|ik kan niet meer|ik verlies mezelf|alles draait om hem|ik ben uitgeput|ik zorg voor alles|I carry everything|exhausted|losing myself/i;

function detectCaregiving(text: string): DetectedPattern | null {
  if (!CAREGIVING_TRIGGERS.test(text)) return null;
  return {
    domains: ['caregiving_load', 'self_loss', 'boundary_pressure'],
    severity: REPETITION_MARKERS.test(text) ? 'chronic_pattern' : 'repeated_pattern',
    mustMention: [
      'steun mag niet betekenen dat jij verdwijnt',
      'eigen regie herstellen is geen liefdeloosheid',
      'grenzen beschermen ook de relatie waar dat nog veilig kan',
    ],
    mustAvoid: [],
    facts: [{ id: 'f-care-1', text: 'overbelasting en zelfverlies gedetecteerd', source: 'user_message', confidence: 'high' }],
    caregiverImpacts: [{ id: 'ci-care-1', domain: 'caregiving_load', text: 'draagt te veel alleen, verliest zichzelf in de zorg', confidence: 'high' }],
    domainSeparations: [{ id: 'ds-care-1', domainA: 'relationship_repair', domainB: 'caregiving_load', distinction: 'Gedrag begrijpen betekent niet dat jij de gevolgen alleen moet dragen.', mustMention: true }],
    repairConditions: [{ id: 'rc-care-1', condition: 'gedeelde verantwoordelijkheid voor het dagelijks leven', owner: 'both', nonNegotiable: false, confidence: 'medium' }],
    behaviorFunctions: [],
  };
}

// ── Pattern 5: Control / avoidance loop ──

const CONTROL_TRIGGERS = /ik controleer|ik check|ik stuur|hij ontwijkt|hij klapt dicht|ik moet alles weten|controleren|avoid|withdraw|control/i;

function detectControl(text: string): DetectedPattern | null {
  if (!CONTROL_TRIGGERS.test(text)) return null;
  return {
    domains: ['control', 'avoidance', 'communication', 'boundary_pressure'],
    severity: REPETITION_MARKERS.test(text) ? 'repeated_pattern' : 'single_event',
    mustMention: [
      'controle kan een poging zijn om veiligheid te voelen',
      'ontwijken kan spanning tijdelijk verlagen maar vertrouwen verder beschadigen',
      'het patroon is vaak controleur versus ontwijker, niet simpel dader versus slachtoffer',
      'een eerste reparatiestap is een afgesproken eerlijkheidsmoment zonder ondervraging en zonder ontwijken',
    ],
    mustAvoid: [],
    facts: [{ id: 'f-ctrl-1', text: 'controle-ontwijking patroon gedetecteerd', source: 'user_message', confidence: 'medium' }],
    caregiverImpacts: [{ id: 'ci-ctrl-1', domain: 'control', text: 'controlegedrag als poging tot veiligheid', confidence: 'medium' }],
    domainSeparations: [],
    repairConditions: [
      { id: 'rc-ctrl-1', condition: 'open communicatie zonder controle of ontwijking', owner: 'both', nonNegotiable: false, confidence: 'medium' },
      { id: 'rc-ctrl-2', condition: 'het patroon kan pas zakken als eerlijkheid voorspelbaar wordt en controle niet de enige veiligheidsstrategie blijft', owner: 'both', nonNegotiable: false, confidence: 'medium' },
    ],
    behaviorFunctions: [{ id: 'bf-ctrl-1', behavior: 'controleren of checken', possibleFunction: 'veiligheid zoeken na vertrouwensbreuk', explanationNotExcuse: true, owner: 'caregiver', confidence: 'medium' }],
  };
}

// ── Pattern 6: Child trust ──

const CHILD_TRIGGERS = /kind|kinderen|zoon|dochter|stiefkind|vertrouwt hem niet|wil hem niet zien|child|children|son|daughter/i;

function detectChildTrust(text: string): DetectedPattern | null {
  if (!CHILD_TRIGGERS.test(text)) return null;
  return {
    domains: ['child_trust', 'relationship_repair', 'trust'],
    severity: 'unknown',
    mustMention: [
      'partnerherstel is niet hetzelfde als kindvertrouwen',
      'een kind kan niet verplicht worden om opnieuw te vertrouwen',
      'herstel naar kinderen vraagt stabiel gedrag over tijd',
    ],
    mustAvoid: ['kinderen moeten hem opnieuw vertrouwen'],
    facts: [{ id: 'f-child-1', text: 'kindvertrouwen thema gedetecteerd', source: 'user_message', confidence: 'medium' }],
    caregiverImpacts: [{ id: 'ci-child-1', domain: 'child_trust', text: 'kind(eren) betrokken bij vertrouwensherstel', confidence: 'medium' }],
    domainSeparations: [{ id: 'ds-child-1', domainA: 'trust', domainB: 'child_trust', distinction: 'Partnervertrouwen en kindvertrouwen zijn aparte herstelprocessen.', mustMention: true }],
    repairConditions: [{ id: 'rc-child-1', condition: 'stabiel gedrag over langere periode richting kinderen', owner: 'dependent_person', nonNegotiable: true, confidence: 'high' }],
    behaviorFunctions: [],
  };
}

// ── Pattern 7: Shame / guilt ──

const SHAME_TRIGGERS = /schaamte|schuld|ik voel mij schuldig|shame|guilt/i;

function detectShame(text: string): DetectedPattern | null {
  if (!SHAME_TRIGGERS.test(text)) return null;
  return {
    domains: ['shame', 'relationship_repair'],
    severity: 'unknown',
    mustMention: [
      'schuld kan richting geven zonder jezelf te vernietigen',
      'verantwoordelijkheid nemen is niet hetzelfde als jezelf haten',
    ],
    mustAvoid: [],
    facts: [{ id: 'f-shame-1', text: 'schaamte of schuld gedetecteerd', source: 'user_message', confidence: 'medium' }],
    caregiverImpacts: [{ id: 'ci-shame-1', domain: 'shame', text: 'schuld- of schaamtegevoel aanwezig', confidence: 'medium' }],
    domainSeparations: [],
    repairConditions: [],
    behaviorFunctions: [],
  };
}

// ── Pattern 8: Grief / loss ──

const GRIEF_TRIGGERS = /rouw|verlies|kwijt|missen|grief|loss/i;

function detectGrief(text: string): DetectedPattern | null {
  if (!GRIEF_TRIGGERS.test(text)) return null;
  return {
    domains: ['grief', 'self_loss', 'relationship_repair'],
    severity: 'unknown',
    mustMention: [
      'rouw kan ook bestaan terwijl iemand nog leeft',
      'je kunt rouwen om vertrouwen, rust of de relatie zoals die was',
    ],
    mustAvoid: [],
    facts: [{ id: 'f-grief-1', text: 'rouw of verlies gedetecteerd', source: 'user_message', confidence: 'medium' }],
    caregiverImpacts: [{ id: 'ci-grief-1', domain: 'grief', text: 'rouw om wat verloren is of veranderd', confidence: 'medium' }],
    domainSeparations: [],
    repairConditions: [],
    behaviorFunctions: [],
  };
}

// ── Default responsibility map ──

function buildDefaultResponsibilityMap(): KimResponsibilityMapItem[] {
  return [
    {
      id: 'rm-cg-1',
      owner: 'caregiver',
      responsibility: 'eigen grenzen, eigen regie, eigen veiligheid, eigen herstelruimte',
      notResponsibleFor: ['gebruik van de ander', 'nuchterheid van de ander', 'eerlijkheid van de ander', 'therapietrouw van de ander'],
      confidence: 'high',
    },
    {
      id: 'rm-dp-1',
      owner: 'dependent_person',
      responsibility: 'eerlijkheid, nuchter gedrag, herstelgedrag, herstelbare schade benoemen',
      notResponsibleFor: ['gedwongen affectie van caregiver', 'gedwongen vertrouwen van caregiver', 'gedwongen seks van caregiver'],
      confidence: 'high',
    },
    {
      id: 'rm-both-1',
      owner: 'both',
      responsibility: 'communicatie voor zover veilig en mogelijk',
      notResponsibleFor: [],
      confidence: 'medium',
    },
  ];
}

// ── Default domain separations ──

function buildRelevantDomainSeparations(domains: KimRelationalDomain[]): KimDomainSeparation[] {
  const separations: KimDomainSeparation[] = [];
  if (domains.includes('addiction_recovery') || domains.includes('relationship_repair')) {
    separations.push({ id: 'ds-ar-rr', domainA: 'addiction_recovery', domainB: 'relationship_repair', distinction: 'Nuchter worden is niet hetzelfde als relationeel herstellen.', mustMention: true });
  }
  if (domains.includes('trust') && domains.includes('affection')) {
    separations.push({ id: 'ds-t-a', domainA: 'trust', domainB: 'affection', distinction: 'Vertrouwen en affectie herstellen niet altijd op hetzelfde tempo.', mustMention: false });
  }
  return separations;
}

// ── Ending style resolver ──

function resolveEndingStyle(mode: KimFormulationMode, domains: KimRelationalDomain[], hasRepairConditions: boolean): 'directive' | 'reflective' | 'grounding' | 'boundary' | 'repair' {
  if (mode === 'safety_blocked') return 'grounding';
  if (mode === 'insufficient_context') return 'reflective';
  if (domains.includes('boundary_pressure') || domains.includes('sexual_pressure')) return 'boundary';
  if (hasRepairConditions) return 'repair';
  if (mode === 'high') return 'directive';
  if (mode === 'low') return 'reflective';
  return 'repair';
}

// ── Max questions resolver ──

function resolveMaxQuestions(mode: KimFormulationMode, mustMentionCount: number): 0 | 1 {
  if (mode === 'safety_blocked') return 0;
  if (mode === 'high' && mustMentionCount >= 3) return 0;
  return 1;
}

// ── Main Engine Function ──

export function buildKimRelationalFormulationContext(
  input: KimRelationalFormulationInput
): KimRelationalFormulationContext {
  // Non-kim persona
  if (input.persona !== 'kim') {
    return createEmptyKimRelationalFormulationContext();
  }

  // Safety/crisis
  if (input.safetyActive || input.crisisActive) {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.mode = 'safety_blocked';
    ctx.severity = 'acute_safety';
    ctx.activeDomains = ['safety'];
    ctx.activeLayers = ['safety_limits'];
    ctx.safetyLimits = ['veiligheid gaat voor verbinding', 'stabiliseren eerst'];
    ctx.endingStyle = 'grounding';
    ctx.maxQuestions = 0;
    ctx.createdAtLocal = input.localTimestamp;
    return ctx;
  }

  // Empty message
  const primaryText = input.normalizedMessage ?? input.userMessage;
  if (!primaryText || primaryText.trim().length === 0) {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.mode = 'insufficient_context';
    ctx.createdAtLocal = input.localTimestamp;
    return ctx;
  }

  // Depth none
  if (input.effectiveDepth === 'none') {
    return createEmptyKimRelationalFormulationContext();
  }

  // Determine mode
  const mode: KimFormulationMode = input.effectiveDepth as KimFormulationMode;

  // Combine text sources for detection
  const combinedText = [
    primaryText,
    ...(primaryText !== input.userMessage ? [input.userMessage] : []),
    ...(input.memoryFacts || []),
    ...(input.engineSignals || []),
    ...(input.semanticThemes || []),
  ].join(' ');

  // Run all pattern detectors
  const detectors = [detectTrust, detectAffection, detectDecision, detectCaregiving, detectControl, detectChildTrust, detectShame, detectGrief];
  const detectedPatterns: DetectedPattern[] = [];
  for (const detector of detectors) {
    const result = detector(combinedText);
    if (result) detectedPatterns.push(result);
  }

  // If no patterns detected
  if (detectedPatterns.length === 0) {
    const ctx = createEmptyKimRelationalFormulationContext();
    ctx.mode = 'insufficient_context';
    ctx.createdAtLocal = input.localTimestamp;
    return ctx;
  }

  // Merge detected patterns
  const allDomains = new Set<KimRelationalDomain>();
  const allMustMention = new Set<string>();
  const allMustAvoid = new Set<string>();
  const allFacts: KimRelationalFact[] = [];
  const allImpacts: KimImpactStatement[] = [];
  const allDomainSeps: KimDomainSeparation[] = [];
  const allRepairConds: KimRepairCondition[] = [];
  const allBehaviorFuncs: KimBehaviorFunction[] = [];
  let highestSeverity: KimRelationalSeverity = 'unknown';

  const severityOrder: KimRelationalSeverity[] = ['unknown', 'single_event', 'repeated_pattern', 'chronic_pattern', 'escalating_pattern', 'acute_safety'];

  for (const pattern of detectedPatterns) {
    for (const d of pattern.domains) allDomains.add(d);
    for (const m of pattern.mustMention) allMustMention.add(m);
    for (const a of pattern.mustAvoid) allMustAvoid.add(a);
    allFacts.push(...pattern.facts);
    allImpacts.push(...pattern.caregiverImpacts);
    allDomainSeps.push(...pattern.domainSeparations);
    allRepairConds.push(...pattern.repairConditions);
    allBehaviorFuncs.push(...pattern.behaviorFunctions);
    if (severityOrder.indexOf(pattern.severity) > severityOrder.indexOf(highestSeverity)) {
      highestSeverity = pattern.severity;
    }
  }

  // Add default domain separations
  const domainsArray = Array.from(allDomains);
  const defaultSeps = buildRelevantDomainSeparations(domainsArray);
  for (const sep of defaultSeps) {
    if (!allDomainSeps.some(s => s.domainA === sep.domainA && s.domainB === sep.domainB)) {
      allDomainSeps.push(sep);
    }
  }

  // Get allowed layers
  const allowedLayers = getAllowedKimFormulationLayers(mode, input.safetyActive);

  // Build responsibility map
  const responsibilityMap = buildDefaultResponsibilityMap();

  // Build core hypothesis (high only)
  let coreHypothesis: string | null = null;
  if (mode === 'high' && allowedLayers.includes('core_hypothesis')) {
    const primaryDomain = domainsArray[0] || 'unknown';
    coreHypothesis = `Het patroon rond ${primaryDomain} wijst op herhaalde schade die herstelvoorwaarden vereist van beide kanten, zonder dat Kim een kant kiest of een beslissing oplegt.`;
  }

  // Resolve ending style and max questions
  const endingStyle = resolveEndingStyle(mode, domainsArray, allRepairConds.length > 0);
  const maxQuestions = resolveMaxQuestions(mode, allMustMention.size);

  // Build context
  const context: KimRelationalFormulationContext = {
    schemaVersion: 'kim_relational_formulation_v1',
    persona: 'kim',
    mode,
    severity: highestSeverity,
    activeDomains: domainsArray,
    activeLayers: allowedLayers,
    facts: allFacts,
    caregiverImpacts: allImpacts,
    dependentHypotheses: mode === 'medium' || mode === 'high' ? [{ id: 'dh-1', domain: domainsArray[0] || 'unknown', text: 'de ander handelt mogelijk vanuit eigen pijn, angst of schaamte', confidence: 'low' }] : [],
    causalChains: allowedLayers.includes('causal_chain') ? ['vertrouwensbreuk → controle → ontwijking → verdere afstand'] : [],
    feedbackLoops: allowedLayers.includes('feedback_loop') ? ['meer controle → meer ontwijking → minder vertrouwen → meer controle'] : [],
    behaviorFunctions: allowedLayers.includes('behavior_functions') ? allBehaviorFuncs : [],
    roleShifts: allowedLayers.includes('role_shift') ? ['van partner naar verzorger', 'van gelijkwaardig naar ongelijkwaardig'] : [],
    domainSeparations: allowedLayers.includes('domain_separation') ? allDomainSeps : [],
    responsibilityMap: allowedLayers.includes('responsibility_map') ? responsibilityMap : [],
    counterHypotheses: allowedLayers.includes('counter_hypotheses') ? ['het gedrag kan ook voortkomen uit onmacht, niet uit kwade wil'] : [],
    timeDynamics: allowedLayers.includes('time_dynamics') ? ['herstel is niet lineair; terugval in gedrag is niet hetzelfde als terugval in intentie'] : [],
    coreHypothesis,
    safetyLimits: [],
    repairConditions: allowedLayers.includes('repair_conditions') ? allRepairConds : [],
    mustMention: Array.from(allMustMention),
    mustAvoid: Array.from(allMustAvoid),
    maxQuestions,
    endingStyle,
    confidence: highestSeverity === 'unknown' ? 'low' : highestSeverity === 'single_event' ? 'medium' : 'high',
    createdAtLocal: input.localTimestamp,
  };

  // Validate output
  const validation = validateKimRelationalFormulationContext(context);
  if (!validation.ok) {
    const fallback = createEmptyKimRelationalFormulationContext();
    fallback.mode = 'insufficient_context';
    fallback.mustAvoid = ['FORMULATION_VALIDATION_FAILED'];
    fallback.confidence = 'low';
    fallback.createdAtLocal = input.localTimestamp;
    return fallback;
  }

  return context;
}
