/**
 * nano-interpret.ts — Pre-call interpretation layer (gpt-4.1-nano)
 *
 * Runs AFTER crisis/safety check, BEFORE module selection.
 * The nano ONLY interprets meaning (themes + intent + translation).
 * The ENGINE decides the module deterministically via theme→module mapping.
 *
 * Persona-parametric: one implementation, persona determines theme vocabulary.
 */

// ─── Types ────────────────────────────────────────────────────────

export interface NanoInterpretInput {
  userMessage: string;
  persona: 'elias' | 'kim';
}

export interface NanoInterpretResult {
  translatedNL: string;
  intent: 'seeking_action' | 'exploring' | 'venting' | 'crisis_signal' | 'informational' | 'greeting';
  themes: string[];  // Only labels from the controlled vocabulary
}

// ─── Controlled Theme Vocabulary (closed sets per persona) ────────

/**
 * ELIAS THEMES — derived from module trigger definitions.
 * Each label maps to exactly one module in ELIAS_THEME_TO_MODULE.
 * The nano may only output labels from this list.
 */
export const ELIAS_THEME_LABELS = [
  // Core modules (E01-E08)
  'craving', 'substance_urge', 'using_desire',
  'emotional_overwhelm', 'cant_handle_feelings', 'falling_apart',
  'relapse_trigger', 'used_again', 'slipped', 'prevention',
  'self_hatred', 'worthlessness', 'shame', 'guilt', 'self_criticism',
  'anxiety', 'panic', 'racing_thoughts', 'grounding',
  'purpose', 'motivation', 'goals', 'hope', 'meaning',
  'concentration', 'foggy_mind', 'scattered',
  'acceptance', 'struggle_with_control', 'resistance',
  // Extended (WILSKRACHT01, AUTOPILOT01)
  'willpower_blame', 'feeling_weak', 'discipline_failure',
  'automatic_trigger', 'conditioned_response', 'habit_loop',
  // Short modules M05-M20
  'loneliness', 'isolation', 'no_connections',
  'broken_trust', 'betrayal',
  'fear_of_closeness', 'intimacy_panic', 'pushing_away',
  'sleep_problems', 'insomnia', 'nightmares',
  'perfectionism', 'internal_pressure', 'fear_of_failure',
  'loss', 'death', 'grief', 'mourning',
  'overwhelm', 'exhaustion', 'burnout', 'explosion',
  'childhood_trauma', 'abuse', 'traumatic_memories',
  'shame_from_rejection', 'being_rejected',
  'internalized_rejection', 'feeling_unlovable',
  // Short modules M21-M85
  'abandonment_fear', 'invisibility',
  'intimacy_as_danger', 'permanent_outsider',
  'chronically_misunderstood', 'overcontrol',
  'emotional_instability', 'fear_of_proximity',
  'loss_of_control_after_confrontation', 'self_medication',
  'responsibility_for_others', 'ambivalent_closeness',
  'guilt_after_relapse', 'autonomous_but_exhausted',
  'repetition_of_rejection', 'failure_as_identity',
  'sexual_trauma', 'uncontrollable_urge',
  'penance_for_existing', 'repeated_relapse_context',
  'craving_from_boredom', 'child_must_be_strong',
  'mask_of_happiness', 'symbiosis_with_parent',
  'perfection_as_survival', 'self_hate_at_vulnerability',
  'distance_after_closeness', 'expectation_of_failure',
  'panic_without_cause', 'fear_of_recognition',
  'never_enough', 'co_regulation_fails',
  'societal_rejection', 'isolation_as_safety',
  'new_relationships_as_repetition', 'mother_complex',
  'identity_confusion_under_pressure', 'refusal_of_help',
  'relationship_equals_regression', 'constant_scanning',
  'loss_of_spirituality', 'guilt_asking_for_help',
  'no_right_to_exist', 'fleeing_into_thoughts',
  'fear_of_reflection', 'loneliness_to_use',
  'existential_void', 'social_expectation_vs_reality',
  'masking_relapse', 'loss_of_control_in_relationship',
  'desire_for_numbness', 'automatism_of_use',
  'starting_over_again', 'innocence_suspected',
  'boundary_violation_as_norm', 'relationship_as_mirror',
  // Advanced Elias modules
  'guilt_forgiveness', 'generational_patterns',
  'external_motivation', 'worthiness_of_recovery',
  'active_relapse_analysis', 'deep_ambivalence',
  'betrayal_discovery_shock', 'trust_repair',
  'gaslighting', 'reality_distortion',
  'stoic_reflection', 'shadow_work',
  'sleep_and_recovery', 'psychoeducation',
  'support_pillars', 'self_acceptance',
  'self_discovery', 'coexistence_with_pain',
  // Greeting/general
  'greeting', 'small_talk', 'general_question',
] as const;

