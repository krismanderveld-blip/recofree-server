/**
 * nano-interpret.ts — Pre-call interpretation layer (gpt-5-nano)
 *
 * Runs AFTER crisis/safety check, BEFORE module selection.
 * The nano ONLY interprets meaning (themes + intent + translation).
 * The ENGINE decides the module deterministically via theme→module mapping.
 *
 * Persona-parametric: one implementation, persona determines theme vocabulary.
 *
 * Theme vocabulary derived from:
 * - Elias: short-module-routing.ts (M05-M85, 5-6 tags per module) + E01-E08 + advanced modules
 * - Kim: module-catalog.ts triggers + advanced module definitions
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
 * ELIAS THEMES — 397 labels covering 91 modules.
 * Derived from short-module-routing.ts (M05-M85) + core modules (E01-E08) + advanced modules.
 * The nano may only output labels from this list.
 */
export const ELIAS_THEME_LABELS = [
  'craving', 'substance_urge', 'using_desire', 'emotional_overwhelm', 'cant_handle_feelings', 'falling_apart',
  'relapse_trigger', 'used_again', 'slipped', 'prevention', 'self_hatred', 'worthlessness',
  'shame', 'guilt', 'self_criticism', 'anxiety', 'panic', 'racing_thoughts',
  'grounding', 'purpose', 'motivation', 'goals', 'hope', 'meaning',
  'concentration', 'foggy_mind', 'scattered', 'acceptance', 'struggle_with_control', 'resistance',
  'willpower_blame', 'feeling_weak', 'discipline_failure', 'automatic_trigger', 'conditioned_response', 'habit_loop',
  'guilt_forgiveness', 'generational_patterns', 'external_motivation', 'worthiness_of_recovery', 'active_relapse_analysis', 'betrayal_discovery_shock',
  'trust_repair', 'gaslighting', 'reality_distortion', 'stoic_reflection', 'shadow_work', 'sleep_and_recovery',
  'psychoeducation', 'support_pillars', 'self_acceptance', 'self_discovery', 'coexistence_with_pain', 'greeting',
  'small_talk', 'general_question', 'structural_loneliness', 'no_real_connection', 'nobody_would_miss_me', 'social_disconnection',
  'existential_isolation', 'trust_rupture', 'nobody_can_be_trusted', 'all_bonds_break', 'betrayal_expectation', 'attachment_mistrust',
  'closeness_panic', 'attachment_alarm', 'intimacy_shutdown', 'proximity_trigger', 'relational_freeze', 'sleep_disturbance',
  'use_to_sleep', 'night_craving', 'insomnia_risk', 'circadian_disruption', 'perfectionism', 'internal_pressure',
  'never_enough', 'all_or_nothing_recovery', 'punitive_self_control', 'parental_loss', 'unfinished_grief', 'grief_guilt',
  'mother_loss', 'father_loss', 'unresolved_bereavement', 'overload', 'explosion_risk', 'too_much_at_once',
  'acute_pressure', 'overstimulation', 'emotional_overload', 'childhood_trauma', 'old_alarm', 'inner_child_activation',
  'early_schema_trigger', 'past_present_overlap', 'rejection_shame', 'self_disgust', 'abandonment_shame', 'relational_shame',
  'identity_attack_after_rejection', 'internalized_rejection', 'defectiveness_schema', 'not_worth_recovery', 'no_place_in_world', 'abandonment_fear',
  'fear_of_being_left', 'attachment_panic', 'relational_alarm', 'they_always_leave', 'invisibility', 'nobody_sees_me',
  'unseen_pain', 'emotional_invisibility', 'disappearing_self', 'intimacy_as_danger', 'engulfment_fear', 'autonomy_threat',
  'closeness_as_control', 'relational_fusion_fear', 'permanent_outsider', 'nowhere_belonging', 'outsider_identity', 'not_part_of_anything',
  'social_alienation', 'chronically_misunderstood', 'not_getting_me', 'invalidation', 'defensive_exhaustion', 'misread_identity',
  'overcontrol', 'perfectionistic_control', 'rigid_recovery', 'control_as_survival', 'fear_of_losing_control', 'emotional_instability',
  'rapid_state_shift', 'affective_swing', 'emotional_whiplash', 'unstable_self_state', 'fear_of_closeness', 'social_overload',
  'too_many_people', 'proximity_overload', 'connection_ambivalence', 'confrontation_trigger', 'loss_of_control', 'criticism_reactivity',
  'shame_rage', 'explosive_response', 'self_medication', 'use_to_calm', 'inner_restlessness', 'sedation_seeking',
  'medication_misuse_risk', 'overresponsibility', 'carrying_others', 'self_sacrifice', 'responsibility_fusion', 'caregiver_identity_in_dependent',
  'ambivalent_closeness', 'proximity_ambivalence', 'want_connection_too_much', 'closeness_overload', 'push_pull_contact', 'relapse_guilt',
  'post_relapse_shame', 'ruined_everything', 'all_or_nothing_after_relapse', 'relapse_identity_fusion', 'autonomous_but_exhausted', 'doing_everything_alone',
  'help_refusal', 'exhausted_independence', 'isolated_self_reliance', 'repeated_rejection', 'never_chosen', 'second_choice_schema',
  'rejection_repetition', 'not_chosen_wound', 'failure_identity', 'global_failure', 'shame_fusion', 'learned_failure',
  'all_or_nothing_failure', 'sexual_trauma', 'body_shame', 'feeling_dirty', 'touch_trigger', 'sexual_boundary_violation',
  'trauma_body_memory', 'uncontrollable_urge', 'impulse_discharge', 'explosive_impulse', 'no_brake', 'act_before_thinking',
  'urge_to_act', 'existence_shame', 'never_should_have_been_born', 'not_allowed_to_exist', 'suicidal_language_possible', 'burden_identity',
  'repeated_relapse_context', 'cannot_maintain_recovery', 'relapse_loop', 'context_defeats_plan', 'recurring_trigger_pattern', 'boredom_craving',
  'emptiness_trigger', 'underarousal', 'nothing_to_feel', 'anhedonia_craving', 'habit_craving', 'parentification',
  'child_had_to_be_strong', 'early_burden', 'forced_maturity', 'childhood_overresponsibility', 'cheerful_mask', 'laughing_but_empty',
  'emotional_masking', 'humor_defense', 'affective_flatness', 'social_performance', 'parental_symbiosis', 'still_their_child',
  'enmeshment', 'parental_guilt', 'adult_child_role', 'differentiation_issue', 'perfection_as_survival', 'no_mistakes_allowed',
  'fear_of_error', 'punitive_perfectionism', 'mistake_danger', 'vulnerability_shame', 'crying_equals_weakness', 'self_attack_after_emotion',
  'emotional_exposure_shame', 'shame_after_crying', 'distance_after_closeness', 'post_connection_shutdown', 'vulnerability_aftershock', 'intimacy_hangover',
  'closeness_then_withdrawal', 'expectation_of_failure', 'pessimistic_prediction', 'failure_forecast', 'learned_helplessness', 'preemptive_defeat',
  'panic_without_trigger', 'body_alarm', 'somatic_panic', 'unexplained_anxiety', 'autonomic_activation', 'fear_of_being_seen',
  'fear_of_exposure', 'shame_mask', 'imposter_self', 'being_seen_through', 'exposure_panic', 'failing_despite_effort',
  'effort_without_worth', 'chronic_inadequacy', 'proving_self', 'coregulation_failure', 'nobody_calms_me', 'unreachable_state',
  'support_does_not_land', 'too_much_for_others', 'system_rejection', 'not_fit_system', 'societal_mismatch', 'institutional_shame',
  'isolation_as_safety', 'protective_withdrawal', 'self_protection_isolation', 'avoidant_retreat', 'unsafe_connection', 'relationship_pattern_repetition',
  'new_relationship_old_pattern', 'repetition_compulsion', 'relational_trigger', 'pattern_returning', 'mother_complex', 'seeking_to_be_carried',
  'maternal_longing', 'regressive_dependency', 'unmet_mother_need', 'rescue_attachment', 'identity_confusion_under_pressure', 'yelling_trigger',
  'self_loss_under_conflict', 'pressure_collapse', 'relational_domination', 'leave_me_alone', 'autonomous_defense', 'support_rejection',
  'help_shame', 'defensive_independence', 'relationship_regression', 'becoming_small', 'child_state_in_relationship', 'adult_position_loss',
  'attachment_regression', 'hypervigilance', 'constant_scanning', 'never_relaxed', 'threat_monitoring', 'social_scanning',
  'body_alarm_monitoring', 'spiritual_loss', 'lost_connection', 'meaning_loss', 'existential_disconnection', 'faith_rupture',
  'loss_of_belonging_to_life', 'help_guilt', 'burden_shame', 'afraid_to_ask_help', 'support_request_block', 'not_want_to_be_burden',
  'no_right_to_exist', 'redundant_self', 'existence_worthlessness', 'disappearance_fantasy', 'cognitive_escape', 'living_in_head',
  'overanalysis', 'rumination_as_avoidance', 'intellectualization', 'body_disconnection', 'fear_of_reflection', 'self_reflection_avoidance',
  'introspection_threat', 'do_not_want_to_look', 'reflection_shutdown', 'loneliness_to_use', 'use_to_not_feel_loneliness', 'isolation_craving',
  'absence_pain', 'connection_void_relapse', 'existential_void', 'is_this_all', 'meaninglessness', 'recovery_emptiness',
  'future_void', 'existential_black_hole', 'social_masking', 'everyone_thinks_im_fine', 'hidden_distress', 'functional_collapse',
  'outside_inside_gap', 'masking_relapse', 'pretending_fine', 'hidden_use', 'relapse_secrecy', 'minimization',
  'concealed_craving', 'relational_control_loss', 'what_is_mine', 'boundary_confusion', 'emotional_fusion', 'relational_enmeshment',
  'gaslighting_possible', 'wish_for_numbness', 'do_not_want_to_feel', 'sedation_wish', 'emotional_shutdown', 'numbing_urge',
  'escape_feeling', 'automatic_use', 'without_thinking', 'cue_response', 'autopilot_relapse', 'preconscious_use',
  'starting_from_zero', 'relapse_reset_belief', 'all_progress_lost', 'streak_broken_shame', 'restart_hopelessness', 'guilt_without_reason',
  'free_floating_guilt', 'suspected_innocence', 'chronic_guilt', 'guilt_for_existing', 'boundary_violation_normalized', 'it_belongs',
  'normalized_harm', 'learned_tolerance_of_harm', 'relationship_as_mirror', 'self_image_through_other', 'reflected_shame', 'externalized_self_worth',
  'relational_self_disgust',
] as const;

