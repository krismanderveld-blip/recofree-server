/**
 * English (EN) markers for Kim Relapse Cluster modules.
 * All markers detect caregiver perspective about loved one's relapse/use.
 */
import type { KimRelapseClusterModuleId, KimRelapseMarkerType } from './kimRelapseCluster.types';
import type { MarkerDefinition } from './kimRelapseClusterMarkers.nl';

// ============================================================
// HERV-K01: Active relapse / active use NOW
// ============================================================
const HERV_EN_MARKERS: MarkerDefinition[] = [
  { pattern: /\b(he|she)\s+(drank|has\s+been\s+drinking)\s+again\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'en_herv_drank_again', confidence: 0.9 },
  { pattern: /\b(he|she)\s+is\s+(drinking|using)\s*(again|right\s+now)?\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'en_herv_is_drinking', confidence: 0.9 },
  { pattern: /\b(he|she)\s+is\s+using\s+again\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'en_herv_using_again', confidence: 0.9 },
  { pattern: /\b(he|she)\s+is\s+(drunk|high|intoxicated|wasted)\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'en_herv_is_drunk', confidence: 0.85 },
  { pattern: /\b(he|she)\s+went\s+to\s+(buy|get)\s+(alcohol|drugs|drink)\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'en_herv_went_to_buy', confidence: 0.85 },
  // Imminent use
  { pattern: /\b(he|she)\s+wants?\s+to\s+(use|drink|smoke|get\s+high)\b/i, moduleCandidate: 'HERV-K01', markerType: 'imminent_use', markerId: 'en_herv_wants_to_use', confidence: 0.85 },
  { pattern: /\b(he|she)\s+is\s+going\s+to\s+(use|drink|smoke)\b/i, moduleCandidate: 'HERV-K01', markerType: 'imminent_use', markerId: 'en_herv_going_to_use', confidence: 0.85 },
  { pattern: /\b(he|she)\s+said\s+(he|she)\s+wants?\s+to\s+(use|drink)\b/i, moduleCandidate: 'HERV-K01', markerType: 'imminent_use', markerId: 'en_herv_said_wants', confidence: 0.9 },
  // Rescue/control pressure
  { pattern: /\bI\s+(want|need)\s+to\s+stop\s+(him|her)\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'en_herv_stop_them', confidence: 0.8 },
  { pattern: /\bI\s+need\s+to\s+save\s+(him|her)\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'en_herv_save_them', confidence: 0.8 },
  { pattern: /\bshould\s+I\s+go\s+look\s+for\s+(him|her)\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'en_herv_go_look', confidence: 0.75 },
  { pattern: /\bshould\s+I\s+take\s+(the\s+alcohol|his\s+money|her\s+money)\s+away\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'en_herv_take_away', confidence: 0.75 },
];

// ============================================================
// NAHERV-K01: Post-relapse aftermath
// ============================================================
const NAHERV_EN_MARKERS: MarkerDefinition[] = [
  { pattern: /\b(he|she)\s+relapsed\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'en_naherv_relapsed', confidence: 0.9 },
  { pattern: /\b(he|she)\s+drank\s+yesterday\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'en_naherv_drank_yesterday', confidence: 0.85 },
  { pattern: /\bafter\s+(his|her)\s+relapse\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'en_naherv_after_relapse', confidence: 0.9 },
  { pattern: /\bwhat\s+should\s+I\s+say\s+now\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'en_naherv_what_say', confidence: 0.75 },
  { pattern: /\bhow\s+do\s+I\s+talk\s+about\s+this\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'en_naherv_how_talk', confidence: 0.75 },
  { pattern: /\bhow\s+do\s+I\s+start\s+the\s+conversation\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'en_naherv_start_conversation', confidence: 0.75 },
  { pattern: /\bI\s+am\s+(so\s+)?disappointed\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'en_naherv_disappointed', confidence: 0.7 },
  { pattern: /\bI\s+am\s+exhausted\s+after\s+(his|her)\s+relapse\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'en_naherv_exhausted', confidence: 0.8 },
  { pattern: /\bI\s+do\s+not\s+want\s+to\s+judge\s+(him|her)\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'en_naherv_not_judge', confidence: 0.75 },
  { pattern: /\bI\s+lost\s+hope\s+again\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'en_naherv_lost_hope', confidence: 0.75 },
  { pattern: /\bI\s+am\s+afraid\s+to\s+hope\s+again\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'en_naherv_afraid_hope', confidence: 0.75 },
  { pattern: /\bI\s+want\s+to\s+set\s+boundaries\s+after\s+this\s+relapse\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'en_naherv_boundaries', confidence: 0.8 },
  { pattern: /\bI\s+do\s+not\s+want\s+to\s+pretend\s+nothing\s+happened\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'en_naherv_not_pretend', confidence: 0.75 },
  { pattern: /\bshould\s+I\s+forgive\s+(him|her)\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'en_naherv_forgive', confidence: 0.75 },
  { pattern: /\bI\s+do\s+not\s+know\s+how\s+to\s+move\s+forward\s+after\s+this\s+relapse\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'en_naherv_move_forward', confidence: 0.8 },
];

