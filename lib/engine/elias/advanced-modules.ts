/**
 * Elias Advanced Modules — Pipeline Integration Layer
 *
 * Consolidates VERGV01, IGH01, AGC01, HWK01 detection and prompt building
 * into a single import point for pipeline.ts.
 *
 * Pipeline order after STO01:
 *   STO01 → VERGV01 / IGH01 / AGC01 / HWK01 (parallel detection, priority routing)
 *
 * Routing rules:
 *   - VERGV01 activates when guilt/forgiveness markers detected (Elias + Kim)
 *   - IGH01 activates when generational pattern markers detected (Elias only)
 *   - AGC01 activates when external motivation markers detected (Elias + Kim)
 *   - HWK01 activates when worthiness/recovery-deserving markers detected (Elias only)
 *   - Priority: HWK01 > VERGV01 > IGH01 > AGC01 (deepest existential first)
 *   - Only ONE module activates per message (highest priority wins)
 */

// ─── Types ──────────────────────────────────────────────────────────────────────

export type AdvancedModuleId = 'VERGV01' | 'IGH01' | 'AGC01' | 'HWK01' | 'NONE';

export interface EliasAdvancedModulesResult {
  vergv01Active: boolean;
  igh01Active: boolean;
  agc01Active: boolean;
  hwk01Active: boolean;
  vergv01PromptBlock: string | null;
  igh01PromptBlock: string | null;
  agc01PromptBlock: string | null;
  hwk01PromptBlock: string | null;
  primaryModule: AdvancedModuleId;
  confidence: number;
}

export interface EliasAdvancedModulesInput {
  userType: 'elias' | 'kim';
  latestUserMessage: string;
  recentMessages: string[];
  crisisLevel: number;
  intakeCompleted: boolean;
  /** Slider values for context */
  shameLevel?: number;
  guiltLevel?: number;
  hopelessnessLevel?: number;
  /** Cross-module flags */
  relapseActive?: boolean;
  childMotivationDetected?: boolean;
  legalPressureDetected?: boolean;
  caregiverRolePressureDetected?: boolean;
}

// ─── Marker Banks ───────────────────────────────────────────────────────────────

const VERGV01_MARKERS_NL = [
  'ik kan mezelf niet vergeven',
  'ik verdien geen vergeving',
  'ik kan het niet loslaten',
  'ik heb te veel kapotgemaakt',
  'hoe kan ik ooit vergeven',
  'ik haat mezelf om wat ik heb gedaan',
  'zij zullen mij nooit vergeven',
  'ik kan hen niet vergeven',
  'ik wil vergeven maar kan het niet',
  'schuld vreet aan me',
  'ik verdien straf',
  'wat ik heb gedaan is onvergeeflijk',
  'ik kan niet leven met wat ik gedaan heb',
];

const VERGV01_MARKERS_EN = [
  'i cannot forgive myself',
  'i do not deserve forgiveness',
  'i cannot let it go',
  'i destroyed too much',
  'how can i ever forgive',
  'i hate myself for what i did',
  'they will never forgive me',
  'i cannot forgive them',
  'i want to forgive but i cannot',
  'guilt is eating me alive',
  'i deserve punishment',
  'what i did is unforgivable',
  'i cannot live with what i have done',
];

const IGH01_MARKERS_NL = [
  'mijn vader was ook verslaafd',
  'mijn moeder dronk ook',
  'het zit in de familie',
  'ik wil niet worden zoals mijn ouders',
  'mijn kind mag dit niet meemaken',
  'de cyclus doorbreken',
  'het patroon herhaalt zich',
  'generatie op generatie',
  'mijn ouders deden hetzelfde',
  'ik doe precies wat zij deden',
  'het is erfelijk',
  'mijn grootvader was ook zo',
  'ik wil het anders doen voor mijn kinderen',
];

const IGH01_MARKERS_EN = [
  'my father was also addicted',
  'my mother also drank',
  'it runs in the family',
  'i do not want to become like my parents',
  'my child should not go through this',
  'break the cycle',
  'the pattern repeats',
  'generation after generation',
  'my parents did the same',
  'i am doing exactly what they did',
  'it is hereditary',
  'my grandfather was the same',
  'i want to do it differently for my children',
];