/**
 * KIM THEMES — 158 labels covering 96 modules.
 * Derived from module-catalog.ts triggers + advanced module definitions.
 */
export const KIM_THEME_LABELS = [
  'craving', 'substance_urge', 'using_desire', 'emotional_overwhelm', 'cant_handle_feelings', 'falling_apart',
  'relapse_trigger', 'used_again', 'slipped', 'prevention', 'self_hatred', 'worthlessness',
  'shame', 'guilt', 'self_criticism', 'anxiety', 'panic', 'racing_thoughts',
  'grounding', 'purpose', 'motivation', 'goals', 'hope', 'meaning',
  'concentration', 'foggy_mind', 'scattered', 'acceptance', 'struggle_with_control', 'resistance',
  'willpower_blame', 'feeling_weak', 'discipline_failure', 'automatic_trigger', 'conditioned_response', 'habit_loop',
  'loneliness', 'isolation', 'no_connections', 'broken_trust', 'betrayal', 'fear_of_closeness',
  'intimacy_panic', 'pushing_away', 'sleep_problems', 'insomnia', 'nightmares', 'perfectionism',
  'internal_pressure', 'fear_of_failure', 'loss', 'death', 'grief', 'mourning',
  'overwhelm', 'exhaustion', 'burnout', 'explosion', 'childhood_trauma', 'abuse',
  'traumatic_memories', 'shame_from_rejection', 'being_rejected', 'internalized_rejection', 'feeling_unlovable', 'abandonment_fear',
  'invisibility', 'intimacy_as_danger', 'permanent_outsider', 'chronically_misunderstood', 'overcontrol', 'emotional_instability',
  'fear_of_proximity', 'loss_of_control_after_confrontation', 'self_medication', 'responsibility_for_others', 'ambivalent_closeness', 'guilt_after_relapse',
  'autonomous_but_exhausted', 'repetition_of_rejection', 'failure_as_identity', 'sexual_trauma', 'uncontrollable_urge', 'penance_for_existing',
  'repeated_relapse_context', 'craving_from_boredom', 'child_must_be_strong', 'mask_of_happiness', 'symbiosis_with_parent', 'perfection_as_survival',
  'self_hate_at_vulnerability', 'distance_after_closeness', 'expectation_of_failure', 'panic_without_cause', 'fear_of_recognition', 'never_enough',
  'co_regulation_fails', 'societal_rejection', 'isolation_as_safety', 'new_relationships_as_repetition', 'mother_complex', 'identity_confusion_under_pressure',
  'refusal_of_help', 'relationship_equals_regression', 'constant_scanning', 'loss_of_spirituality', 'guilt_asking_for_help', 'no_right_to_exist',
  'fleeing_into_thoughts', 'fear_of_reflection', 'loneliness_to_use', 'existential_void', 'social_expectation_vs_reality', 'masking_relapse',
  'loss_of_control_in_relationship', 'desire_for_numbness', 'automatism_of_use', 'starting_over_again', 'innocence_suspected', 'boundary_violation_as_norm',
  'relationship_as_mirror', 'guilt_forgiveness', 'generational_patterns', 'external_motivation', 'worthiness_of_recovery', 'active_relapse_analysis',
  'deep_ambivalence', 'betrayal_discovery_shock', 'trust_repair', 'gaslighting', 'reality_distortion', 'stoic_reflection',
  'shadow_work', 'sleep_and_recovery', 'psychoeducation', 'support_pillars', 'self_acceptance', 'self_discovery',
  'coexistence_with_pain', 'greeting', 'small_talk', 'general_question', 'parentification_pattern', 'had_to_care_for_parents',
  'no_childhood', 'forced_adult_role', 'child_as_caregiver', 'financial_dependency', 'money_as_control', 'no_financial_autonomy',
  'economic_abuse', 'financial_control', 'ambiguous_loss', 'living_grief', 'missing_who_they_were', 'social_isolation_caregiver',
  'lost_own_contacts', 'caregiving_isolation',
] as const;

