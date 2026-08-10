/**
 * Elias Recovery Formulation Engine V1
 * Pure client-side engine. No server calls. No memory writes. No pipeline integration.
 * No Kim imports. No nano imports. No FR/ES/PL trigger lists.
 * Uses normalizedMessage ?? userMessage for detection.
 */

import type {
  EliasFormulationMode,
  EliasRecoverySeverity,
  EliasRecoveryDomain,
  EliasFormulationLayerId,
  EliasRecoveryFormulationContext,
  EliasRecoveryFact,
  EliasTriggerChainItem,
  EliasCravingFunction,
  EliasResponsibilityMapItem,
  EliasAgencyMapItem,
  EliasStageOfChangeSignal,
  EliasSupportPlanItem,
  EliasRelapsePreventionStep,
} from './elias-recovery-formulation-types';

import {
  createEmptyEliasRecoveryFormulationContext,
  validateEliasRecoveryFormulationContext,
  getAllowedEliasFormulationLayers,
} from './elias-recovery-formulation-contract';

// ── Input Type ──

export interface EliasRecoveryFormulationInput {
  userMessage: string;
  persona: 'elias' | 'kim';
  effectiveDepth: 'none' | 'low' | 'medium' | 'high';
  safetyActive: boolean;
  crisisActive: boolean;
  relapseRiskActive: boolean;
  cravingLevel?: number | null;
  stressLevel?: number | null;
  moodLevel?: number | null;
  guidanceDepth?: 'light' | 'normal' | 'deep';
  currentZone?: 'green' | 'yellow' | 'orange' | 'red' | 'purple' | 'unknown';
  moduleId?: string | null;
  stageOfChange?: 'precontemplation' | 'contemplation' | 'preparation' | 'action' | 'maintenance' | 'relapse' | 'unknown';
  memoryFacts?: string[];
  engineSignals?: string[];
  normalizedMessage?: string;
  semanticThemes?: string[];
  semanticResolvedModule?: string | null;
  semanticMatchedTheme?: string | null;
  semanticSource?: 'nano' | 'local_llm' | 'deterministic' | 'none';
  localTimestamp: string;
}

// ── Pattern detection results ──

interface DetectedPattern {
  id: string;
  domains: EliasRecoveryDomain[];
  severity?: EliasRecoverySeverity;
  mustMention: string[];
  mustAvoid: string[];
  triggerChain?: EliasTriggerChainItem[];
  cravingFunctions?: EliasCravingFunction[];
  supportPlan?: EliasSupportPlanItem[];
  relapsePreventionSteps?: EliasRelapsePreventionStep[];
  agencyMap?: EliasAgencyMapItem[];
}

// ── Internal NL/EN patterns (no FR/ES/PL) ──