/**
 * KIM THEMES — derived from Kim module trigger definitions.
 * Each label maps to exactly one module in KIM_THEME_TO_MODULE.
 */
export const KIM_THEME_LABELS = [
  // Core modules (K01-K06)
  'boundary_setting', 'saying_no', 'protecting_space', 'limits',
  'enabling', 'stress', 'burden', 'too_much_responsibility',
  'self_care', 'neglecting_self', 'caregiver_fatigue',
  'emotional_overload', 'betrayal_feelings', 'trust_issues',
  'communication', 'difficult_conversations', 'talking_to_addict',
  'sustainable_support', 'long_term_preservation',
  // Extended Kim modules
  'stoic_acceptance', 'control_separation', 'steadiness',
  'loving_detachment', 'letting_go',
  'boundary_restoration', 'rebuilding_boundaries',
  'self_compassion', 'guilt_about_own_needs',
  // Advanced Kim modules
  'codependency', 'enmeshment', 'losing_self',
  'grief_renewal', 'mourning_relationship', 'loss_of_person',
  'isolation_withdrawal', 'cutting_off_support',
  'hope', 'hopelessness', 'situational_despair',
  'shame_about_situation', 'stigma', 'hiding',
  // Kim clusters
  'active_relapse_happening', 'post_relapse_aftermath',
  'acute_danger', 'violence', 'medical_emergency',
  'child_safety', 'children_affected',
  'danger_without_child',
  'role_confusion', 'relational_dynamics',
  'trust_repair_after_betrayal', 'deception_discovery',
  // Kim pattern support
  'support_pillar_caregiver', 'behavioral_management',
  'adaptation_patterns', 'codependent_patterns',
  // Greeting/general
  'greeting', 'small_talk', 'general_question',
] as const;

export type EliasThemeLabel = typeof ELIAS_THEME_LABELS[number];
export type KimThemeLabel = typeof KIM_THEME_LABELS[number];

// ─── Deterministic Theme → Module Mapping ────────────────────────

/**
 * Maps each Elias theme label to exactly one module ID.
 * The engine uses this to select the module deterministically.
 * Priority when multiple themes match: first theme in array wins (nano orders by relevance).
 */
