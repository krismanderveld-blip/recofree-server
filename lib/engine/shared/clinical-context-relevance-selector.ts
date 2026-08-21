/**
 * CLINICAL CONTEXT RELEVANCE SELECTOR
 * 
 * Deterministic client-side selector that uses nano themes to determine
 * which schemas/modes are relevant for the current message.
 * 
 * Rules:
 * - Engine decides, GPT formulates.
 * - If user asks directly about schemas/modes → ALL are sent.
 * - Otherwise → only theme-relevant schemas/modes are sent.
 * - If no theme match → send all (safe fallback, no data loss).
 */

// ── THEME → SCHEMA RELEVANCE MAP ──────────────────────────────────────────
// Maps nano themes to relevant schema identifiers.
// A theme can activate multiple schemas. Based on clinical theory:
// - Schema therapy (Young et al.) domain groupings
// - Theme semantics from nano-interpret controlled vocabulary
const THEME_TO_SCHEMAS: Record<string, string[]> = {
  // Abandonment/instability domain
  abandonment_fear: ['abandonment', 'emotional_deprivation', 'mistrust_abuse'],
  they_always_leave: ['abandonment', 'mistrust_abuse'],
  relational_alarm: ['abandonment', 'emotional_deprivation'],
  attachment_alarm: ['abandonment', 'enmeshment'],
  closeness_panic: ['abandonment', 'vulnerability'],
  trust_rupture: ['mistrust_abuse', 'abandonment'],
  betrayal_expectation: ['mistrust_abuse', 'abandonment'],
  
  // Self-control domain
  craving: ['insufficient_self_control'],
  substance_urge: ['insufficient_self_control'],
  uncontrollable_urge: ['insufficient_self_control'],
  impulse_discharge: ['insufficient_self_control'],
  no_brake: ['insufficient_self_control'],
  act_before_thinking: ['insufficient_self_control'],
  habit_loop: ['insufficient_self_control'],
  boredom_craving: ['insufficient_self_control'],
  
  // Shame/defectiveness domain
  self_hatred: ['defectiveness_shame', 'punitiveness'],
  shame: ['defectiveness_shame'],
  guilt: ['defectiveness_shame', 'self_sacrifice'],
  worthlessness: ['defectiveness_shame', 'dependence_incompetence'],
  failure_identity: ['defectiveness_shame', 'unrelenting_standards'],
  existence_shame: ['defectiveness_shame'],
  vulnerability_shame: ['defectiveness_shame', 'emotional_inhibition'],
  
  // Dependence domain
  seeking_to_be_carried: ['dependence_incompetence', 'enmeshment'],
  regressive_dependency: ['dependence_incompetence'],
  help_refusal: ['dependence_incompetence', 'emotional_inhibition'],
  
  // Emotional deprivation domain
  emotional_overwhelm: ['emotional_deprivation', 'vulnerability'],
  invisibility: ['emotional_deprivation', 'defectiveness_shame'],
  nobody_sees_me: ['emotional_deprivation'],
  unseen_pain: ['emotional_deprivation'],
  coregulation_failure: ['emotional_deprivation'],
  
  // Subjugation domain
  overresponsibility: ['subjugation', 'self_sacrifice'],
  carrying_others: ['subjugation', 'self_sacrifice'],
  self_sacrifice: ['self_sacrifice', 'subjugation'],
  responsibility_fusion: ['self_sacrifice', 'enmeshment'],
  
  // Standards domain
  perfection_as_survival: ['unrelenting_standards', 'punitiveness'],
  no_mistakes_allowed: ['unrelenting_standards'],
  overcontrol: ['unrelenting_standards', 'emotional_inhibition'],
  rigid_recovery: ['unrelenting_standards'],
  
  // Vulnerability domain
  anxiety: ['vulnerability'],
  panic: ['vulnerability'],
  panic_without_trigger: ['vulnerability'],
  body_alarm: ['vulnerability'],
  
  // Enmeshment domain
  parental_symbiosis: ['enmeshment', 'dependence_incompetence'],
  enmeshment: ['enmeshment'],
  relational_fusion_fear: ['enmeshment', 'abandonment'],
  
  // Inhibition domain
  emotional_masking: ['emotional_inhibition'],
  cheerful_mask: ['emotional_inhibition'],
  distance_after_closeness: ['emotional_inhibition', 'abandonment'],
  
  // Approval seeking
  approval_seeking: ['approval_seeking'],
  fear_of_being_seen: ['approval_seeking', 'defectiveness_shame'],
  
  // Entitlement
  entitlement: ['entitlement'],
  
  // Negativity
  expectation_of_failure: ['negativity_pessimism'],
  learned_helplessness: ['negativity_pessimism', 'defectiveness_shame'],
  
  // Punitiveness
  self_criticism: ['punitiveness', 'defectiveness_shame'],
  punitive_perfectionism: ['punitiveness', 'unrelenting_standards'],
};