export type EliasThemeLabel = typeof ELIAS_THEME_LABELS[number];
export type KimThemeLabel = typeof KIM_THEME_LABELS[number];

// ─── Deterministic Theme → Module Mapping ────────────────────────

/**
 * Maps each Elias theme label to exactly one module ID.
 * 397 labels → 91 modules.
 */
export const ELIAS_THEME_TO_MODULE: Record<string, string> = {
  craving: 'E01', substance_urge: 'E01', using_desire: 'E01',
  emotional_overwhelm: 'E02', cant_handle_feelings: 'E02', falling_apart: 'E02', greeting: 'E02', small_talk: 'E02', general_question: 'E02',
  relapse_trigger: 'E03', used_again: 'E03', slipped: 'E03', prevention: 'E03',
  self_hatred: 'E04', shame: 'E04', guilt: 'E04', self_criticism: 'E04',
  worthlessness: 'M20', internalized_rejection: 'M20', defectiveness_schema: 'M20', not_worth_recovery: 'M20', no_place_in_world: 'M20',
  anxiety: 'E05', panic: 'E05', racing_thoughts: 'E05', grounding: 'E05',
  purpose: 'E06', motivation: 'E06', goals: 'E06', hope: 'E06', meaning: 'E06',
  concentration: 'E07', foggy_mind: 'E07', scattered: 'E07',
  acceptance: 'E08', struggle_with_control: 'E08', resistance: 'E08',
  willpower_blame: 'WILSKRACHT01', feeling_weak: 'WILSKRACHT01', discipline_failure: 'WILSKRACHT01', psychoeducation: 'WILSKRACHT01',
  automatic_trigger: 'AUTOPILOT01', conditioned_response: 'AUTOPILOT01',
  habit_loop: 'M81', automatic_use: 'M81', without_thinking: 'M81', cue_response: 'M81', autopilot_relapse: 'M81', preconscious_use: 'M81',
  guilt_forgiveness: 'VERGV01',
  generational_patterns: 'IGH01',
  external_motivation: 'AGC01',
  worthiness_of_recovery: 'HWK01',
  active_relapse_analysis: 'FALE01',
  betrayal_discovery_shock: 'BEDR01',
  trust_repair: 'VETR01',
  gaslighting: 'GASL01', reality_distortion: 'GASL01',
  stoic_reflection: 'STO01',
  shadow_work: 'SW01',
  sleep_and_recovery: 'SLAAP01',
  support_pillars: 'PAAL01',
  self_acceptance: 'IKST01',
  self_discovery: 'ONTK01',
  coexistence_with_pain: 'COEX01',
  structural_loneliness: 'M05', no_real_connection: 'M05', nobody_would_miss_me: 'M05', social_disconnection: 'M05', existential_isolation: 'M05',
  trust_rupture: 'M06', nobody_can_be_trusted: 'M06', all_bonds_break: 'M06', betrayal_expectation: 'M06', attachment_mistrust: 'M06',
  closeness_panic: 'M07', attachment_alarm: 'M07', intimacy_shutdown: 'M07', proximity_trigger: 'M07', relational_freeze: 'M07',
  sleep_disturbance: 'M08', use_to_sleep: 'M08', night_craving: 'M08', insomnia_risk: 'M08', circadian_disruption: 'M08',
  perfectionism: 'M09', internal_pressure: 'M09', never_enough: 'M09', all_or_nothing_recovery: 'M09', punitive_self_control: 'M09',
  parental_loss: 'M13', unfinished_grief: 'M13', grief_guilt: 'M13', mother_loss: 'M13', father_loss: 'M13', unresolved_bereavement: 'M13',
  overload: 'M16', explosion_risk: 'M16', too_much_at_once: 'M16', acute_pressure: 'M16', overstimulation: 'M16', emotional_overload: 'M16',
  childhood_trauma: 'M17', old_alarm: 'M17', inner_child_activation: 'M17', early_schema_trigger: 'M17', past_present_overlap: 'M17',
  rejection_shame: 'M19', self_disgust: 'M19', abandonment_shame: 'M19', relational_shame: 'M19', identity_attack_after_rejection: 'M19',
  abandonment_fear: 'M21', fear_of_being_left: 'M21', attachment_panic: 'M21', relational_alarm: 'M21', they_always_leave: 'M21',
  invisibility: 'M22', nobody_sees_me: 'M22', unseen_pain: 'M22', emotional_invisibility: 'M22', disappearing_self: 'M22',
  intimacy_as_danger: 'M23', engulfment_fear: 'M23', autonomy_threat: 'M23', closeness_as_control: 'M23', relational_fusion_fear: 'M23',
  permanent_outsider: 'M25', nowhere_belonging: 'M25', outsider_identity: 'M25', not_part_of_anything: 'M25', social_alienation: 'M25',
  chronically_misunderstood: 'M26', not_getting_me: 'M26', invalidation: 'M26', defensive_exhaustion: 'M26', misread_identity: 'M26',
  overcontrol: 'M27', perfectionistic_control: 'M27', rigid_recovery: 'M27', control_as_survival: 'M27', fear_of_losing_control: 'M27',
  emotional_instability: 'M29', rapid_state_shift: 'M29', affective_swing: 'M29', emotional_whiplash: 'M29', unstable_self_state: 'M29',
  fear_of_closeness: 'M30', social_overload: 'M30', too_many_people: 'M30', proximity_overload: 'M30', connection_ambivalence: 'M30',
  confrontation_trigger: 'M33', loss_of_control: 'M33', criticism_reactivity: 'M33', shame_rage: 'M33', explosive_response: 'M33',
  self_medication: 'M34', use_to_calm: 'M34', inner_restlessness: 'M34', sedation_seeking: 'M34', medication_misuse_risk: 'M34',
  overresponsibility: 'M35', carrying_others: 'M35', self_sacrifice: 'M35', responsibility_fusion: 'M35', caregiver_identity_in_dependent: 'M35',
  ambivalent_closeness: 'M40', proximity_ambivalence: 'M40', want_connection_too_much: 'M40', closeness_overload: 'M40', push_pull_contact: 'M40',
  relapse_guilt: 'M41', post_relapse_shame: 'M41', ruined_everything: 'M41', all_or_nothing_after_relapse: 'M41', relapse_identity_fusion: 'M41',
  autonomous_but_exhausted: 'M42', doing_everything_alone: 'M42', help_refusal: 'M42', exhausted_independence: 'M42', isolated_self_reliance: 'M42',
  repeated_rejection: 'M43', never_chosen: 'M43', second_choice_schema: 'M43', rejection_repetition: 'M43', not_chosen_wound: 'M43',
  failure_identity: 'M44', global_failure: 'M44', shame_fusion: 'M44', learned_failure: 'M44', all_or_nothing_failure: 'M44',
  sexual_trauma: 'M45', body_shame: 'M45', feeling_dirty: 'M45', touch_trigger: 'M45', sexual_boundary_violation: 'M45', trauma_body_memory: 'M45',
  uncontrollable_urge: 'M46', impulse_discharge: 'M46', explosive_impulse: 'M46', no_brake: 'M46', act_before_thinking: 'M46', urge_to_act: 'M46',
  existence_shame: 'M47', never_should_have_been_born: 'M47', not_allowed_to_exist: 'M47', suicidal_language_possible: 'M47', burden_identity: 'M47',
  repeated_relapse_context: 'M49', cannot_maintain_recovery: 'M49', relapse_loop: 'M49', context_defeats_plan: 'M49', recurring_trigger_pattern: 'M49',
  boredom_craving: 'M50', emptiness_trigger: 'M50', underarousal: 'M50', nothing_to_feel: 'M50', anhedonia_craving: 'M50', habit_craving: 'M50',
  parentification: 'M51', child_had_to_be_strong: 'M51', early_burden: 'M51', forced_maturity: 'M51', childhood_overresponsibility: 'M51',
  cheerful_mask: 'M52', laughing_but_empty: 'M52', emotional_masking: 'M52', humor_defense: 'M52', affective_flatness: 'M52', social_performance: 'M52',
  parental_symbiosis: 'M53', still_their_child: 'M53', enmeshment: 'M53', parental_guilt: 'M53', adult_child_role: 'M53', differentiation_issue: 'M53',
  perfection_as_survival: 'M54', no_mistakes_allowed: 'M54', fear_of_error: 'M54', punitive_perfectionism: 'M54', mistake_danger: 'M54',
  vulnerability_shame: 'M55', crying_equals_weakness: 'M55', self_attack_after_emotion: 'M55', emotional_exposure_shame: 'M55', shame_after_crying: 'M55',
  distance_after_closeness: 'M56', post_connection_shutdown: 'M56', vulnerability_aftershock: 'M56', intimacy_hangover: 'M56', closeness_then_withdrawal: 'M56',
  expectation_of_failure: 'M57', pessimistic_prediction: 'M57', failure_forecast: 'M57', learned_helplessness: 'M57', preemptive_defeat: 'M57',
  panic_without_trigger: 'M58', body_alarm: 'M58', somatic_panic: 'M58', unexplained_anxiety: 'M58', autonomic_activation: 'M58',
  fear_of_being_seen: 'M59', fear_of_exposure: 'M59', shame_mask: 'M59', imposter_self: 'M59', being_seen_through: 'M59', exposure_panic: 'M59',
  failing_despite_effort: 'M60', effort_without_worth: 'M60', chronic_inadequacy: 'M60', proving_self: 'M60',
  coregulation_failure: 'M61', nobody_calms_me: 'M61', unreachable_state: 'M61', support_does_not_land: 'M61', too_much_for_others: 'M61',
  system_rejection: 'M62', not_fit_system: 'M62', societal_mismatch: 'M62', institutional_shame: 'M62',
  isolation_as_safety: 'M63', protective_withdrawal: 'M63', self_protection_isolation: 'M63', avoidant_retreat: 'M63', unsafe_connection: 'M63',
  relationship_pattern_repetition: 'M64', new_relationship_old_pattern: 'M64', repetition_compulsion: 'M64', relational_trigger: 'M64', pattern_returning: 'M64',
  mother_complex: 'M65', seeking_to_be_carried: 'M65', maternal_longing: 'M65', regressive_dependency: 'M65', unmet_mother_need: 'M65', rescue_attachment: 'M65',
  identity_confusion_under_pressure: 'M66', yelling_trigger: 'M66', self_loss_under_conflict: 'M66', pressure_collapse: 'M66', relational_domination: 'M66',
  leave_me_alone: 'M67', autonomous_defense: 'M67', support_rejection: 'M67', help_shame: 'M67', defensive_independence: 'M67',
  relationship_regression: 'M68', becoming_small: 'M68', child_state_in_relationship: 'M68', adult_position_loss: 'M68', attachment_regression: 'M68',
  hypervigilance: 'M69', constant_scanning: 'M69', never_relaxed: 'M69', threat_monitoring: 'M69', social_scanning: 'M69', body_alarm_monitoring: 'M69',
  spiritual_loss: 'M70', lost_connection: 'M70', meaning_loss: 'M70', existential_disconnection: 'M70', faith_rupture: 'M70', loss_of_belonging_to_life: 'M70',
  help_guilt: 'M71', burden_shame: 'M71', afraid_to_ask_help: 'M71', support_request_block: 'M71', not_want_to_be_burden: 'M71',
  no_right_to_exist: 'M72', redundant_self: 'M72', existence_worthlessness: 'M72', disappearance_fantasy: 'M72',
  cognitive_escape: 'M73', living_in_head: 'M73', overanalysis: 'M73', rumination_as_avoidance: 'M73', intellectualization: 'M73', body_disconnection: 'M73',
  fear_of_reflection: 'M74', self_reflection_avoidance: 'M74', introspection_threat: 'M74', do_not_want_to_look: 'M74', reflection_shutdown: 'M74',
  loneliness_to_use: 'M75', use_to_not_feel_loneliness: 'M75', isolation_craving: 'M75', absence_pain: 'M75', connection_void_relapse: 'M75',
  existential_void: 'M76', is_this_all: 'M76', meaninglessness: 'M76', recovery_emptiness: 'M76', future_void: 'M76', existential_black_hole: 'M76',
  social_masking: 'M77', everyone_thinks_im_fine: 'M77', hidden_distress: 'M77', functional_collapse: 'M77', outside_inside_gap: 'M77',
  masking_relapse: 'M78', pretending_fine: 'M78', hidden_use: 'M78', relapse_secrecy: 'M78', minimization: 'M78', concealed_craving: 'M78',
  relational_control_loss: 'M79', what_is_mine: 'M79', boundary_confusion: 'M79', emotional_fusion: 'M79', relational_enmeshment: 'M79', gaslighting_possible: 'M79',
  wish_for_numbness: 'M80', do_not_want_to_feel: 'M80', sedation_wish: 'M80', emotional_shutdown: 'M80', numbing_urge: 'M80', escape_feeling: 'M80',
  starting_from_zero: 'M82', relapse_reset_belief: 'M82', all_progress_lost: 'M82', streak_broken_shame: 'M82', restart_hopelessness: 'M82',
  guilt_without_reason: 'M83', free_floating_guilt: 'M83', suspected_innocence: 'M83', chronic_guilt: 'M83', guilt_for_existing: 'M83',
  boundary_violation_normalized: 'M84', it_belongs: 'M84', normalized_harm: 'M84', learned_tolerance_of_harm: 'M84',
  relationship_as_mirror: 'M85', self_image_through_other: 'M85', reflected_shame: 'M85', externalized_self_worth: 'M85', relational_self_disgust: 'M85',
};