const AGC01_MARKERS_NL = [
  'ik doe dit voor mijn vrouw',
  'ik doe dit voor mijn man',
  'ik doe dit voor mijn kinderen',
  'ik doe dit voor mijn kind',
  'ik doe dit voor de rechter',
  'ik moet dit van de rechtbank',
  'ik moet dit van mijn partner',
  'anders verlaat ze mij',
  'anders verlies ik mijn kind',
  'anders ben ik alles kwijt',
  'ik moet stoppen voor hen',
  'zij willen dat ik herstel',
  'ik wil hen niet teleurstellen',
  'ik ben hier omdat het moet',
  'ik moet bewijzen dat ik veranderd ben',
  // Kim-specific role phrases
  'ik moet blijven helpen',
  'iedereen verwacht dat ik blijf',
  'als ik stop ben ik slecht',
  'een goede partner laat iemand niet vallen',
  'ik moet sterk blijven voor iedereen',
  'ik voel dat ik geen keuze heb',
  'ik blijf omdat anderen dat verwachten',
  'als ik een grens stel ben ik egoistisch',
];

const AGC01_MARKERS_EN = [
  'i am doing this for my wife',
  'i am doing this for my husband',
  'i am doing this for my children',
  'i am doing this for my child',
  'i am doing this for the judge',
  'the court makes me do this',
  'my partner makes me do this',
  'otherwise she will leave me',
  'otherwise i will lose my child',
  'otherwise i lose everything',
  'i need to stop for them',
  'they want me to recover',
  'i do not want to disappoint them',
  'i am here because i have to be',
  'i have to prove i changed',
  // Kim-specific role phrases
  'i have to keep helping',
  'everyone expects me to stay',
  'if i stop i am bad',
  'a good partner does not abandon someone',
  'i have to stay strong for everyone',
  'i feel like i have no choice',
  'i stay because others expect it',
  'if i set a boundary i am selfish',
];

const HWK01_MARKERS_NL = [
  'verdien ik het om beter te worden',
  'ik verdien geen herstel',
  'ik verdien het niet om beter te worden',
  'waarom zou ik hulp verdienen',
  'ik ben herstel niet waard',
  'ik ben zorg niet waard',
  'ik verdien geen rust',
  'ik verdien geen goed leven',
  'ik heb te veel kapotgemaakt om beter te mogen worden',
  'het zou oneerlijk zijn als ik beter word',
  'ik moet blijven lijden',
  'ik mag niet genezen',
  'anderen verdienen hulp meer dan ik',
  'ik heb mijn kans verspeeld',
  'ik ben te ver heen',
  'voor mij is herstel te laat',
  'ik mag niet gelukkig worden',
];

const HWK01_MARKERS_EN = [
  'do i deserve to get better',
  'i do not deserve recovery',
  'i do not deserve to get better',
  'why would i deserve help',
  'i am not worth recovery',
  'i am not worth care',
  'i do not deserve peace',
  'i do not deserve a good life',
  'i destroyed too much to be allowed to get better',
  'it would be unfair if i got better',
  'i should keep suffering',
  'i am not allowed to heal',
  'other people deserve help more than me',
  'i wasted my chance',
  'i am too far gone',
  'it is too late for me',
  'i am not allowed to be happy',
];

// ─── Quick Gate (cheap pre-filter) ─────────────────────────────────────────────

const ALL_MARKERS = [
  ...VERGV01_MARKERS_NL, ...VERGV01_MARKERS_EN,
  ...IGH01_MARKERS_NL, ...IGH01_MARKERS_EN,
  ...AGC01_MARKERS_NL, ...AGC01_MARKERS_EN,
  ...HWK01_MARKERS_NL, ...HWK01_MARKERS_EN,
];

/**
 * Cheap pre-filter: returns true if any advanced module marker is present.
 * Use this to avoid running the full detection logic on every message.
 */
export function hasAdvancedModuleMarkers(message: string): boolean {
  const lower = message.toLowerCase();
  return ALL_MARKERS.some(marker => lower.includes(marker));
}

// ─── Detection Logic ────────────────────────────────────────────────────────────

interface DetectionScore {
  module: AdvancedModuleId;
  score: number;
  markers: string[];
}

function detectModule(message: string, markersNL: string[], markersEN: string[]): { score: number; markers: string[] } {
  const lower = message.toLowerCase();
  const matched: string[] = [];

  for (const m of markersNL) {
    if (lower.includes(m)) matched.push(m);
  }
  for (const m of markersEN) {
    if (lower.includes(m)) matched.push(m);
  }

  // Scoring: 1 marker = 0.5, 2 = 0.7, 3+ = 0.85
  let score = 0;
  if (matched.length >= 3) score = 0.85;
  else if (matched.length === 2) score = 0.7;
  else if (matched.length === 1) score = 0.5;

  return { score, markers: matched };
}