export const ELIAS_THEME_TO_MODULE: Record<string, string> = {
  // E01 — Craving Management
  craving: 'E01', substance_urge: 'E01', using_desire: 'E01',
  // E02 — Emotional Regulation
  emotional_overwhelm: 'E02', cant_handle_feelings: 'E02', falling_apart: 'E02',
  // E03 — Relapse Prevention
  relapse_trigger: 'E03', used_again: 'E03', slipped: 'E03', prevention: 'E03',
  // E04 — Self-Compassion
  self_hatred: 'E04', worthlessness: 'E04', shame: 'E04', guilt: 'E04', self_criticism: 'E04',
  // E05 — Mindfulness & Grounding
  anxiety: 'E05', panic: 'E05', racing_thoughts: 'E05', grounding: 'E05',
  // E06 — Values & Meaning
  purpose: 'E06', motivation: 'E06', goals: 'E06', hope: 'E06', meaning: 'E06',
  // E07 — Focus & Clarity
  concentration: 'E07', foggy_mind: 'E07', scattered: 'E07',
  // E08 — ACT Acceptance
  acceptance: 'E08', struggle_with_control: 'E08', resistance: 'E08',
  // WILSKRACHT01
  willpower_blame: 'WILSKRACHT01', feeling_weak: 'WILSKRACHT01', discipline_failure: 'WILSKRACHT01',
  // AUTOPILOT01
  automatic_trigger: 'AUTOPILOT01', conditioned_response: 'AUTOPILOT01', habit_loop: 'AUTOPILOT01',
  // M05 — Structurele eenzaamheid
  loneliness: 'M05', isolation: 'M05', no_connections: 'M05',
  // M06 — Vertrouwensbreuk
  broken_trust: 'M06', betrayal: 'M06',
  // M07 — Paniek bij nabijheid
  fear_of_closeness: 'M07', intimacy_panic: 'M07', pushing_away: 'M07',
  // M08 — Slaapstoornis
  sleep_problems: 'M08', insomnia: 'M08', nightmares: 'M08',
  // M09 — Interne druk/perfectionisme
  perfectionism: 'M09', internal_pressure: 'M09', fear_of_failure: 'M09',
  // M13 — Verlies van ouder
  loss: 'M13', death: 'M13', grief: 'M13', mourning: 'M13',
  // M16 — Overbelasting/ontploffing
  overwhelm: 'M16', exhaustion: 'M16', burnout: 'M16', explosion: 'M16',
  // M17 — Traumatische kindervaring
  childhood_trauma: 'M17', abuse: 'M17', traumatic_memories: 'M17',
  // M19 — Schaamte door afwijzing
  shame_from_rejection: 'M19', being_rejected: 'M19',
  // M20 — Verinnerlijkte verwerping
  internalized_rejection: 'M20', feeling_unlovable: 'M20',
  // M21 — Verlatingsangst
  abandonment_fear: 'M21',
  // M22 — Onzichtbaarheid
  invisibility: 'M22',
  // M23 — Intimiteit als gevaar
  intimacy_as_danger: 'M23',
  // M25 — Permanent buitenstaander
  permanent_outsider: 'M25',
  // M26 — Chronisch misbegrepen
  chronically_misunderstood: 'M26',
  // M27 — Overcontrole als overleving
  overcontrol: 'M27',
  // M29 — Emotionele instabiliteit
  emotional_instability: 'M29',
  // M30 — Angst voor nabijheid
  fear_of_proximity: 'M30',
  // M33 — Controleverlies na confrontatie
  loss_of_control_after_confrontation: 'M33',
  // M34 — Zelfmedicatie voor onrust
  self_medication: 'M34',
  // M35 — Verantwoordelijkheid voor anderen
  responsibility_for_others: 'M35',
  // M40 — Ambivalente nabijheid
  ambivalent_closeness: 'M40',
  // M41 — Schuld na terugval
  guilt_after_relapse: 'M41',
  // M42 — Autonoom maar uitgeput
  autonomous_but_exhausted: 'M42',
  // M43 — Herhaling van afwijzing
  repetition_of_rejection: 'M43',
  // M44 — Falen als identiteit
  failure_as_identity: 'M44',
  // M45 — Seksueel trauma
  sexual_trauma: 'M45',
  // M46 — Oncontroleerbare drift
  uncontrollable_urge: 'M46',
  // M47 — Boete voor bestaan
  penance_for_existing: 'M47',
  // M49 — Herhaalde hervalcontext
  repeated_relapse_context: 'M49',
  // M50 — Craving uit verveling
  craving_from_boredom: 'M50',
  // M51 — Kind moet sterk zijn
  child_must_be_strong: 'M51',
  // M52 — Masker van vrolijkheid
  mask_of_happiness: 'M52',
  // M53 — Symbiose met ouder
  symbiosis_with_parent: 'M53',
  // M54 — Perfectie als overleving
  perfection_as_survival: 'M54',
  // M55 — Zelfhaat bij kwetsbaarheid
  self_hate_at_vulnerability: 'M55',
  // M56 — Afstand na nabijheid
  distance_after_closeness: 'M56',
  // M57 — Verwachting van mislukking
  expectation_of_failure: 'M57',
  // M58 — Paniek zonder aanleiding
  panic_without_cause: 'M58',
  // M59 — Bang voor herkenning
  fear_of_recognition: 'M59',
  // M60 — Nooit genoeg zijn
  never_enough: 'M60',
  // M61 — Co-regulatie faalt
  co_regulation_fails: 'M61',
  // M62 — Maatschappelijke afwijzing
  societal_rejection: 'M62',
  // M63 — Isolatie als veiligheid
  isolation_as_safety: 'M63',
  // M64 — Nieuwe relaties als herhaling
  new_relationships_as_repetition: 'M64',
  // M65 — Moedercomplex
  mother_complex: 'M65',
  // M66 — Identiteitsverwarring bij druk
  identity_confusion_under_pressure: 'M66',
  // M67 — Weigering van hulp
  refusal_of_help: 'M67',
  // M68 — Relatie = regressie
  relationship_equals_regression: 'M68',
  // M69 — Constant scannen
  constant_scanning: 'M69',
  // M70 — Verlies spiritualiteit
  loss_of_spirituality: 'M70',
  // M71 — Schuld bij hulp vragen
  guilt_asking_for_help: 'M71',
  // M72 — Geen bestaansrecht
  no_right_to_exist: 'M72',
  // M73 — Vluchten in gedachten
  fleeing_into_thoughts: 'M73',
  // M74 — Angst voor reflectie
  fear_of_reflection: 'M74',
  // M75 — Eenzaamheid naar gebruik
  loneliness_to_use: 'M75',
  // M76 — Existentieel zwart gat
  existential_void: 'M76',
  // M77 — Sociale verwachting vs realiteit
  social_expectation_vs_reality: 'M77',
  // M78 — Maskeren van terugval
  masking_relapse: 'M78',
  // M79 — Verlies van controle in relatie
  loss_of_control_in_relationship: 'M79',
  // M80 — Wens naar verdoving
  desire_for_numbness: 'M80',
  // M81 — Automatisme gebruik
  automatism_of_use: 'M81',
  // M82 — Steeds opnieuw beginnen
  starting_over_again: 'M82',
  // M83 — Onschuld verdacht
  innocence_suspected: 'M83',
  // M84 — Grensoverschrijding als norm
  boundary_violation_as_norm: 'M84',
  // M85 — Relatie als spiegel
  relationship_as_mirror: 'M85',
  // Advanced Elias modules
  guilt_forgiveness: 'VERGV01',
  generational_patterns: 'IGH01',
  external_motivation: 'AGC01',
  worthiness_of_recovery: 'HWK01',
  active_relapse_analysis: 'FALE01',
  deep_ambivalence: 'MI02',
  betrayal_discovery_shock: 'BEDR01',
  trust_repair: 'VETR01',
  gaslighting: 'GASL01', reality_distortion: 'GASL01',
  stoic_reflection: 'STO01',
  shadow_work: 'SW01',
  sleep_and_recovery: 'SLAAP01',
  psychoeducation: 'WILSKRACHT01',
  support_pillars: 'PAAL01',
  self_acceptance: 'IKST01',
  self_discovery: 'ONTK01',
  coexistence_with_pain: 'COEX01',
  // Greeting/general → default
  greeting: 'E02', small_talk: 'E02', general_question: 'E02',
};