const CRAVING_PATTERNS = /\b(craving|trek|zin om te drinken|ik wil drinken|ik wil gebruiken|drang|urge|craving to drink|i want to drink|i want to use)\b/i;
const RELAPSE_RISK_PATTERNS = /\b(ik ga hervallen|ik sta op punt|ik kan het niet tegenhouden|ik ben bang dat ik ga drinken|relapse|about to relapse|i cannot stop myself|ga.*terugvallen)\b/i;
const POST_RELAPSE_PATTERNS = /\b(ik heb gedronken|ik ben hervallen|terugval gehad|ik heb gebruikt|relapse happened|i drank|i used|ik heb weer gedronken)\b/i;
const SHAME_PATTERNS = /\b(ik haat mezelf|ik ben zwak|ik ben slecht|ik ben hopeloos|schaamte|schuld|self.?hatred|i hate myself|i am weak|i am hopeless|waardeloos)\b/i;
const AVOIDANCE_PATTERNS = /\b(ik ontwijk|ik verberg|ik lieg|ik durf het niet zeggen|ik sluit mij af|ik kom niet opdagen|avoid|hiding|lying|i cannot tell them|i isolate|vermijd)\b/i;
const EMOTIONAL_OVERLOAD_PATTERNS = /\b(ik ben overspoeld|ik voel te veel|controle kwijt|paniek|spanning|stress|ik trek het niet|overwhelmed|panic|losing control|too much|overspoeld)\b/i;
const LONELINESS_PATTERNS = /\b(alleen|eenzaam|verlaten|afgewezen|ze negeert mij|hij negeert mij|ruzie|bang om verlaten te worden|lonely|abandoned|rejected|ignored|relationship fight)\b/i;
const MOTIVATION_PATTERNS = /\b(ik weet niet of ik wil stoppen|een deel van mij wil drinken|een deel wil herstellen|ik twijfel|ambivalent|i don't know if i want to stop|part of me wants to drink)\b/i;
const BODY_STATE_PATTERNS = /\b(moe|uitgeput|niet geslapen|slaap|trillen|zweten|hartslag|onrust|tired|exhausted|sleep|shaking|sweating|restless|slapeloosheid)\b/i;
const COLD_TURKEY_PATTERNS = /\b(plots stoppen|cold turkey|ineens stoppen|direct stoppen met zwaar drinken|detox|stop suddenly|quit cold turkey|abrupt stoppen)\b/i;

// ── Stage of change detection ──

const PREPARATION_PATTERNS = /\b(ik wil hulp|ik wil nuchter blijven|ik heb hulp nodig|i want help|i need help)\b/i;
const ACTION_PATTERNS = /\b(ik ga bellen|ik stuur iemand|ik leg alcohol weg|ik ga naar hulp|i will call|i am going to)\b/i;

// ── Main engine function ──

export function buildEliasRecoveryFormulationContext(input: EliasRecoveryFormulationInput): EliasRecoveryFormulationContext {
  // Rule 1: non-elias persona
  if (input.persona !== 'elias') {
    return { ...createEmptyEliasRecoveryFormulationContext(), createdAtLocal: input.localTimestamp };
  }

  // Rule 2: safety/crisis
  if (input.safetyActive || input.crisisActive) {
    return {
      ...createEmptyEliasRecoveryFormulationContext(),
      mode: 'safety_blocked',
      severity: 'acute_safety',
      activeDomains: ['safety'],
      activeLayers: ['safety_limits'],
      safetyLimits: ['Veiligheid eerst. Stabiliseer en verwijs.'],
      maxQuestions: 0,
      endingStyle: 'safety',
      createdAtLocal: input.localTimestamp,
    };
  }

  // Rule 3: empty message
  if (!input.userMessage.trim()) {
    return {
      ...createEmptyEliasRecoveryFormulationContext(),
      mode: 'insufficient_context',
      maxQuestions: 1,
      endingStyle: 'reflective',
      createdAtLocal: input.localTimestamp,
    };
  }

  // Rule 4: relapse risk or high craving
  const isAcuteRecoveryRisk = input.relapseRiskActive || (input.cravingLevel != null && input.cravingLevel >= 7.5);

  // Rule 5: effectiveDepth none
  if (input.effectiveDepth === 'none' && !isAcuteRecoveryRisk) {
    return { ...createEmptyEliasRecoveryFormulationContext(), createdAtLocal: input.localTimestamp };
  }

  // Determine mode
  let mode: EliasFormulationMode;
  if (isAcuteRecoveryRisk) {
    mode = 'acute_recovery_risk';
  } else {
    mode = input.effectiveDepth as EliasFormulationMode;
  }

  // Detection text
  const text = (input.normalizedMessage ?? input.userMessage).toLowerCase();
  const themes = input.semanticThemes ?? [];
  const resolvedModule = input.semanticResolvedModule ?? null;

  // Detect patterns
  const detected: DetectedPattern[] = [];

  // 1. Craving
  if (CRAVING_PATTERNS.test(text) || themes.includes('craving') || (resolvedModule && /craving/i.test(resolvedModule))) {
    detected.push({
      id: 'craving',
      domains: ['craving', 'relapse_prevention', 'agency', 'support_activation'],
      severity: input.cravingLevel != null && input.cravingLevel >= 7.5 ? 'escalating_risk' : input.cravingLevel != null && input.cravingLevel >= 5 ? 'relapse_risk' : 'active_craving',
      mustMention: ['craving is een signaal, geen bevel', 'de eerste herstelstap is vertraging', 'nu geen grote beslissingen nemen vanuit craving'],
      mustAvoid: ['drink maar', 'gebruik maar', 'één keer kan geen kwaad'],
      agencyMap: [{ id: 'ag-craving-1', possibleAction: 'adem 60 seconden en stel drinken 10 minuten uit', timeWindow: 'now', effortLevel: 'low', confidence: 'high' }],
      supportPlan: [{ id: 'sp-craving-1', action: 'contacteer veilige steunpersoon', target: 'trusted_person', urgency: 'high', confidence: 'medium' }],
    });
  }

  // 2. Relapse risk
  if (RELAPSE_RISK_PATTERNS.test(text) || themes.includes('relapse') || themes.includes('terugval') || (resolvedModule && /relapse/i.test(resolvedModule))) {
    detected.push({
      id: 'relapse_risk',
      domains: ['relapse_prevention', 'craving', 'support_activation', 'safety', 'agency'],
      severity: input.relapseRiskActive ? 'escalating_risk' : 'relapse_risk',
      mustMention: ['terugvalrisico vraagt geen schaamte maar onmiddellijke vertraging', 'steun inschakelen is herstelgedrag', 'afstand nemen van middelen of triggeromgeving is een veiligheidsstap'],
      mustAvoid: [],
      supportPlan: [
        { id: 'sp-relapse-1', action: 'contacteer veilige steunpersoon', target: 'trusted_person', urgency: 'high', confidence: 'high' },
        { id: 'sp-relapse-2', action: 'verwijder jezelf uit triggeromgeving', target: 'self', urgency: 'high', confidence: 'medium' },
        { id: 'sp-relapse-3', action: 'neem contact op met arts of behandelaar bij medisch risico', target: 'clinician', urgency: 'medium', confidence: 'medium' },
      ],
      relapsePreventionSteps: [
        { id: 'rp-1', step: 'vertraag en pauzeer', purpose: 'keten onderbreken', urgency: 'high', confidence: 'high' },
        { id: 'rp-2', step: 'neem afstand van middel of triggeromgeving', purpose: 'veiligheid creëren', urgency: 'high', confidence: 'high' },
        { id: 'rp-3', step: 'schakel steun in', purpose: 'niet alleen dragen', urgency: 'medium', confidence: 'high' },
      ],
    });
  }

  // 3. Post-relapse
  if (POST_RELAPSE_PATTERNS.test(text) || themes.includes('post_relapse')) {
    detected.push({
      id: 'post_relapse',
      domains: ['post_relapse_repair', 'shame', 'responsibility', 'honesty', 'relapse_prevention', 'support_activation'],
      severity: 'post_relapse',
      mustMention: ['terugval betekent niet dat herstel mislukt is', 'eerlijkheid is nu belangrijker dan perfecte schaamte', 'volgende stap is schade beperken en patroon herkennen'],
      mustAvoid: ['je hebt gefaald', 'verstop het', 'lieg erover'],
    });
  }

  // 4. Shame / self-hatred
  if (SHAME_PATTERNS.test(text) || themes.includes('shame') || themes.includes('schaamte') || themes.includes('guilt') || themes.includes('self_hatred')) {
    detected.push({
      id: 'shame',
      domains: ['shame', 'self_hatred', 'self_compassion', 'responsibility', 'agency'],
      mustMention: ['zelfveroordeling versterkt vaak de cyclus van schaamte, vermijden en craving', 'schaamte mag richting geven zonder jezelf te vernietigen', 'verantwoordelijkheid nemen is niet hetzelfde als jezelf haten'],
      mustAvoid: ['je bent zwak', 'je bent hopeloos', 'je verdient dit'],
    });
  }

  // 5. Avoidance / hiding / lying
  if (AVOIDANCE_PATTERNS.test(text) || themes.includes('avoidance') || themes.includes('hiding') || themes.includes('honesty') || themes.includes('vermijding') || themes.includes('eerlijkheid')) {
    detected.push({
      id: 'avoidance',
      domains: ['avoidance', 'honesty', 'shame', 'responsibility', 'support_activation'],
      mustMention: ['vermijden verlaagt spanning kort maar vergroot herstelrisico', 'eerlijkheid is herstelgedrag', 'klein en eerlijk contact is beter dan verdwijnen'],
      mustAvoid: ['verstop het', 'lieg erover', 'je hoeft het aan niemand te zeggen'],
    });
  }

  // 6. Emotional overload / control loss
  if (EMOTIONAL_OVERLOAD_PATTERNS.test(text) || themes.includes('emotional_overload') || themes.includes('stress') || themes.includes('panic') || themes.includes('control_loss')) {
    // Determine if support activation is needed alongside regulation
    const needsSupportActivation = (
      (input.stressLevel != null && input.stressLevel >= 7) ||
      input.currentZone === 'orange' ||
      input.currentZone === 'red' ||
      input.currentZone === 'purple' ||
      /ik trek het niet|controle kwijt|paniek|overspoeld|ik kan niet meer|overwhelmed|losing control|panic|i cannot handle this/i.test(text)
    );
    const overloadMustMention = ['eerst reguleren, dan begrijpen', 'het lichaam moet zakken voordat denken weer betrouwbaar wordt', 'één kleine fysieke stap is genoeg om de keten te onderbreken'];
    if (needsSupportActivation) {
      overloadMustMention.push('als je systeem zo hoog zit, is steun inschakelen geen overdrijven maar herstelgedrag');
    }
    const overloadDomains: EliasRecoveryDomain[] = ['emotional_overload', 'control_loss', 'body_state', 'relapse_prevention', 'agency'];
    if (needsSupportActivation) overloadDomains.push('support_activation');
    const overloadSupportPlan: EliasSupportPlanItem[] = needsSupportActivation
      ? [
          { id: 'sp-overload-1', action: 'contacteer veilige steunpersoon', target: 'trusted_person', urgency: 'high', confidence: 'medium' },
          { id: 'sp-overload-2', action: 'bel behandelaar bij aanhoudende ontregeling', target: 'clinician', urgency: 'medium', confidence: 'medium' },
        ]
      : [];
    detected.push({
      id: 'emotional_overload',
      domains: overloadDomains,
      mustMention: overloadMustMention,
      mustAvoid: [],
      agencyMap: [{ id: 'ag-overload-1', possibleAction: 'ga naar een zichtbare ruimte en adem', timeWindow: 'now', effortLevel: 'low', confidence: 'high' }],
      supportPlan: overloadSupportPlan,
    });
  }

  // 7. Loneliness / abandonment / relationship trigger
  if (LONELINESS_PATTERNS.test(text) || themes.includes('loneliness') || themes.includes('abandonment') || themes.includes('relationship_trigger') || themes.includes('rejection') || themes.includes('relationele pijn')) {
    detected.push({
      id: 'loneliness',
      domains: ['loneliness', 'abandonment_fear', 'relationship_trigger', 'craving', 'shame', 'relapse_prevention'],
      mustMention: ['relationele pijn kan craving versterken', 'verbinding zoeken is niet hetzelfde als jezelf verliezen', 'niet drinken is vandaag ook relationele schade beperken'],
      mustAvoid: [],
    });
  }

  // 8. Motivation / ambivalence
  if (MOTIVATION_PATTERNS.test(text) || themes.includes('motivation') || themes.includes('ambivalence') || themes.includes('stage_of_change') || themes.includes('twijfel')) {
    detected.push({
      id: 'motivation',
      domains: ['motivation', 'stage_of_change', 'agency', 'relapse_prevention'],
      mustMention: ['ambivalentie is geen bewijs dat je niet wil herstellen; het is informatie over twee krachten die tegelijk actief zijn', 'een deel wil verdoving, een ander deel wil herstel — beide zijn echt', 'je hoeft niet je hele toekomst te beslissen, alleen de volgende stap'],
      mustAvoid: [],
    });
  }

  // 9. Body state / sleep / exhaustion
  if (BODY_STATE_PATTERNS.test(text) || themes.includes('body_state') || themes.includes('sleep') || themes.includes('exhaustion') || themes.includes('ontregeling')) {
    detected.push({
      id: 'body_state',
      domains: ['body_state', 'sleep', 'emotional_overload', 'relapse_prevention', 'safety'],
      mustMention: ['lichamelijke ontregeling kan craving versterken', 'herstel vraagt vandaag misschien eerst basiszorg', 'bij ernstige ontwenning of medisch risico is medische hulp nodig'],
      mustAvoid: [],
    });
  }

  // 10. Cold turkey / detox risk
  if (COLD_TURKEY_PATTERNS.test(text) || themes.includes('detox') || themes.includes('withdrawal') || themes.includes('ontwenning') || themes.includes('medical_risk') || themes.includes('cold_turkey')) {
    const isSevereRisk = /zware.*alcohol|dagelijks.*drink|trillen|insult|delirium|ontwenning/i.test(text);
    detected.push({
      id: 'cold_turkey',
      domains: ['safety', 'body_state', 'relapse_prevention', 'support_activation'],
      severity: isSevereRisk ? 'acute_safety' : 'relapse_risk',
      mustMention: ['bij zware alcoholafhankelijkheid is plots stoppen zonder medische begeleiding gevaarlijk', 'medische begeleiding is een veiligheidsstap, geen zwakte'],
      mustAvoid: ['cold turkey is oké', 'stop gewoon ineens'],
      supportPlan: [{ id: 'sp-detox-1', action: 'bel arts of behandelaar bij ontwenning of medisch risico', target: 'clinician', urgency: 'emergency', confidence: 'high' }],
    });
  }

  // ── Assemble context ──

  // Collect all domains
  const allDomains = new Set<EliasRecoveryDomain>();
  detected.forEach(d => d.domains.forEach(dom => allDomains.add(dom)));
  if (allDomains.size === 0) allDomains.add('unknown');

  // Determine severity
  let severity: EliasRecoverySeverity = 'stable_reflection';
  const severityPriority: EliasRecoverySeverity[] = ['acute_safety', 'escalating_risk', 'relapse_risk', 'active_craving', 'post_relapse', 'early_signal', 'stable_reflection'];
  for (const s of severityPriority) {
    if (detected.some(d => d.severity === s)) { severity = s; break; }
  }

  // Allowed layers
  const allowedLayers = getAllowedEliasFormulationLayers(mode, severity === 'acute_safety');

  // Collect mustMention / mustAvoid
  const mustMention = [...new Set(detected.flatMap(d => d.mustMention))];
  const mustAvoid = [...new Set(detected.flatMap(d => d.mustAvoid))];

  // Facts
  const facts: EliasRecoveryFact[] = [
    { id: 'f1', text: input.userMessage.substring(0, 200), source: 'user_message', confidence: 'high' },
  ];
  if (input.memoryFacts) {
    input.memoryFacts.forEach((mf, i) => facts.push({ id: `f-mem-${i}`, text: mf, source: 'memory_context', confidence: 'medium' }));
  }

  // Trigger chain
  const triggerChain: EliasTriggerChainItem[] = detected.flatMap(d => d.triggerChain ?? []);

  // Craving functions
  const cravingFunctions: EliasCravingFunction[] = detected.flatMap(d => d.cravingFunctions ?? []);
  if (detected.some(d => d.id === 'craving') && cravingFunctions.length === 0) {
    cravingFunctions.push({ id: 'cf-1', cravingOrUse: 'craving', possibleFunction: 'spanning dempen of pijn vermijden', explanationNotExcuse: true, confidence: 'medium' });
  }

  // Emotional states
  const emotionalStates: string[] = [];
  if (detected.some(d => d.id === 'shame')) emotionalStates.push('schaamte', 'zelfhaat');
  if (detected.some(d => d.id === 'emotional_overload')) emotionalStates.push('overspoeld', 'controleverlies');
  if (detected.some(d => d.id === 'loneliness')) emotionalStates.push('eenzaamheid', 'verlatingspijn');

  // Avoidance loops
  const avoidanceLoops: string[] = [];
  if (detected.some(d => d.id === 'avoidance')) avoidanceLoops.push('vermijding verlaagt spanning kort maar vergroot risico');

  // Shame loops
  const shameLoops: string[] = [];
  if (detected.some(d => d.id === 'shame')) shameLoops.push('schaamte → verbergen → isolatie → craving → gebruik → meer schaamte');

  // Responsibility map
  const responsibilityMap: EliasResponsibilityMapItem[] = [
    { id: 'rm-user-1', owner: 'user', responsibility: 'eerlijkheid en steun inschakelen', notResponsibleFor: ['onmiddellijke perfectie', 'nooit nog craving voelen', 'verleden volledig herstellen in één dag'], confidence: 'high' },
  ];
  if (detected.some(d => d.id === 'cold_turkey') || severity === 'acute_safety') {
    responsibilityMap.push({ id: 'rm-clin-1', owner: 'clinician', responsibility: 'medische ontwenning en detox risico', notResponsibleFor: [], confidence: 'high' });
  }

  // Agency map
  const agencyMap: EliasAgencyMapItem[] = detected.flatMap(d => d.agencyMap ?? []);
  if (agencyMap.length === 0) {
    agencyMap.push({ id: 'ag-default-1', possibleAction: 'één veilige volgende stap kiezen', timeWindow: 'today', effortLevel: 'low', confidence: 'medium' });
  }

  // Stage of change
  let stageOfChange: EliasStageOfChangeSignal | null = null;
  if (input.stageOfChange) {
    stageOfChange = { stage: input.stageOfChange, evidence: 'provided_by_engine', confidence: 'high' };
  } else if (detected.some(d => d.id === 'motivation') || MOTIVATION_PATTERNS.test(text)) {
    stageOfChange = { stage: 'contemplation', evidence: 'ambivalentie gedetecteerd in bericht', confidence: 'medium' };
  } else if (PREPARATION_PATTERNS.test(text)) {
    stageOfChange = { stage: 'preparation', evidence: 'voorbereidingstaal gedetecteerd', confidence: 'medium' };
  } else if (ACTION_PATTERNS.test(text)) {
    stageOfChange = { stage: 'action', evidence: 'actietaal gedetecteerd', confidence: 'medium' };
  } else if (detected.some(d => d.id === 'post_relapse')) {
    stageOfChange = { stage: 'relapse', evidence: 'post-relapse gedetecteerd', confidence: 'high' };
  }

  // Support plan
  const supportPlan: EliasSupportPlanItem[] = detected.flatMap(d => d.supportPlan ?? []);

  // Relapse prevention steps
  const relapsePreventionSteps: EliasRelapsePreventionStep[] = detected.flatMap(d => d.relapsePreventionSteps ?? []);
  if (relapsePreventionSteps.length === 0 && (mode === 'medium' || mode === 'high' || mode === 'acute_recovery_risk')) {
    relapsePreventionSteps.push({ id: 'rp-default-1', step: 'vertraag en kies één veilige stap', purpose: 'keten onderbreken', urgency: 'medium', confidence: 'medium' });
  }

  // Post relapse repair
  const postRelapseRepair: string[] = [];
  if (detected.some(d => d.id === 'post_relapse')) {
    postRelapseRepair.push('schade beperken', 'patroon herkennen', 'eerlijk contact herstellen');
  }

  // Body state signals
  const bodyStateSignals: string[] = [];
  if (detected.some(d => d.id === 'body_state') || detected.some(d => d.id === 'cold_turkey')) {
    bodyStateSignals.push('lichamelijke ontregeling gedetecteerd');
  }

  // Time dynamics
  const timeDynamics: string[] = [];
  if (mode === 'medium' || mode === 'high') {
    timeDynamics.push('focus op vandaag en de volgende stap');
  }

  // Core hypothesis (only at high)
  let coreHypothesis: string | null = null;
  if (mode === 'high' && detected.length > 0) {
    const chainParts: string[] = [];
    if (detected.some(d => d.id === 'loneliness')) chainParts.push('relationele pijn');
    if (detected.some(d => d.id === 'emotional_overload')) chainParts.push('emotionele overspoeling');
    if (detected.some(d => d.id === 'shame')) chainParts.push('schaamte');
    if (detected.some(d => d.id === 'avoidance')) chainParts.push('vermijding');
    if (detected.some(d => d.id === 'craving')) chainParts.push('craving');
    if (chainParts.length >= 2) {
      coreHypothesis = `Herstelketen: ${chainParts.join(' → ')} → risico. Verantwoordelijkheid zonder zelfhaat. Agency: één veilige stap vandaag.`;
    } else {
      coreHypothesis = `Herstelketen: trigger → spanning → ${chainParts[0] || 'risico'}. Verantwoordelijkheid zonder zelfhaat. Agency: vertraging en steun.`;
    }
  }

  // Safety limits
  const safetyLimits: string[] = [];
  if (detected.some(d => d.id === 'cold_turkey')) {
    safetyLimits.push('bij zware alcoholafhankelijkheid geen plots stoppen zonder medische begeleiding');
  }
  if (mode === 'acute_recovery_risk') {
    safetyLimits.push('onmiddellijke veiligheid gaat voor reflectie');
  }

  // Ending style
  let endingStyle: 'grounding' | 'directive' | 'reflective' | 'activation' | 'repair' | 'safety';
  if (mode === 'safety_blocked') endingStyle = 'safety';
  else if (mode === 'acute_recovery_risk') endingStyle = 'activation';
  else if (severity === 'post_relapse') endingStyle = 'repair';
  else if (mode === 'high') endingStyle = 'directive';
  else if (mode === 'medium') endingStyle = 'activation';
  else endingStyle = 'reflective';

  // Max questions
  let maxQuestions: 0 | 1;
  if (mode === 'safety_blocked' || mode === 'acute_recovery_risk') maxQuestions = 0;
  else if (mode === 'high' && agencyMap.length > 1) maxQuestions = 0;
  else maxQuestions = 1;

  // Confidence
  const confidence: 'low' | 'medium' | 'high' = detected.length >= 3 ? 'high' : detected.length >= 1 ? 'medium' : 'low';

  // Build context
  const context: EliasRecoveryFormulationContext = {
    schemaVersion: 'elias_recovery_formulation_v1',
    persona: 'elias',
    mode,
    severity,
    activeDomains: [...allDomains] as EliasRecoveryDomain[],
    activeLayers: allowedLayers,
    facts: allowedLayers.includes('facts') ? facts : [],
    triggerChain: allowedLayers.includes('trigger_chain') ? triggerChain : [],
    cravingFunctions: allowedLayers.includes('craving_function') ? cravingFunctions : [],
    emotionalStates: allowedLayers.includes('emotional_state') ? emotionalStates : [],
    avoidanceLoops: allowedLayers.includes('avoidance_loop') ? avoidanceLoops : [],
    shameLoops: allowedLayers.includes('shame_loop') ? shameLoops : [],
    responsibilityMap: allowedLayers.includes('responsibility_map') ? responsibilityMap : [],
    agencyMap: allowedLayers.includes('agency_map') ? agencyMap : [],
    stageOfChange: allowedLayers.includes('stage_of_change') ? stageOfChange : null,
    supportPlan: allowedLayers.includes('support_plan') ? supportPlan : [],
    relapsePreventionSteps: allowedLayers.includes('relapse_prevention_step') ? relapsePreventionSteps : [],
    postRelapseRepair: allowedLayers.includes('post_relapse_repair') ? postRelapseRepair : [],
    bodyStateSignals: allowedLayers.includes('body_state') ? bodyStateSignals : [],
    timeDynamics: allowedLayers.includes('time_dynamics') ? timeDynamics : [],
    coreHypothesis: allowedLayers.includes('core_hypothesis') ? coreHypothesis : null,
    safetyLimits: allowedLayers.includes('safety_limits') ? safetyLimits : [],
    mustMention,
    mustAvoid,
    maxQuestions,
    endingStyle,
    confidence,
    createdAtLocal: input.localTimestamp,
  };

  // Validate
  const validation = validateEliasRecoveryFormulationContext(context);
  if (!validation.ok) {
    return {
      ...createEmptyEliasRecoveryFormulationContext(),
      mode: 'insufficient_context',
      mustAvoid: ['FORMULATION_VALIDATION_FAILED'],
      confidence: 'low',
      createdAtLocal: input.localTimestamp,
    };
  }

  return context;
}
