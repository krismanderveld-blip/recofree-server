/**
 * K06 — Self-Care & Sustainable Support (Kim-only)
 *
 * PURPOSE: Help caregivers maintain sustainable support patterns, prevent burnout,
 * process guilt around self-care, restore identity, and manage the balance between
 * caring for a partner in recovery and protecting their own wellbeing.
 *
 * CORE PRINCIPLES:
 * - You can care deeply and still protect yourself
 * - You can stay connected and still have boundaries
 * - You can love someone without disappearing
 * - Rest is not abandonment
 * - Guilt does not mean wrongdoing
 * - Exhaustion is not loyalty
 * - Overfunctioning is not commitment
 * - Boundaries and love can coexist
 * - The caregiver is not responsible for recovery outcome
 * - Support and boundaries can exist at the same time
 *
 * CAREGIVER STATES: Normal, Alert, Hypervigilant, Control Mode, Exhaustion,
 * Collapse, Recovery, Rebuild, Boundary Repair, Guilt Loop, Relapse Stress, Trust Rebuild
 *
 * GUILT TYPES: Boundary guilt, Distance guilt, Rest guilt, Pleasure guilt,
 * Recovery guilt, Autonomy guilt
 *
 * CAREGIVER BLIND SPOTS: 13 patterns detected and gently reflected
 */

// ════════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════════

export type K06CaregiverState =
  | 'normal'
  | 'alert'
  | 'hypervigilant'
  | 'control_mode'
  | 'exhaustion'
  | 'collapse'
  | 'recovery'
  | 'rebuild'
  | 'boundary_repair'
  | 'guilt_loop'
  | 'relapse_stress'
  | 'trust_rebuild'
  | 'none';

export type K06GuiltType =
  | 'boundary_guilt'
  | 'distance_guilt'
  | 'rest_guilt'
  | 'pleasure_guilt'
  | 'recovery_guilt'
  | 'autonomy_guilt'
  | 'none';

export type K06ResponseMode =
  | 'stabilize'
  | 'regulate'
  | 'boundary_restore'
  | 'guilt_process'
  | 'identity_rebuild'
  | 'rest_permission'
  | 'relapse_dual'       // stabilize + boundary simultaneously
  | 'control_redirect'
  | 'collapse_care'
  | 'trust_gradual'
  | 'blind_spot_reflect'
  | 'sustainable_plan'
  | 'none';

export type K06Severity = 'mild' | 'moderate' | 'severe' | 'critical';

export type K06SustainabilityLevel = 'sustainable' | 'at_risk' | 'overextended' | 'critical';

export interface K06DetectionResult {
  activated: boolean;
  primaryState: K06CaregiverState;
  secondaryStates: K06CaregiverState[];
  guiltType: K06GuiltType;
  severity: K06Severity;
  sustainabilityLevel: K06SustainabilityLevel;
  blindSpots: string[];
  signals: string[];
  controlUrgeDetected: boolean;
  relapseStressDetected: boolean;
  selfLossDetected: boolean;
  restPanicDetected: boolean;
}

export interface K06RoutingResult {
  activated: boolean;
  responseMode: K06ResponseMode;
  primaryState: K06CaregiverState;
  guiltType: K06GuiltType;
  severity: K06Severity;
  sustainabilityLevel: K06SustainabilityLevel;
  failsafeActive: boolean;
  doNots: string[];
  promptBlock: string | null;
}

export interface K06Progress {
  sessionsInControlMode: number;
  sessionsInExhaustion: number;
  sessionsInCollapse: number;
  sessionsWithGuiltLoop: number;
  sessionsWithRelapseStress: number;
  sessionsWithSelfLoss: number;
  sessionsWithHypervigilance: number;
  sessionsInRecovery: number;
  sessionsInRebuild: number;
  blindSpotsReflected: string[];
  lastState: K06CaregiverState;
  lastResponseMode: K06ResponseMode;
  sustainabilityTrend: 'improving' | 'declining' | 'stable' | 'unknown';
  consecutiveCollapseRisk: number;
}