// ============================================================
// CRISIS-K01: Acute caregiver crisis
// ============================================================
const CRISIS_EN_MARKERS: MarkerDefinition[] = [
  { pattern: /\bI\s+do\s+not\s+know\s+what\s+to\s+do\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'en_crisis_dont_know', confidence: 0.8 },
  { pattern: /\bwhat\s+should\s+I\s+do\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'en_crisis_what_do', confidence: 0.7 },
  { pattern: /\bhelp\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'en_crisis_help', confidence: 0.6 },
  { pattern: /\bI\s+am\s+(panicking|in\s+panic)\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'en_crisis_panic', confidence: 0.85 },
  { pattern: /\bI\s+cannot\s+think\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'en_crisis_cannot_think', confidence: 0.8 },
  { pattern: /\bI\s+am\s+scared\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'en_crisis_scared', confidence: 0.7 },
  // Safety
  { pattern: /\bI\s+am\s+not\s+safe\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'en_crisis_not_safe', confidence: 0.95 },
  { pattern: /\bthe\s+children\s+are\s+not\s+safe\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'en_crisis_children_not_safe', confidence: 0.95 },
  // Violence
  { pattern: /\b(he|she)\s+is\s+threatening\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'violence', markerId: 'en_crisis_threatening', confidence: 0.85 },
  { pattern: /\b(he|she)\s+is\s+aggressive\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'violence', markerId: 'en_crisis_aggressive', confidence: 0.9 },
  { pattern: /\b(he|she)\s+hit\s+me\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'violence', markerId: 'en_crisis_hit_me', confidence: 0.95 },
  // Disappearance
  { pattern: /\b(he|she)\s+disappeared\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'disappearance', markerId: 'en_crisis_disappeared', confidence: 0.85 },
  { pattern: /\bI\s+do\s+not\s+know\s+where\s+(he|she)\s+is\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'disappearance', markerId: 'en_crisis_dont_know_where', confidence: 0.8 },
  { pattern: /\b(he|she)\s+is\s+not\s+answering\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'disappearance', markerId: 'en_crisis_not_answering', confidence: 0.7 },
  // Suicide / self-harm
  { pattern: /\b(he|she)\s+wants?\s+to\s+hurt\s+(himself|herself)\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'suicide_self_harm', markerId: 'en_crisis_hurt_self', confidence: 0.95 },
  { pattern: /\b(he|she)\s+wants?\s+to\s+die\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'suicide_self_harm', markerId: 'en_crisis_wants_die', confidence: 0.95 },
  { pattern: /\b(he|she)\s+is\s+talking\s+about\s+suicide\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'suicide_self_harm', markerId: 'en_crisis_suicide', confidence: 0.95 },
  // Medical emergency
  { pattern: /\b(he|she)\s+took\s+pills\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'medical_emergency', markerId: 'en_crisis_took_pills', confidence: 0.95 },
  { pattern: /\b(he|she)\s+is\s+breathing\s+strangely\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'medical_emergency', markerId: 'en_crisis_breathing', confidence: 0.9 },
  { pattern: /\b(he|she)\s+is\s+unconscious\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'medical_emergency', markerId: 'en_crisis_unconscious', confidence: 0.95 },
  // Impaired driving
  { pattern: /\b(he|she)\s+is\s+driving\s+drunk\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'en_crisis_driving_drunk', confidence: 0.9 },
  { pattern: /\b(he|she)\s+is\s+drunk\s+in\s+the\s+car\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'en_crisis_drunk_car', confidence: 0.9 },
];

export const EN_MARKERS: MarkerDefinition[] = [
  ...CRISIS_EN_MARKERS,
  ...HERV_EN_MARKERS,
  ...NAHERV_EN_MARKERS,
];