/**
 * Maps each Kim theme label to exactly one module ID.
 * 158 labels → 96 modules.
 */
export const KIM_THEME_TO_MODULE: Record<string, string> = {
  craving: 'E01', substance_urge: 'E01', using_desire: 'E01',
  emotional_overwhelm: 'E02', cant_handle_feelings: 'E02', falling_apart: 'E02', greeting: 'E02', small_talk: 'E02', general_question: 'E02',
  relapse_trigger: 'E03', used_again: 'E03', slipped: 'E03', prevention: 'E03',
  self_hatred: 'E04', worthlessness: 'E04', shame: 'E04', guilt: 'E04', self_criticism: 'E04',
  anxiety: 'E05', panic: 'E05', racing_thoughts: 'E05', grounding: 'E05',
  purpose: 'E06', motivation: 'E06', goals: 'E06', hope: 'E06', meaning: 'E06',
  concentration: 'E07', foggy_mind: 'E07', scattered: 'E07',
  acceptance: 'E08', struggle_with_control: 'E08', resistance: 'E08',
  willpower_blame: 'WILSKRACHT01', feeling_weak: 'WILSKRACHT01', discipline_failure: 'WILSKRACHT01', psychoeducation: 'WILSKRACHT01',
  automatic_trigger: 'AUTOPILOT01', conditioned_response: 'AUTOPILOT01', habit_loop: 'AUTOPILOT01',
  loneliness: 'M05', isolation: 'M05', no_connections: 'M05',
  broken_trust: 'M06', betrayal: 'M06',
  fear_of_closeness: 'M07', intimacy_panic: 'M07', pushing_away: 'M07',
  sleep_problems: 'M08', insomnia: 'M08', nightmares: 'M08',
  perfectionism: 'M09', internal_pressure: 'M09', fear_of_failure: 'M09',
  loss: 'M13', death: 'M13', grief: 'M13', mourning: 'M13',
  overwhelm: 'M16', exhaustion: 'M16', burnout: 'M16', explosion: 'M16',
  childhood_trauma: 'M17', abuse: 'M17', traumatic_memories: 'M17',
  shame_from_rejection: 'M19', being_rejected: 'M19',
  internalized_rejection: 'M20', feeling_unlovable: 'M20',
  abandonment_fear: 'M21',
  invisibility: 'M22',
  intimacy_as_danger: 'M23',
  permanent_outsider: 'M25',
  chronically_misunderstood: 'M26',
  overcontrol: 'M27',
  emotional_instability: 'M29',
  fear_of_proximity: 'M30',
  loss_of_control_after_confrontation: 'M33',
  self_medication: 'M34',
  responsibility_for_others: 'M35',
  ambivalent_closeness: 'M40',
  guilt_after_relapse: 'M41',
  autonomous_but_exhausted: 'M42',
  repetition_of_rejection: 'M43',
  failure_as_identity: 'M44',
  sexual_trauma: 'M45',
  uncontrollable_urge: 'M46',
  penance_for_existing: 'M47',
  repeated_relapse_context: 'M49',
  craving_from_boredom: 'M50',
  child_must_be_strong: 'M51',
  mask_of_happiness: 'M52',
  symbiosis_with_parent: 'M53',
  perfection_as_survival: 'M54',
  self_hate_at_vulnerability: 'M55',
  distance_after_closeness: 'M56',
  expectation_of_failure: 'M57',
  panic_without_cause: 'M58',
  fear_of_recognition: 'M59',
  never_enough: 'M60',
  co_regulation_fails: 'M61',
  societal_rejection: 'M62',
  isolation_as_safety: 'M63',
  new_relationships_as_repetition: 'M64',
  mother_complex: 'M65',
  identity_confusion_under_pressure: 'M66',
  refusal_of_help: 'M67',
  relationship_equals_regression: 'M68',
  constant_scanning: 'M69',
  loss_of_spirituality: 'M70',
  guilt_asking_for_help: 'M71',
  no_right_to_exist: 'M72',
  fleeing_into_thoughts: 'M73',
  fear_of_reflection: 'M74',
  loneliness_to_use: 'M75',
  existential_void: 'M76',
  social_expectation_vs_reality: 'M77',
  masking_relapse: 'M78',
  loss_of_control_in_relationship: 'M79',
  desire_for_numbness: 'M80',
  automatism_of_use: 'M81',
  starting_over_again: 'M82',
  innocence_suspected: 'M83',
  boundary_violation_as_norm: 'M84',
  relationship_as_mirror: 'M85',
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
  support_pillars: 'PAAL01',
  self_acceptance: 'IKST01',
  self_discovery: 'ONTK01',
  coexistence_with_pain: 'COEX01',
  parentification_pattern: 'PAR01', had_to_care_for_parents: 'PAR01', no_childhood: 'PAR01', forced_adult_role: 'PAR01', child_as_caregiver: 'PAR01',
  financial_dependency: 'FIN01', money_as_control: 'FIN01', no_financial_autonomy: 'FIN01', economic_abuse: 'FIN01', financial_control: 'FIN01',
  ambiguous_loss: 'ROUW-K01', living_grief: 'ROUW-K01', missing_who_they_were: 'ROUW-K01',
  social_isolation_caregiver: 'ISOL-K01', lost_own_contacts: 'ISOL-K01', caregiving_isolation: 'ISOL-K01',
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
1. The Dutch translation (if not already Dutch, return it unchanged if already Dutch)
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
          max_completion_tokens: 300,
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
  throw new Error('[NanoInterpret] Unexpected end of retry loop');
}