export function createDefaultK06Progress(): K06Progress {
  return {
    sessionsInControlMode: 0,
    sessionsInExhaustion: 0,
    sessionsInCollapse: 0,
    sessionsWithGuiltLoop: 0,
    sessionsWithRelapseStress: 0,
    sessionsWithSelfLoss: 0,
    sessionsWithHypervigilance: 0,
    sessionsInRecovery: 0,
    sessionsInRebuild: 0,
    blindSpotsReflected: [],
    lastState: 'none',
    lastResponseMode: 'none',
    sustainabilityTrend: 'unknown',
    consecutiveCollapseRisk: 0,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// DETECTOR — Deterministic marker-based detection
// ════════════════════════════════════════════════════════════════════════════════

const HYPERVIGILANCE_MARKERS = [
  // EN
  'always watching', 'cannot relax', 'checking phone', 'monitoring', 'on guard',
  'scanning', 'waiting for it', 'something feels off', 'can\'t let guard down',
  'always alert', 'never safe', 'expecting the worst', 'anticipating',
  'checking up on', 'need to know where', 'checking browser history',
  // NL
  'altijd opletten', 'kan niet ontspannen', 'telefoon checken', 'in de gaten houden',
  'op mijn hoede', 'scannen', 'wacht erop', 'iets klopt niet', 'kan niet loslaten',
  'altijd alert', 'nooit veilig', 'verwacht het ergste', 'anticiperen',
  'controleren', 'moet weten waar', 'browsergeschiedenis checken', 'waakzaam',
];

const CONTROL_MODE_MARKERS = [
  // EN
  'need to control', 'managing everything', 'if i don\'t', 'holding it together',
  'keeping track', 'making sure', 'can\'t let go', 'have to watch',
  'responsible for everything', 'if i stop', 'everything falls apart',
  'only one holding', 'managing their recovery', 'making them',
  // NL
  'moet controleren', 'alles managen', 'als ik het niet doe', 'bij elkaar houden',
  'bijhouden', 'zorgen dat', 'kan niet loslaten', 'moet opletten',
  'overal verantwoordelijk', 'als ik stop', 'alles valt uit elkaar',
  'enige die het doet', 'hun herstel managen', 'dwingen om',
];

const EXHAUSTION_MARKERS = [
  // EN
  'exhausted', 'depleted', 'can\'t keep going', 'running on empty',
  'nothing left', 'burned out', 'too tired', 'drained', 'no energy',
  'can\'t do this anymore', 'at my limit', 'breaking point', 'falling apart',
  'barely functioning', 'surviving not living', 'empty inside',
  // NL
  'uitgeput', 'leeg', 'kan niet meer', 'op mijn tandvlees',
  'niets meer over', 'opgebrand', 'te moe', 'leeggelopen', 'geen energie',
  'ik kan dit niet meer', 'aan mijn limiet', 'breekpunt', 'val uit elkaar',
  'nauwelijks functioneren', 'overleven niet leven', 'leeg van binnen',
];

const COLLAPSE_MARKERS = [
  // EN
  'can\'t function', 'shut down', 'giving up', 'don\'t care anymore',
  'numb', 'dissociating', 'can\'t feel', 'checked out', 'done',
  'what\'s the point', 'nothing matters', 'completely overwhelmed',
  'can\'t think', 'paralyzed', 'frozen',
  // NL
  'kan niet functioneren', 'afgesloten', 'geef het op', 'maakt niet meer uit',
  'verdoofd', 'dissociëren', 'kan niets voelen', 'afgehaakt', 'klaar',
  'wat heeft het voor zin', 'niets doet ertoe', 'compleet overweldigd',
  'kan niet denken', 'verlamd', 'bevroren',
];

const BOUNDARY_GUILT_MARKERS = [
  // EN
  'feel guilty for', 'selfish for', 'bad person for', 'shouldn\'t have',
  'guilt after', 'wrong to', 'abandoning', 'failing them', 'letting them down',
  'guilt for saying no', 'guilt for resting', 'guilt for boundaries',
  'feel bad about', 'shouldn\'t need space', 'shouldn\'t enjoy',
  // NL
  'voel me schuldig', 'egoïstisch', 'slecht persoon', 'had niet moeten',
  'schuld na', 'fout om', 'in de steek laten', 'teleurstellen',
  'schuld voor nee zeggen', 'schuld voor rust', 'schuld over grenzen',
  'voel me slecht', 'zou geen ruimte moeten nodig hebben', 'zou niet moeten genieten',
  'schuldgevoel',
];

const DISTANCE_GUILT_MARKERS = [
  // EN
  'need space', 'need distance', 'need time alone', 'want to be alone',
  'can\'t be around', 'need to get away', 'suffocating',
  // NL
  'ruimte nodig', 'afstand nodig', 'tijd alleen nodig', 'wil alleen zijn',
  'kan niet in de buurt zijn', 'moet weg', 'verstikkend',
];

const REST_GUILT_MARKERS = [
  // EN
  'feel guilty resting', 'shouldn\'t rest', 'can\'t rest while',
  'how can i relax', 'rest feels wrong', 'guilty for sleeping',
  'shouldn\'t take time', 'rest panic',
  // NL
  'schuldig voor rust', 'zou niet moeten rusten', 'kan niet rusten terwijl',
  'hoe kan ik ontspannen', 'rust voelt fout', 'schuldig voor slapen',
  'zou geen tijd moeten nemen', 'rustpaniek',
];

const PLEASURE_GUILT_MARKERS = [
  // EN
  'feel guilty for being happy', 'shouldn\'t enjoy', 'how can i laugh',
  'guilty for having fun', 'wrong to feel good', 'shouldn\'t be okay',
  // NL
  'schuldig voor blij zijn', 'zou niet moeten genieten', 'hoe kan ik lachen',
  'schuldig voor plezier', 'fout om me goed te voelen', 'zou niet oké moeten zijn',
];

const SELF_LOSS_MARKERS = [
  // EN
  'lost myself', 'don\'t know who i am', 'disappeared', 'no identity',
  'only a caregiver', 'nothing left of me', 'who am i', 'forgot myself',
  'don\'t exist outside', 'invisible', 'erased', 'no life of my own',
  'everything revolves around', 'my needs don\'t matter',
  // NL
  'mezelf verloren', 'weet niet wie ik ben', 'verdwenen', 'geen identiteit',
  'alleen maar mantelzorger', 'niets meer van mij over', 'wie ben ik',
  'mezelf vergeten', 'besta niet buiten', 'onzichtbaar', 'uitgewist',
  'geen eigen leven', 'alles draait om', 'mijn behoeften doen er niet toe',
];

const RELAPSE_STRESS_MARKERS = [
  // EN
  'relapsed', 'using again', 'drinking again', 'found bottles', 'found drugs',
  'smells like', 'high again', 'drunk again', 'back to old patterns',
  'suspicious behavior', 'lying about use', 'hiding use', 'relapse',
  'slipped', 'fell off', 'back to square one',
  // NL
  'terugval', 'weer gebruiken', 'weer drinken', 'flessen gevonden', 'drugs gevonden',
  'ruikt naar', 'weer high', 'weer dronken', 'terug naar oude patronen',
  'verdacht gedrag', 'liegen over gebruik', 'gebruik verbergen', 'hervallen',
  'uitgegleden', 'teruggevallen', 'terug bij af',
];

const REST_PANIC_MARKERS = [
  // EN
  'can\'t rest', 'rest feels dangerous', 'if i stop', 'something will happen',
  'need to stay alert', 'can\'t let down guard', 'rest means danger',
  'afraid to relax', 'what if i miss something', 'can\'t afford to rest',
  // NL
  'kan niet rusten', 'rust voelt gevaarlijk', 'als ik stop', 'er zal iets gebeuren',
  'moet alert blijven', 'kan waakzaamheid niet loslaten', 'rust betekent gevaar',
  'bang om te ontspannen', 'wat als ik iets mis', 'kan me geen rust veroorloven',
];

const TRUST_REBUILD_MARKERS = [
  // EN
  'starting to trust', 'want to believe', 'seems better', 'making progress',
  'but what if', 'cautiously optimistic', 'afraid to trust', 'slowly trusting',
  'evidence of change', 'consistent lately', 'scared to hope',
  // NL
  'begin te vertrouwen', 'wil geloven', 'lijkt beter', 'maakt vooruitgang',
  'maar wat als', 'voorzichtig optimistisch', 'bang om te vertrouwen',
  'langzaam vertrouwen', 'bewijs van verandering', 'consistent laatst', 'bang om te hopen',
];

// Blind spot markers
const BLIND_SPOT_MARKERS: { spot: string; markers: string[] }[] = [
  { spot: 'ignoring_own_needs', markers: ['my needs can wait', 'i\'m fine', 'it\'s not about me', 'mijn behoeften kunnen wachten', 'het gaat niet om mij'] },
  { spot: 'taking_too_much_control', markers: ['i have to manage', 'if i don\'t do it', 'ik moet het regelen', 'als ik het niet doe'] },
  { spot: 'responsible_for_recovery', markers: ['if they relapse it\'s my fault', 'i should have', 'als ze hervallen is het mijn schuld', 'ik had moeten'] },
  { spot: 'losing_identity', markers: ['i don\'t know who i am anymore', 'only exist for them', 'weet niet meer wie ik ben', 'besta alleen voor hen'] },
  { spot: 'chronically_hyperalert', markers: ['always on edge', 'never relax', 'altijd op scherp', 'nooit ontspannen'] },
  { spot: 'confusing_support_with_availability', markers: ['always available', 'can\'t say no', 'altijd beschikbaar', 'kan geen nee zeggen'] },
  { spot: 'confusing_boundaries_with_abandonment', markers: ['if i set limits they\'ll', 'boundary means leaving', 'als ik grenzen stel', 'grens betekent verlaten'] },
  { spot: 'confusing_rest_with_danger', markers: ['rest feels unsafe', 'can\'t afford to rest', 'rust voelt onveilig', 'kan me geen rust veroorloven'] },
  { spot: 'confusing_guilt_with_wrongdoing', markers: ['feel guilty so must be wrong', 'guilt means i\'m bad', 'schuldig dus fout', 'schuld betekent slecht'] },
  { spot: 'confusing_love_with_sacrifice', markers: ['love means giving everything', 'real love is sacrifice', 'liefde is alles geven', 'echte liefde is opoffering'] },
  { spot: 'confusing_vigilance_with_safety', markers: ['if i watch enough', 'monitoring keeps them safe', 'als ik genoeg oplet', 'controleren houdt ze veilig'] },
  { spot: 'confusing_exhaustion_with_loyalty', markers: ['being tired shows i care', 'exhaustion proves love', 'moe zijn toont dat ik geef', 'uitputting bewijst liefde'] },
  { spot: 'confusing_overfunctioning_with_commitment', markers: ['doing everything shows commitment', 'alles doen toont toewijding'] },
];

function countMarkerHits(text: string, markers: string[]): number {
  let count = 0;
  for (const marker of markers) {
    if (text.includes(marker)) count++;
  }
  return count;
}

// Session state
let sessionStates: K06CaregiverState[] = [];

export function resetK06SessionState(): void {
  sessionStates = [];
}

export function detectK06State(
  message: string,
  recentMessages: string[] = [],
): K06DetectionResult {
  const text = message.toLowerCase();
  const allText = [text, ...recentMessages.map(m => m.toLowerCase())].join(' ');

  // Detect states
  const hypervigilanceHits = countMarkerHits(text, HYPERVIGILANCE_MARKERS);
  const controlHits = countMarkerHits(text, CONTROL_MODE_MARKERS);
  const exhaustionHits = countMarkerHits(text, EXHAUSTION_MARKERS);
  const collapseHits = countMarkerHits(text, COLLAPSE_MARKERS);
  const boundaryGuiltHits = countMarkerHits(text, BOUNDARY_GUILT_MARKERS);
  const selfLossHits = countMarkerHits(text, SELF_LOSS_MARKERS);
  const relapseHits = countMarkerHits(text, RELAPSE_STRESS_MARKERS);
  const restPanicHits = countMarkerHits(text, REST_PANIC_MARKERS);
  const trustRebuildHits = countMarkerHits(text, TRUST_REBUILD_MARKERS);

  // Detect guilt types
  const distanceGuiltHits = countMarkerHits(text, DISTANCE_GUILT_MARKERS);
  const restGuiltHits = countMarkerHits(text, REST_GUILT_MARKERS);
  const pleasureGuiltHits = countMarkerHits(text, PLEASURE_GUILT_MARKERS);

  // State scoring
  const stateScores: { state: K06CaregiverState; hits: number }[] = [
    { state: 'collapse', hits: collapseHits },
    { state: 'relapse_stress', hits: relapseHits },
    { state: 'exhaustion', hits: exhaustionHits },
    { state: 'control_mode', hits: controlHits },
    { state: 'hypervigilant', hits: hypervigilanceHits },
    { state: 'guilt_loop', hits: boundaryGuiltHits + distanceGuiltHits + restGuiltHits + pleasureGuiltHits },
    { state: 'boundary_repair', hits: boundaryGuiltHits },
    { state: 'trust_rebuild', hits: trustRebuildHits },
    { state: 'rebuild', hits: selfLossHits },
  ];

  // Priority: collapse > relapse_stress > exhaustion > control > hypervigilant > guilt > others
  stateScores.sort((a, b) => b.hits - a.hits);

  const primaryState = stateScores[0].hits > 0 ? stateScores[0].state : 'none' as K06CaregiverState;
  const secondaryStates = stateScores
    .slice(1)
    .filter(s => s.hits > 0)
    .map(s => s.state);

  const totalHits = stateScores.reduce((sum, s) => sum + s.hits, 0);
  const activated = totalHits > 0;

  // Determine guilt type
  let guiltType: K06GuiltType = 'none';
  if (pleasureGuiltHits > 0) guiltType = 'pleasure_guilt';
  else if (restGuiltHits > 0) guiltType = 'rest_guilt';
  else if (distanceGuiltHits > 0) guiltType = 'distance_guilt';
  else if (boundaryGuiltHits > 0) guiltType = 'boundary_guilt';

  // Determine severity
  let severity: K06Severity = 'mild';
  if (collapseHits >= 3 || (exhaustionHits >= 4 && controlHits >= 3)) {
    severity = 'critical';
  } else if (collapseHits >= 1 || totalHits >= 8 || relapseHits >= 3) {
    severity = 'severe';
  } else if (totalHits >= 4 || exhaustionHits >= 2 || controlHits >= 2) {
    severity = 'moderate';
  }

  // Sustainability level
  const loadScore = exhaustionHits + controlHits + relapseHits + boundaryGuiltHits + restPanicHits;
  const capacityScore = trustRebuildHits + (primaryState === 'recovery' ? 2 : 0);
  const overextensionRisk = loadScore - capacityScore;

  let sustainabilityLevel: K06SustainabilityLevel = 'sustainable';
  if (overextensionRisk >= 8 || severity === 'critical') sustainabilityLevel = 'critical';
  else if (overextensionRisk >= 5 || severity === 'severe') sustainabilityLevel = 'overextended';
  else if (overextensionRisk >= 2) sustainabilityLevel = 'at_risk';

  // Detect blind spots
  const blindSpots: string[] = [];
  for (const { spot, markers } of BLIND_SPOT_MARKERS) {
    if (countMarkerHits(allText, markers) > 0) {
      blindSpots.push(spot);
    }
  }

  // Track session states
  if (activated) sessionStates.push(primaryState);

  // Collect signals
  const signals: string[] = [];
  if (hypervigilanceHits > 0) signals.push(`hypervigilance(${hypervigilanceHits})`);
  if (controlHits > 0) signals.push(`control_mode(${controlHits})`);
  if (exhaustionHits > 0) signals.push(`exhaustion(${exhaustionHits})`);
  if (collapseHits > 0) signals.push(`collapse(${collapseHits})`);
  if (boundaryGuiltHits > 0) signals.push(`boundary_guilt(${boundaryGuiltHits})`);
  if (selfLossHits > 0) signals.push(`self_loss(${selfLossHits})`);
  if (relapseHits > 0) signals.push(`relapse_stress(${relapseHits})`);
  if (restPanicHits > 0) signals.push(`rest_panic(${restPanicHits})`);
  if (trustRebuildHits > 0) signals.push(`trust_rebuild(${trustRebuildHits})`);
  if (blindSpots.length > 0) signals.push(`blind_spots(${blindSpots.length})`);
  if (guiltType !== 'none') signals.push(`guilt:${guiltType}`);

  return {
    activated,
    primaryState,
    secondaryStates,
    guiltType,
    severity,
    sustainabilityLevel,
    blindSpots,
    signals,
    controlUrgeDetected: controlHits > 0,
    relapseStressDetected: relapseHits > 0,
    selfLossDetected: selfLossHits > 0,
    restPanicDetected: restPanicHits > 0,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// ROUTER — Response mode selection, failsafe logic
// ════════════════════════════════════════════════════════════════════════════════

const DO_NOTS = [
  'Do NOT tell caregiver to simply communicate better',
  'Do NOT use empty self-care cliches ("just take a bath")',
  'Do NOT make caregiver responsible for relapse prevention',
  'Do NOT demonize the partner',
  'Do NOT encourage surveillance or monitoring',
  'Do NOT reward control behavior',
  'Do NOT talk guilt away — help carry it',
  'Do NOT shame exhaustion',
  'Do NOT demand forgiveness or trust',
  'Do NOT push major decisions during collapse',
  'Do NOT treat boundaries as threats to the relationship',
  'Do NOT treat anger as lack of love',
  'Do NOT treat self-care as selfishness',
  'Do NOT treat hypervigilance as irrational without context',
  'Do NOT say "just let go"',
  'Do NOT frame caregiver rest as abandonment',
  'Do NOT frame caregiver autonomy as disloyalty',
  'Do NOT treat partner stability as proof caregiver should be calm',
];

function selectResponseMode(detection: K06DetectionResult): K06ResponseMode {
  if (!detection.activated) return 'none';

  // Critical/collapse → collapse care only
  if (detection.severity === 'critical' || detection.primaryState === 'collapse') {
    return 'collapse_care';
  }

  // Relapse stress → dual response (stabilize + boundary)
  if (detection.relapseStressDetected && detection.primaryState === 'relapse_stress') {
    return 'relapse_dual';
  }

  // Control mode → redirect
  if (detection.primaryState === 'control_mode') {
    return 'control_redirect';
  }

  // Guilt loop → guilt processing
  if (detection.primaryState === 'guilt_loop' || detection.guiltType !== 'none') {
    return 'guilt_process';
  }

  // Self-loss / rebuild → identity rebuild
  if (detection.selfLossDetected || detection.primaryState === 'rebuild') {
    return 'identity_rebuild';
  }

  // Hypervigilant → regulate
  if (detection.primaryState === 'hypervigilant') {
    return 'regulate';
  }

  // Exhaustion → rest permission
  if (detection.primaryState === 'exhaustion') {
    return 'rest_permission';
  }

  // Boundary repair
  if (detection.primaryState === 'boundary_repair') {
    return 'boundary_restore';
  }

  // Trust rebuild
  if (detection.primaryState === 'trust_rebuild') {
    return 'trust_gradual';
  }

  // Blind spots detected → reflect
  if (detection.blindSpots.length >= 2) {
    return 'blind_spot_reflect';
  }

  // Rest panic
  if (detection.restPanicDetected) {
    return 'rest_permission';
  }

  // Default: sustainable planning
  return 'sustainable_plan';
}

export function routeK06Engine(
  detection: K06DetectionResult,
  progress: K06Progress | undefined,
): K06RoutingResult {
  if (!detection.activated) {
    return {
      activated: false,
      responseMode: 'none',
      primaryState: 'none',
      guiltType: 'none',
      severity: 'mild',
      sustainabilityLevel: 'sustainable',
      failsafeActive: false,
      doNots: [],
      promptBlock: null,
    };
  }

  const responseMode = selectResponseMode(detection);
  const failsafeActive = detection.severity === 'critical' || detection.primaryState === 'collapse';

  const result: K06RoutingResult = {
    activated: true,
    responseMode,
    primaryState: detection.primaryState,
    guiltType: detection.guiltType,
    severity: detection.severity,
    sustainabilityLevel: detection.sustainabilityLevel,
    failsafeActive,
    doNots: DO_NOTS,
    promptBlock: null,
  };

  result.promptBlock = buildK06PromptBlock(result, detection, progress);
  return result;
}

// ════════════════════════════════════════════════════════════════════════════════
// PROMPT BUILDER
// ════════════════════════════════════════════════════════════════════════════════

const STATE_GUIDANCE: Record<K06CaregiverState, string> = {
  normal: 'STATE_NORMAL: Use reflection, planning, values, sustainable support. Reinforce maintenance patterns.',
  alert: 'STATE_ALERT: Validate concern. Ask for observable facts. Prevent escalation into control. "What did you actually observe vs. what are you afraid might be happening?"',
  hypervigilant: 'STATE_HYPERVIGILANT: Regulate first. Reduce scanning. Do not problem-solve too early. "Your nervous system is in protection mode. Let\'s slow down before we plan."',
  control_mode: 'STATE_CONTROL_MODE: Validate fear underneath control. Separate influence from control. Restore boundaries. "The urge to control often comes from the fear of what happens if you don\'t. What are you afraid of right now?"',
  exhaustion: 'STATE_EXHAUSTION: Recovery first. Reduce responsibility. Avoid heavy analysis. "You cannot pour from an empty cup. Rest is not abandonment — it is survival."',
  collapse: 'STATE_COLLAPSE: Rest, safety, support. No complex decisions. No heavy processing. Short sentences. Present-moment anchoring. "Right now, in this moment, you are safe. Nothing needs to be decided today."',
  recovery: 'STATE_RECOVERY: Rebuild capacity. Normalize delayed crash. Restore small routines. "Recovery is not linear. Some days the exhaustion catches up. That is normal, not failure."',
  rebuild: 'STATE_REBUILD: Identity restoration, social reconnection, future self, boundary confidence. "Who were you before the crisis became your identity? That person still exists."',
  boundary_repair: 'STATE_BOUNDARY_REPAIR: Name weakened limit. Identify fear underneath. Rebuild one concrete boundary. "Which boundary has been eroding? What fear makes it hard to restore?"',
  guilt_loop: 'STATE_GUILT_LOOP: Normalize guilt. Protect limit. Avoid overexplaining. "Guilt does not mean wrongdoing. It means you care deeply. But care does not require self-destruction."',
  relapse_stress: 'STATE_RELAPSE_STRESS: Stabilize AND boundary simultaneously. Do not blame caregiver. "I am here with you. You do not have to carry this alone. AND we need to protect your limits too. Support and boundaries can exist at the same time."',
  trust_rebuild: 'STATE_TRUST_REBUILD: Gradual trust, not forced trust. Track small reliability signals. "Trust rebuilds through consistency, not promises. Allow caution without shame."',
  none: '',
};

const GUILT_GUIDANCE: Record<K06GuiltType, string> = {
  boundary_guilt: 'BOUNDARY GUILT: Feeling bad after setting limits. Response: "The guilt makes sense. It shows how deeply you care. But care does not mean you have to abandon your own recovery. A boundary is information, not punishment."',
  distance_guilt: 'DISTANCE GUILT: Feeling bad for needing space. Response: "Needing space is not abandonment. It is how you preserve the capacity to be present when you choose to be."',
  rest_guilt: 'REST GUILT: Feeling bad for recovering. Response: "Rest is not selfishness. It is the foundation of sustainable care. You cannot support anyone from a place of depletion."',
  pleasure_guilt: 'PLEASURE GUILT: Feeling bad for joy while partner struggles. Response: "Your joy does not cause their pain. Your suffering does not ease theirs. You are allowed to have moments of lightness."',
  recovery_guilt: 'RECOVERY GUILT: Feeling bad when caregiver improves while partner remains unstable. Response: "Your growth is not betrayal. Your stability is not abandonment. You are allowed to heal at your own pace."',
  autonomy_guilt: 'AUTONOMY GUILT: Feeling bad for making decisions independent of partner\'s state. Response: "You are a whole person, not an extension of someone else\'s crisis. Your decisions can consider them without being controlled by them."',
  none: '',
};

const BLIND_SPOT_REFLECTIONS: Record<string, string> = {
  ignoring_own_needs: '"I hear how much you care. I also hear how much of yourself is disappearing inside that care."',
  taking_too_much_control: '"The urge to manage everything often comes from love. But control and care are not the same thing."',
  responsible_for_recovery: '"You can support recovery without being responsible for its outcome. Their journey is theirs."',
  losing_identity: '"Who were you before the crisis became your full-time identity? That person deserves attention too."',
  chronically_hyperalert: '"Your vigilance kept you safe. But safety that requires constant alertness is not sustainable safety."',
  confusing_support_with_availability: '"Support does not mean being available 24/7. Sustainable support requires rest, limits, and self-preservation."',
  confusing_boundaries_with_abandonment: '"A boundary is not leaving. A boundary is staying in a way that does not destroy you."',
  confusing_rest_with_danger: '"Rest is not dangerous. What is dangerous is never resting until you collapse."',
  confusing_guilt_with_wrongdoing: '"Guilt is a feeling, not a verdict. You can feel guilty and still be doing the right thing."',
  confusing_love_with_sacrifice: '"Love that requires self-destruction is not sustainable love. You can love deeply and still exist."',
  confusing_vigilance_with_safety: '"Watching does not prevent relapse. It only exhausts the watcher."',
  confusing_exhaustion_with_loyalty: '"Being exhausted does not prove love. Being rested allows better love."',
  confusing_overfunctioning_with_commitment: '"Doing everything for someone is not commitment — it is self-erasure disguised as devotion."',
};

const COLLAPSE_INSTRUCTIONS = `FAILSAFE ACTIVE (caregiver collapse/critical):
1. Rest, safety, support — nothing else
2. Short sentences only — reduce cognitive load
3. No complex decisions — "Nothing needs to be decided today"
4. Present-moment anchoring — "Right now, you are here. You are safe."
5. No heavy analysis or processing
6. Encourage human support — "Is there one person who could sit with you today?"
7. Do NOT push boundaries, identity work, or planning during collapse`;

const RELAPSE_DUAL_INSTRUCTIONS = `RELAPSE STRESS — DUAL RESPONSE:
Kim must respond with BOTH stabilization AND boundaries simultaneously.
1. "I am here with you." (stabilize)
2. "You do not have to carry this alone." (support)
3. "We need to protect your limits too." (boundary)
Core phrase: "Support and boundaries can exist at the same time."
Do NOT only calm while postponing boundaries.
Do NOT only push boundaries while ignoring overwhelm.`;

const CORE_PRINCIPLES = [
  'You can care deeply and still protect yourself',
  'You can stay connected and still have boundaries',
  'You can love someone without disappearing',
  'Rest is not abandonment',
  'Guilt does not mean wrongdoing',
  'Exhaustion is not loyalty',
  'Overfunctioning is not commitment',
  'The caregiver is not responsible for recovery outcome',
  'Support and boundaries can exist at the same time',
  'The partner is responsible for behavior; the caregiver is responsible for boundaries',
];

function buildK06PromptBlock(
  routing: K06RoutingResult,
  detection: K06DetectionResult,
  progress: K06Progress | undefined,
): string {
  const lines: string[] = [];
  lines.push('=== K06 SELF-CARE & SUSTAINABLE SUPPORT ===');
  lines.push(`Caregiver state: ${detection.primaryState} (severity: ${detection.severity})`);
  lines.push(`Sustainability: ${detection.sustainabilityLevel}`);
  lines.push(`Response mode: ${routing.responseMode}`);
  lines.push('');

  // State guidance
  lines.push(STATE_GUIDANCE[detection.primaryState]);
  lines.push('');

  // Secondary states
  if (detection.secondaryStates.length > 0) {
    lines.push(`Secondary states: ${detection.secondaryStates.join(', ')}`);
    lines.push('');
  }

  // Guilt processing
  if (detection.guiltType !== 'none') {
    lines.push(GUILT_GUIDANCE[detection.guiltType]);
    lines.push('Kim response to guilt: 1. Name guilt. 2. Normalize guilt. 3. Separate guilt from wrongdoing. 4. Identify value underneath guilt. 5. Protect boundary or recovery step. 6. Do not erase complexity.');
    lines.push('');
  }

  // Blind spot reflections
  if (detection.blindSpots.length > 0) {
    lines.push('CAREGIVER BLIND SPOTS DETECTED:');
    for (const spot of detection.blindSpots.slice(0, 3)) {
      const reflection = BLIND_SPOT_REFLECTIONS[spot];
      if (reflection) lines.push(`- ${spot}: ${reflection}`);
    }
    lines.push('');
  }

  // Rest panic
  if (detection.restPanicDetected) {
    lines.push('REST PANIC detected: Caregiver experiences rest as dangerous. Response: "Your nervous system learned that resting means missing danger signals. That was adaptive once. But rest is not the enemy — depletion is."');
    lines.push('');
  }

  // Failsafe / collapse
  if (routing.failsafeActive) {
    lines.push(COLLAPSE_INSTRUCTIONS);
    lines.push('');
  }

  // Relapse dual response
  if (routing.responseMode === 'relapse_dual') {
    lines.push(RELAPSE_DUAL_INSTRUCTIONS);
    lines.push('');
  }

  // Progress context
  if (progress) {
    if (progress.sessionsInCollapse >= 2) {
      lines.push(`WARNING: Caregiver has been in collapse state for ${progress.sessionsInCollapse} sessions. Prioritize rest and human support referral.`);
    }
    if (progress.sessionsInControlMode >= 3) {
      lines.push(`RECURRING CONTROL MODE: ${progress.sessionsInControlMode} sessions. Gently explore what fear drives the control urge.`);
    }
    if (progress.sessionsWithGuiltLoop >= 3) {
      lines.push(`CHRONIC GUILT LOOP: ${progress.sessionsWithGuiltLoop} sessions. The caregiver may be repeatedly undoing boundaries because of guilt. Name the pattern.`);
    }
    if (progress.sessionsWithSelfLoss >= 3) {
      lines.push(`PERSISTENT SELF-LOSS: ${progress.sessionsWithSelfLoss} sessions. Identity restoration is urgent. Ask: "What part of you has been neglected the longest?"`);
    }
    if (progress.consecutiveCollapseRisk >= 2) {
      lines.push(`CONSECUTIVE COLLAPSE RISK: ${progress.consecutiveCollapseRisk} sessions at risk. Consider suggesting professional support.`);
    }
    lines.push('');
  }

  // Core principles
  lines.push('CORE PRINCIPLES:');
  for (const p of CORE_PRINCIPLES) {
    lines.push(`- ${p}`);
  }
  lines.push('');

  // Do NOTs (compact)
  lines.push('DO NOTs:');
  for (const d of DO_NOTS.slice(0, 10)) {
    lines.push(`- ${d}`);
  }

  lines.push('=== END K06 ===');
  return lines.join('\n');
}

// ════════════════════════════════════════════════════════════════════════════════
// PROGRESS UPDATE
// ════════════════════════════════════════════════════════════════════════════════

export function updateK06Progress(
  current: K06Progress | undefined,
  detection: K06DetectionResult,
  responseMode: K06ResponseMode,
): K06Progress {
  const p = current ?? createDefaultK06Progress();
  const updated: K06Progress = { ...p, blindSpotsReflected: [...p.blindSpotsReflected] };

  // Track state occurrences
  if (detection.primaryState === 'control_mode') updated.sessionsInControlMode++;
  if (detection.primaryState === 'exhaustion') updated.sessionsInExhaustion++;
  if (detection.primaryState === 'collapse') updated.sessionsInCollapse++;
  if (detection.primaryState === 'guilt_loop') updated.sessionsWithGuiltLoop++;
  if (detection.primaryState === 'relapse_stress') updated.sessionsWithRelapseStress++;
  if (detection.primaryState === 'hypervigilant') updated.sessionsWithHypervigilance++;
  if (detection.primaryState === 'recovery') updated.sessionsInRecovery++;
  if (detection.primaryState === 'rebuild') updated.sessionsInRebuild++;
  if (detection.selfLossDetected) updated.sessionsWithSelfLoss++;

  // Track blind spots reflected
  for (const spot of detection.blindSpots) {
    if (!updated.blindSpotsReflected.includes(spot)) {
      updated.blindSpotsReflected.push(spot);
    }
  }

  updated.lastState = detection.primaryState;
  updated.lastResponseMode = responseMode;

  // Sustainability trend
  const totalLoad = updated.sessionsInControlMode + updated.sessionsInExhaustion + updated.sessionsInCollapse + updated.sessionsWithGuiltLoop;
  const totalRecovery = updated.sessionsInRecovery + updated.sessionsInRebuild;
  if (totalLoad <= 2 && totalRecovery >= 2) {
    updated.sustainabilityTrend = 'improving';
  } else if (totalLoad >= 5 && totalRecovery <= 1) {
    updated.sustainabilityTrend = 'declining';
  } else if (totalLoad >= 3) {
    updated.sustainabilityTrend = 'stable';
  }

  // Consecutive collapse risk
  if (detection.severity === 'critical' || detection.primaryState === 'collapse') {
    updated.consecutiveCollapseRisk++;
  } else {
    updated.consecutiveCollapseRisk = 0;
  }

  return updated;
}
