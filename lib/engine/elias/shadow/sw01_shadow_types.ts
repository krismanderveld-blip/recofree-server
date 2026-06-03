/**
 * SW01 Shadow Work — Elias Only
 * Data contracts and type definitions
 *
 * CANON: shadowwork.txt section 19 (Manus Implementation Contract)
 * MODULE_ID: SW01
 * PERSONA: Elias only — never active for Kim
 */

// ─── Shadow Signal ───────────────────────────────────────────────────────────

export type ShadowSource = 'chat' | 'diary' | 'zuchtmeter' | 'trigger_history';
export type RelapseRisk = 'low' | 'medium' | 'high' | 'active';

export interface ShadowSignal {
  id: string;
  source: ShadowSource;
  marker: string;
  confidence: number;
  emotional_layer: string;
  suspected_shadow: string;
  relapse_risk: RelapseRisk;
}

// ─── Shadow Loop ─────────────────────────────────────────────────────────────

export interface ShadowLoop {
  loop_id: string;
  loop_name: string;
  trigger: string;
  hidden_feeling: string;
  shadow_lie: string;
  urge: string;
  likely_behaviour: string;
  elias_intervention: string;
  journal_prompt: string;
}

// ─── Zucht Shadow State ──────────────────────────────────────────────────────

export type ZuchtColor = 'green' | 'yellow' | 'orange' | 'red';
export type AllowedDepth = 'reflection' | 'early_detection' | 'interruption' | 'containment';
export type InterventionStyle = 'warm_direct' | 'sharp_warm' | 'contained_direct';

export interface ZuchtShadowState {
  zucht_value: number;
  zucht_color: ZuchtColor;
  allowed_depth: AllowedDepth;
  intervention_style: InterventionStyle;
}

// ─── Projection Entry ────────────────────────────────────────────────────────

export interface ProjectionEntry {
  person_or_group: string;
  emotional_charge: string;
  external_reality: string;
  inner_shadow_hypothesis: string;
  boundary_required: boolean;
  relapse_link: string;
}

// ─── Journal Entry Shadow ────────────────────────────────────────────────────

export interface JournalEntryShadow {
  date: string;
  trigger: string;
  emotion: string;
  shadow_part: string;
  craving_change: string;
  loop_detected: string;
  chosen_action: string;
  repair_needed: string;
}

// ─── Intervention Mode ───────────────────────────────────────────────────────

export type InterventionMode =
  | 'direct_mirror'
  | 'loop_naming'
  | 'projection_unfolding'
  | 'archetype_map'
  | 'journal_prompt'
  | 'contained_red_state'
  | 'post_relapse_analysis';

// ─── SW01 Engine Result ──────────────────────────────────────────────────────

export interface SW01EngineResult {
  active: boolean;
  confidence: number;
  signals: ShadowSignal[];
  zuchtState: ZuchtShadowState;
  interventionMode: InterventionMode;
  activeLoop: ShadowLoop | null;
  projectionActive: boolean;
  promptBlock: string;
  journalPrompt: string;
}

// ─── SW01 Progress (persisted in user.dat) ───────────────────────────────────

export interface SW01Progress {
  sessionsWithShadowWork: number;
  loopsIdentified: string[];
  archetypesExplored: string[];
  projectionsProcessed: number;
  journalPromptsGiven: number;
  lastActiveLoop: string | null;
  lastInterventionMode: InterventionMode | null;
}

export function createDefaultSW01Progress(): SW01Progress {
  return {
    sessionsWithShadowWork: 0,
    loopsIdentified: [],
    archetypesExplored: [],
    projectionsProcessed: 0,
    journalPromptsGiven: 0,
    lastActiveLoop: null,
    lastInterventionMode: null,
  };
}