// ─── Prompt Block Builders ──────────────────────────────────────────────────────

function buildVERGV01PromptBlock(userType: 'elias' | 'kim'): string {
  if (userType === 'kim') {
    return [
      '[VERGV01_CONTEXT]',
      'Module: Vergevingsmodule (Kim)',
      'The caregiver expresses non-forgiveness toward the addicted person.',
      'Do NOT force forgiveness. Validate that the caregiver does NOT have to forgive.',
      'Separate forgiveness from reconciliation, trust, safety, and approval.',
      'Ask: "What would you need before forgiveness is even a question?"',
      'Forbidden: "Je moet hem/haar vergeven", "Vergeving is nodig voor jouw herstel", "Laat het los", "Als je niet vergeeft blijf je vast", "Een goede partner vergeeft"',
      '[/VERGV01_CONTEXT]',
    ].join('\n');
  }
  return [
    '[VERGV01_CONTEXT]',
    'Module: Vergevingsmodule (Elias)',
    'The user is stuck in non-forgiveness toward self.',
    'Help separate harmful behavior from bestaansrecht (right to exist).',
    'Preserve accountability: addiction explains but does not excuse harm.',
    'Do not let guilt become self-destruction. Self-forgiveness is not required for recovery.',
    'Ask: "What would it mean if you could hold both — what you did, and the fact that you are still allowed to exist?"',
    'Forbidden: "Je moet jezelf vergeven", "Vergeving is nodig voor herstel", "Laat het los", "Het was de verslaving niet jij" als volledige absolutie',
    '[/VERGV01_CONTEXT]',
  ].join('\n');
}

function buildIGH01PromptBlock(): string {
  return [
    '[IGH01_CONTEXT]',
    'Module: Intergenerationeel Herstel (Elias only)',
    'The user recognizes addiction/trauma as passed through generations.',
    'Help interrupt cycles without blame, excuse, or impossible pressure.',
    'Core: "What was inherited is now visible. What is visible can be interrupted. What is interrupted does not have to be repeated."',
    'Do not make the child the only reason for recovery. Do not promise the cycle will break.',
    'Forbidden: "Je ouders veroorzaakten dit" als volledige verklaring, "Je bent gedoemd het te herhalen", "Je kind zal worden zoals jij", "Doorbreek de cyclus" als drukslogan',
    '[/IGH01_CONTEXT]',
  ].join('\n');
}

function buildAGC01PromptBlock(userType: 'elias' | 'kim'): string {
  if (userType === 'kim') {
    return [
      '[AGC01_CONTEXT]',
      'Module: Agency-Check (Kim)',
      'The caregiver\'s helping/staying/leaving/boundary-setting appears externally motivated or role-driven.',
      'Validate role pressure without endorsing self-erasure. Separate love from obligation.',
      'Ask: "What part is chosen, and what part are you carrying because you fear what it would mean if you stopped?"',
      'Forbidden: "Een goede verzorger blijft altijd", "Een goede verzorger vertrekt", "Je doet dit alleen uit schuldgevoel", "Je moet voor jezelf kiezen" als commando',
      '[/AGC01_CONTEXT]',
    ].join('\n');
  }
  return [
    '[AGC01_CONTEXT]',
    'Module: Agency-Check (Elias)',
    'The user\'s recovery appears primarily externally motivated (partner, child, court, fear).',
    'Do not shame external motivation. External motivation can start movement.',
    'Ask: "If nobody were watching today, what part of this would still matter to you?"',
    'Forbidden: "Als je het voor iemand anders doet telt het niet", "Je moet het voor jezelf doen anders faalt het", "Je motivatie is fout", "Externe motivatie is nutteloos"',
    '[/AGC01_CONTEXT]',
  ].join('\n');
}

function buildHWK01PromptBlock(): string {
  return [
    '[HWK01_CONTEXT]',
    'Module: Herstelwaardigheid-kern (Elias only)',
    'The user doubts whether they deserve recovery, care, help, peace, or a better future.',
    'Do not answer too quickly. Do not use false reassurance. Hold the question slowly.',
    'Core: Recovery is not a reward. Recovery is not proof of innocence. Recovery is a way to stop damage from continuing.',
    'The user does not have to feel worthy of recovery before recovery is allowed to protect them.',
    'Forbidden: "Natuurlijk verdien je herstel" als snelle fix, "Iedereen verdient herstel" als slogan, "Je bent het waard" als enige respons, "Stop met zo te denken", "Je hebt gewoon zelfliefde nodig"',
    '[/HWK01_CONTEXT]',
  ].join('\n');
}