/**
 * Maps each Kim theme label to exactly one module ID.
 */
export const KIM_THEME_TO_MODULE: Record<string, string> = {
  // K01 — Boundary Setting
  boundary_setting: 'K01', saying_no: 'K01', protecting_space: 'K01', limits: 'K01',
  // K02 — Enabling Awareness
  enabling: 'K02', stress: 'K02', burden: 'K02', too_much_responsibility: 'K02',
  // K03 — Self-Care
  self_care: 'K03', neglecting_self: 'K03', caregiver_fatigue: 'K03',
  // K04 — Emotional Regulation
  emotional_overload: 'K04', betrayal_feelings: 'K04', trust_issues: 'K04',
  // K05 — Communication Skills
  communication: 'K05', difficult_conversations: 'K05', talking_to_addict: 'K05',
  // K06 — Self-Care & Sustainable Support
  sustainable_support: 'K06', long_term_preservation: 'K06',
  // KST01 — Stoicism for Caregivers
  stoic_acceptance: 'KST01', control_separation: 'KST01', steadiness: 'KST01',
  // KDL01 — Detachment with Love
  loving_detachment: 'KDL01', letting_go: 'KDL01',
  // KBR01 — Boundary Restoration
  boundary_restoration: 'KBR01', rebuilding_boundaries: 'KBR01',
  // KSC01 — Self-Compassion for Caregivers
  self_compassion: 'KSC01', guilt_about_own_needs: 'KSC01',
  // CDP01 — Codependency
  codependency: 'CDP01', enmeshment: 'CDP01', losing_self: 'CDP01',
  // RNW01 — Grief & Renewal
  grief_renewal: 'RNW01', mourning_relationship: 'RNW01', loss_of_person: 'RNW01',
  // ISO01 — Isolation
  isolation_withdrawal: 'ISO01', cutting_off_support: 'ISO01',
  // HOOP-K01 — Hope
  hope: 'HOOP-K01', hopelessness: 'HOOP-K01', situational_despair: 'HOOP-K01',
  // SCHAAM-K01 — Shame
  shame_about_situation: 'SCHAAM-K01', stigma: 'SCHAAM-K01', hiding: 'SCHAAM-K01',
  // Kim Relapse Cluster
  active_relapse_happening: 'HERV-K01',
  post_relapse_aftermath: 'NAHERV-K01',
  acute_danger: 'CRISIS-K01', violence: 'CRISIS-K01', medical_emergency: 'CRISIS-K01',
  // Kim Danger/Child Cluster
  child_safety: 'KIND-K01', children_affected: 'KIND-K01',
  danger_without_child: 'GEVAAR-K01',
  // Kim Relational Dynamics
  role_confusion: 'ROL-K01', relational_dynamics: 'ROL-K01',
  trust_repair_after_betrayal: 'VETR02-K', deception_discovery: 'LEUGEN-K01',
  // Kim Pattern Support
  support_pillar_caregiver: 'PAAL-K01',
  behavioral_management: 'BEHE-K01',
  adaptation_patterns: 'AANP-K01',
  codependent_patterns: 'CODEP-K01',
  // Greeting/general → default
  greeting: 'K01', small_talk: 'K01', general_question: 'K01',
};

