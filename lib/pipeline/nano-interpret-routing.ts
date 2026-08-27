import { ELIAS_DEFAULT_MODULE, ELIAS_MODULE_ALIGNMENTS } from '@/lib/engine/elias/module-catalog';
import { SHORT_MODULE_TAG_MAP } from '@/lib/engine/elias/short-module-routing';
import { KIM_MODULE_CATALOG, KIM_THERAPEUTIC_MODULES } from '@/lib/engine/kim/module-catalog';

const ELIAS_CORE_THEME_MAP: Record<string, string> = {
  craving: 'E01', substance_urge: 'E01', using_desire: 'E01',
  emotional_overwhelm: 'E02', cant_handle_feelings: 'E02', falling_apart: 'E02',
  relapse_trigger: 'E03', used_again: 'E03', slipped: 'E03', prevention: 'E03',
  self_hatred: 'E04', shame: 'E04', guilt: 'E04', self_criticism: 'E04',
  anxiety: 'E05', panic: 'E05', racing_thoughts: 'E05', grounding: 'E05',
  purpose: 'E06', motivation: 'E06', goals: 'E06', hope: 'E06', meaning: 'E06',
  concentration: 'E07', foggy_mind: 'E07', scattered: 'E07',
  acceptance: 'E08', struggle_with_control: 'E08', resistance: 'E08',
  guilt_forgiveness: 'VERGV01', generational_patterns: 'IGH01', external_motivation: 'AGC01',
  worthiness_of_recovery: 'HWK01', active_relapse_analysis: 'FALE01',
  betrayal_discovery_shock: 'BEDR01', trust_repair: 'VETR01', gaslighting: 'GASL01',
  reality_distortion: 'GASL01', stoic_reflection: 'STO01', shadow_work: 'SW01',
  sleep_and_recovery: 'SLAAP01', support_pillars: 'PAAL01', self_acceptance: 'IKST01',
  self_discovery: 'ONTK01', coexistence_with_pain: 'COEX01', greeting: 'E02',
  small_talk: 'E02', general_question: 'E02',
};

const KIM_EXPLICIT_THEME_MAP: Record<string, string> = {
  broken_trust: 'K04', betrayal: 'K04', trust_repair: 'VETR01', betrayal_discovery_shock: 'BEDR01',
  overwhelm: 'K03', exhaustion: 'K03', burnout: 'K03', autonomous_but_exhausted: 'K03',
  responsibility_for_others: 'K02', rescue_role: 'K02', controlling_other_recovery: 'K02',
  managing_other_sobriety: 'K02', loss_of_control_in_relationship: 'K01', boundary_violation_as_norm: 'K01',
  emotional_dependency: 'K03', self_loss_through_other: 'K03', day_depends_on_other: 'K03',
  parentification_pattern: 'PAR01', had_to_care_for_parents: 'PAR01', no_childhood: 'PAR01',
  forced_adult_role: 'PAR01', child_as_caregiver: 'PAR01',
  financial_dependency: 'FIN01', money_as_control: 'FIN01', no_financial_autonomy: 'FIN01',
  economic_abuse: 'FIN01', financial_control: 'FIN01',
  ambiguous_loss: 'ROUW-K01', living_grief: 'ROUW-K01', missing_who_they_were: 'ROUW-K01',
  social_isolation_caregiver: 'ISOL-K01', lost_own_contacts: 'ISOL-K01', caregiving_isolation: 'ISOL-K01',
  medical_concern_partner: 'K01', withdrawal_symptoms: 'K01', organ_damage_concern: 'K01',
  intent_attribution: 'K05', motive_assumption: 'K05', deliberate_harm_belief: 'K05',
  greeting: 'K01', small_talk: 'K01', general_question: 'K01',
};

function kimCatalogThemeMap(): Record<string, string> {
  const map: Record<string, string> = { ...KIM_EXPLICIT_THEME_MAP };
  for (const module of KIM_THERAPEUTIC_MODULES) {
    for (const trigger of module.triggers) {
      const condition = typeof trigger === 'string' ? trigger : trigger.condition;
      for (const label of condition.split('|').map((item: string) => item.trim()).filter(Boolean)) {
        if (/^[a-z0-9_]+$/i.test(label)) map[label] ??= module.id;
      }
    }
  }
  return map;
}

const ELIAS_THEME_MAP: Record<string, string> = {
  ...SHORT_MODULE_TAG_MAP,
  ...ELIAS_CORE_THEME_MAP,
};
const KIM_THEME_MAP = kimCatalogThemeMap();

export function getNanoThemeVocabulary(persona: 'elias' | 'kim'): string[] {
  const map = persona === 'elias' ? ELIAS_THEME_MAP : KIM_THEME_MAP;
  return Object.keys(map).sort();
}

export function resolveNanoModuleClient(
  themes: string[],
  persona: 'elias' | 'kim',
): { themes: string[]; resolvedModule: string | null; matchedTheme: string | null } {
  const map = persona === 'elias' ? ELIAS_THEME_MAP : KIM_THEME_MAP;
  const validThemes = themes.filter((theme) => typeof theme === 'string' && Boolean(map[theme]));
  const matchedTheme = validThemes[0] ?? null;
  const resolvedModule = matchedTheme ? map[matchedTheme] : null;
  return {
    themes: validThemes,
    resolvedModule: resolvedModule ?? (persona === 'elias' ? ELIAS_DEFAULT_MODULE : null),
    matchedTheme,
  };
}

export function buildNanoSystemPrompt(persona: 'elias' | 'kim'): string {
  return `You interpret one message for a therapeutic support app. You do not make clinical decisions.
Return ONLY JSON with keys translatedNL, intent, themes.
translatedNL: Dutch translation, unchanged if already Dutch.
intent: seeking_action | exploring | venting | crisis_signal | informational | greeting.
themes: zero to four labels, only from this controlled vocabulary, ordered by relevance:
${getNanoThemeVocabulary(persona).join(', ')}
Do not infer self-hatred, shame, diagnosis or crisis unless explicitly supported by the message.`;
}