// ─── Main Runner ────────────────────────────────────────────────────────────────

/**
 * Run the full Elias/Kim advanced module detection pipeline.
 * Detects VERGV01, IGH01, AGC01, HWK01 in parallel, then selects highest-priority.
 * Only ONE module activates per message.
 */
export function runEliasAdvancedModules(input: EliasAdvancedModulesInput): EliasAdvancedModulesResult {
  const emptyResult: EliasAdvancedModulesResult = {
    vergv01Active: false,
    igh01Active: false,
    agc01Active: false,
    hwk01Active: false,
    vergv01PromptBlock: null,
    igh01PromptBlock: null,
    agc01PromptBlock: null,
    hwk01PromptBlock: null,
    primaryModule: 'NONE',
    confidence: 0,
  };

  // Gate: intake must be completed
  if (!input.intakeCompleted) return emptyResult;

  // Gate: crisis blocks advanced modules
  if (input.crisisLevel >= 2) return emptyResult;

  const combinedText = `${input.latestUserMessage} ${input.recentMessages.join(' ')}`;

  // Detect all modules
  const scores: DetectionScore[] = [];

  // VERGV01 — Elias + Kim
  const vergv01 = detectModule(combinedText, VERGV01_MARKERS_NL, VERGV01_MARKERS_EN);
  if (vergv01.score >= 0.5) {
    scores.push({ module: 'VERGV01', score: vergv01.score, markers: vergv01.markers });
  }

  // IGH01 — Elias only
  if (input.userType === 'elias') {
    const igh01 = detectModule(combinedText, IGH01_MARKERS_NL, IGH01_MARKERS_EN);
    if (igh01.score >= 0.5) {
      scores.push({ module: 'IGH01', score: igh01.score, markers: igh01.markers });
    }
  }

  // AGC01 — Elias + Kim
  const agc01 = detectModule(combinedText, AGC01_MARKERS_NL, AGC01_MARKERS_EN);
  if (agc01.score >= 0.5) {
    scores.push({ module: 'AGC01', score: agc01.score, markers: agc01.markers });
  }

  // HWK01 — Elias only
  if (input.userType === 'elias') {
    const hwk01 = detectModule(combinedText, HWK01_MARKERS_NL, HWK01_MARKERS_EN);
    if (hwk01.score >= 0.5) {
      scores.push({ module: 'HWK01', score: hwk01.score, markers: hwk01.markers });
    }
  }

  if (scores.length === 0) return emptyResult;

  // Priority routing: HWK01 > VERGV01 > IGH01 > AGC01
  const PRIORITY: Record<AdvancedModuleId, number> = {
    'HWK01': 4,
    'VERGV01': 3,
    'IGH01': 2,
    'AGC01': 1,
    'NONE': 0,
  };

  // Sort by priority (desc), then by score (desc)
  scores.sort((a, b) => {
    const pDiff = PRIORITY[b.module] - PRIORITY[a.module];
    if (pDiff !== 0) return pDiff;
    return b.score - a.score;
  });

  const winner = scores[0];
  const result: EliasAdvancedModulesResult = { ...emptyResult };
  result.primaryModule = winner.module;
  result.confidence = winner.score;

  switch (winner.module) {
    case 'VERGV01':
      result.vergv01Active = true;
      result.vergv01PromptBlock = buildVERGV01PromptBlock(input.userType);
      break;
    case 'IGH01':
      result.igh01Active = true;
      result.igh01PromptBlock = buildIGH01PromptBlock();
      break;
    case 'AGC01':
      result.agc01Active = true;
      result.agc01PromptBlock = buildAGC01PromptBlock(input.userType);
      break;
    case 'HWK01':
      result.hwk01Active = true;
      result.hwk01PromptBlock = buildHWK01PromptBlock();
      break;
  }

  console.log(`[Pipeline] EliasAdvanced: primary=${winner.module} | confidence=${winner.score.toFixed(2)} | markers=[${winner.markers.slice(0, 3).join(', ')}]`);

  return result;
}