// ─── Resolve Module from Themes (deterministic) ──────────────────

/**
 * Given an array of theme labels from the nano, resolve to a single module ID.
 * Uses first-match priority: the nano orders themes by relevance, so the first
 * theme that maps to a module wins.
 *
 * Returns the default module if no themes map to anything.
 */
export function resolveModuleFromThemes(
  themes: string[],
  persona: 'elias' | 'kim'
): { moduleId: string; matchedTheme: string | null } {
  const map = persona === 'elias' ? ELIAS_THEME_TO_MODULE : KIM_THEME_TO_MODULE;
  const defaultModule = persona === 'elias' ? 'E02' : 'K01';

  for (const theme of themes) {
    const moduleId = map[theme];
    if (moduleId) {
      return { moduleId, matchedTheme: theme };
    }
  }

  return { moduleId: defaultModule, matchedTheme: null };
}

// ─── Filter Valid Themes ─────────────────────────────────────────

const ELIAS_THEME_SET = new Set<string>(ELIAS_THEME_LABELS);
const KIM_THEME_SET = new Set<string>(KIM_THEME_LABELS);

/**
 * Filter out any themes not in the controlled vocabulary.
 * This is the hallucination guard: themes outside the set are silently dropped.
 */
function filterValidThemes(themes: string[], persona: 'elias' | 'kim'): string[] {
  const validSet = persona === 'elias' ? ELIAS_THEME_SET : KIM_THEME_SET;
  const valid = themes.filter(t => validSet.has(t));
  if (valid.length < themes.length) {
    const invalid = themes.filter(t => !validSet.has(t));
    console.warn(`[NanoInterpret] Dropped invalid themes for ${persona}: ${invalid.join(', ')}`);
  }
  return valid;
}