// ── THEME → MODE RELEVANCE MAP ──────────────────────────────────────────
const THEME_TO_MODES: Record<string, string[]> = {
  // Vulnerable child triggers
  emotional_overwhelm: ['vulnerable_child'],
  abandonment_fear: ['vulnerable_child'],
  they_always_leave: ['vulnerable_child'],
  unseen_pain: ['vulnerable_child'],
  invisibility: ['vulnerable_child'],
  nobody_sees_me: ['vulnerable_child'],
  anxiety: ['vulnerable_child'],
  panic: ['vulnerable_child'],
  existence_shame: ['vulnerable_child'],
  seeking_to_be_carried: ['vulnerable_child'],
  
  // Angry child triggers
  confrontation_trigger: ['angry_child'],
  shame_rage: ['angry_child'],
  explosive_response: ['angry_child'],
  criticism_reactivity: ['angry_child'],
  yelling_trigger: ['angry_child'],
  
  // Impulsive child triggers
  craving: ['impulsive_child'],
  substance_urge: ['impulsive_child'],
  uncontrollable_urge: ['impulsive_child'],
  impulse_discharge: ['impulsive_child'],
  no_brake: ['impulsive_child'],
  act_before_thinking: ['impulsive_child'],
  boredom_craving: ['impulsive_child'],
  
  // Compliant surrender triggers
  overresponsibility: ['compliant_surrender'],
  carrying_others: ['compliant_surrender'],
  self_sacrifice: ['compliant_surrender'],
  
  // Detached protector triggers
  distance_after_closeness: ['detached_protector'],
  emotional_masking: ['detached_protector'],
  cheerful_mask: ['detached_protector'],
  closeness_panic: ['detached_protector'],
  protective_withdrawal: ['detached_protector'],
  isolation_as_safety: ['detached_protector'],
  self_medication: ['detached_protector'],
  
  // Overcontroller triggers
  overcontrol: ['overcontroller'],
  perfection_as_survival: ['overcontroller'],
  rigid_recovery: ['overcontroller'],
  no_mistakes_allowed: ['overcontroller'],
  
  // Punitive parent triggers
  self_hatred: ['punitive_parent'],
  self_criticism: ['punitive_parent'],
  punitive_perfectionism: ['punitive_parent'],
  
  // Demanding parent triggers
  unrelenting_standards: ['demanding_parent'],
  fear_of_error: ['demanding_parent'],
  
  // Healthy adult triggers
  purpose: ['healthy_adult'],
  motivation: ['healthy_adult'],
  goals: ['healthy_adult'],
  hope: ['healthy_adult'],
  self_acceptance: ['healthy_adult'],
  acceptance: ['healthy_adult'],
};

// ── DIRECT QUESTION DETECTION ──────────────────────────────────────────
// Keywords that indicate the user is asking about their schemas/modes directly
const DIRECT_SCHEMA_MODE_KEYWORDS = [
  'schema', 'schemas', 'modus', 'modi', 'mode', 'modes',
  'mijn schema', 'mijn modi', 'mijn modus', 'welke schema',
  'welke modi', 'wat zijn mijn', 'my schemas', 'my modes',
  'self_discovery', 'psychoeducation',
];

export interface RelevanceSelection {
  /** Which schemas are relevant for this message */
  relevantSchemas: string[] | 'all';
  /** Which modes are relevant for this message */
  relevantModes: string[] | 'all';
  /** Why this selection was made */
  reason: 'direct_question_all' | 'theme_matched' | 'no_match_send_all' | 'informational_all';
  /** Matched themes that drove the selection */
  matchedThemes: string[];
}

/**
 * Determine which schemas/modes are relevant based on nano themes and user intent.
 * 
 * Rules:
 * 1. Direct question about schemas/modes → ALL
 * 2. Intent=informational + self_discovery theme → ALL
 * 3. Theme match found → only matched schemas/modes
 * 4. No theme match → ALL (safe fallback)
 */
export function selectRelevantClinicalContext(
  nanoThemes: string[],
  nanoIntent: string | undefined,
  userMessage: string,
): RelevanceSelection {
  const msgLower = userMessage.toLowerCase();
  
  // 1. Direct question detection
  const isDirectQuestion = DIRECT_SCHEMA_MODE_KEYWORDS.some(kw => msgLower.includes(kw));
  if (isDirectQuestion) {
    return { relevantSchemas: 'all', relevantModes: 'all', reason: 'direct_question_all', matchedThemes: [] };
  }
  
  // 2. Informational intent + self_discovery
  if (nanoIntent === 'informational' && nanoThemes.includes('self_discovery')) {
    return { relevantSchemas: 'all', relevantModes: 'all', reason: 'informational_all', matchedThemes: ['self_discovery'] };
  }
  
  // 3. Theme-based selection
  const matchedSchemas = new Set<string>();
  const matchedModes = new Set<string>();
  const matchedThemes: string[] = [];
  
  for (const theme of nanoThemes) {
    if (THEME_TO_SCHEMAS[theme]) {
      THEME_TO_SCHEMAS[theme].forEach(s => matchedSchemas.add(s));
      matchedThemes.push(theme);
    }
    if (THEME_TO_MODES[theme]) {
      THEME_TO_MODES[theme].forEach(m => matchedModes.add(m));
      if (!matchedThemes.includes(theme)) matchedThemes.push(theme);
    }
  }
  
  // If we found relevant schemas/modes, return only those
  if (matchedSchemas.size > 0 || matchedModes.size > 0) {
    return {
      relevantSchemas: matchedSchemas.size > 0 ? Array.from(matchedSchemas) : 'all',
      relevantModes: matchedModes.size > 0 ? Array.from(matchedModes) : 'all',
      reason: 'theme_matched',
      matchedThemes,
    };
  }
  
  // 4. No match → send all (safe fallback, never lose data)
  return { relevantSchemas: 'all', relevantModes: 'all', reason: 'no_match_send_all', matchedThemes: [] };
}