// ─── Nano System Prompt (theme-only, no module suggestion) ───────

function buildThemeListForPrompt(persona: 'elias' | 'kim'): string {
  const labels = persona === 'elias' ? ELIAS_THEME_LABELS : KIM_THEME_LABELS;
  return labels.join(', ');
}

const SYSTEM_PROMPT_PREFIX = `You are a message interpreter for a therapeutic AI app. Your task is to analyze a user message and determine:
1. The Dutch translation (if not already Dutch, return unchanged if already Dutch)
2. The user's intent
3. Semantic themes present in the message

CRITICAL RULES:
- Output ONLY valid JSON, no explanation
- translatedNL: if the message is already Dutch, return it unchanged. If another language, translate to Dutch.
- intent: one of "seeking_action", "exploring", "venting", "crisis_signal", "informational", "greeting"
- themes: 1-4 theme labels EXCLUSIVELY from the provided controlled vocabulary below. You MUST NOT invent new labels. Pick the most relevant labels that match the message content, ordered by relevance (most relevant first).

If the message is a simple greeting or small talk, use "greeting" as the only theme.
If no themes clearly match, use the closest available label.

Output format:
{"translatedNL":"...","intent":"...","themes":["...",  "..."]}`;

// ─── Main Function ────────────────────────────────────────────────

export async function runNanoInterpret(
  input: NanoInterpretInput
): Promise<NanoInterpretResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[NanoInterpret] OPENAI_API_KEY is not configured');
  }

  const themeList = buildThemeListForPrompt(input.persona);

  const systemPrompt = `${SYSTEM_PROMPT_PREFIX}\n\nPersona: ${input.persona}\n\nControlled theme vocabulary (ONLY use labels from this list):\n${themeList}`;

  const userPrompt = input.userMessage;

  // Attempt with 1 retry
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-nano',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 300,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[NanoInterpret] API error (attempt ${attempt + 1}):`, response.status, errorText);
        if (attempt === 0) continue; // retry once
        throw new Error(`[NanoInterpret] API failed after retry: ${response.status}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error(`[NanoInterpret] Empty response (attempt ${attempt + 1})`);
        if (attempt === 0) continue;
        throw new Error('[NanoInterpret] Empty response after retry');
      }

      const parsed = JSON.parse(content) as { translatedNL: string; intent: string; themes: string[] };

      // Validate required fields
      if (!parsed.translatedNL || !parsed.intent) {
        console.error(`[NanoInterpret] Invalid response structure (attempt ${attempt + 1}):`, content);
        if (attempt === 0) continue;
        throw new Error('[NanoInterpret] Invalid response structure after retry');
      }

      // Ensure themes is always an array
      if (!Array.isArray(parsed.themes)) {
        parsed.themes = [];
      }

      // Filter themes against controlled vocabulary (hallucination guard)
      const validThemes = filterValidThemes(parsed.themes, input.persona);

      // Validate intent
      const validIntents = ['seeking_action', 'exploring', 'venting', 'crisis_signal', 'informational', 'greeting'];
      const intent = validIntents.includes(parsed.intent)
        ? parsed.intent as NanoInterpretResult['intent']
        : 'exploring';

      return {
        translatedNL: parsed.translatedNL,
        intent,
        themes: validThemes,
      };
    } catch (error: any) {
      if (attempt === 0 && !error.message?.includes('after retry')) {
        console.error(`[NanoInterpret] Error (attempt ${attempt + 1}), retrying:`, error.message);
        continue;
      }
      throw error;
    }
  }

  // Should never reach here due to throw in loop, but TypeScript needs it
  throw new Error('[NanoInterpret] Unexpected: exhausted retries');
}
