/**
 * Dutch (NL) markers for Kim Relapse Cluster modules.
 * All markers detect caregiver perspective about loved one's relapse/use.
 */
import type { KimRelapseClusterModuleId, KimRelapseMarkerType } from './kimRelapseCluster.types';

export interface MarkerDefinition {
  pattern: RegExp;
  moduleCandidate: KimRelapseClusterModuleId;
  markerType: KimRelapseMarkerType;
  markerId: string;
  confidence: number;
}

// ============================================================
// HERV-K01: Active relapse / active use NOW
// ============================================================
const HERV_NL_MARKERS: MarkerDefinition[] = [
  // Active drinking/use
  { pattern: /\b(hij|zij|ze)\s+(heeft|heef)\s+(weer|opnieuw)\s+gedronken\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'nl_herv_weer_gedronken', confidence: 0.9 },
  { pattern: /\b(hij|zij|ze)\s+is\s+aan\s+het\s+(drinken|gebruiken)\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'nl_herv_aan_het_drinken', confidence: 0.9 },
  { pattern: /\b(hij|zij|ze)\s+gebruikt\s+weer\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'nl_herv_gebruikt_weer', confidence: 0.9 },
  { pattern: /\b(hij|zij|ze)\s+is\s+(dronken|high|stoned|onder\s+invloed)\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'nl_herv_is_dronken', confidence: 0.85 },
  { pattern: /\b(hij|zij|ze)\s+is\s+weer\s+bezig\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'nl_herv_weer_bezig', confidence: 0.8 },
  // Going to get substances
  { pattern: /\b(hij|zij|ze)\s+is\s+(naar\s+de\s+winkel|drugs?\s+gaan\s+halen|drank\s+gaan\s+halen)\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'nl_herv_gaan_halen', confidence: 0.85 },
  // Imminent use
  { pattern: /\b(hij|zij|ze)\s+wil\s+(weer\s+)?(gebruiken|drinken|roken|blowen)\b/i, moduleCandidate: 'HERV-K01', markerType: 'imminent_use', markerId: 'nl_herv_wil_gebruiken', confidence: 0.85 },
  { pattern: /\b(hij|zij|ze)\s+(gaat|ga)\s+(weer\s+)?(gebruiken|drinken|roken|blowen)\b/i, moduleCandidate: 'HERV-K01', markerType: 'imminent_use', markerId: 'nl_herv_gaat_gebruiken', confidence: 0.85 },
  { pattern: /\b(hij|zij)\s+zegt\s+dat\s+(hij|zij)\s+wil\s+(gebruiken|drinken)\b/i, moduleCandidate: 'HERV-K01', markerType: 'imminent_use', markerId: 'nl_herv_zegt_wil_gebruiken', confidence: 0.9 },
  // Rescue/control pressure
  { pattern: /\bik\s+wil\s+(hem|haar)\s+tegenhouden\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'nl_herv_tegenhouden', confidence: 0.8 },
  { pattern: /\bik\s+moet\s+(hem|haar)\s+(stoppen|redden)\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'nl_herv_moet_stoppen', confidence: 0.8 },
  { pattern: /\bmoet\s+ik\s+(hem|haar)\s+gaan\s+zoeken\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'nl_herv_gaan_zoeken', confidence: 0.75 },
  { pattern: /\bmoet\s+ik\s+(de\s+drank|zijn\s+geld|haar\s+geld)\s+afpakken\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'nl_herv_afpakken', confidence: 0.75 },
];

// ============================================================
// NAHERV-K01: Post-relapse aftermath
// ============================================================
const NAHERV_NL_MARKERS: MarkerDefinition[] = [
  { pattern: /\b(hij|zij|ze)\s+(heeft|heef)\s+gisteren\s+gedronken\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'nl_naherv_gisteren_gedronken', confidence: 0.85 },
  { pattern: /\b(hij|zij|ze)\s+is\s+hervallen\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'nl_naherv_hervallen', confidence: 0.9 },
  { pattern: /\bna\s+(zijn|haar)\s+herval\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'nl_naherv_na_herval', confidence: 0.9 },
  { pattern: /\bwat\s+moet\s+ik\s+nu\s+zeggen\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'nl_naherv_wat_zeggen', confidence: 0.75 },
  { pattern: /\bhoe\s+praat\s+ik\s+hierover\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'nl_naherv_hoe_praten', confidence: 0.75 },
  { pattern: /\bhoe\s+begin\s+ik\s+het\s+gesprek\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'nl_naherv_begin_gesprek', confidence: 0.75 },
  { pattern: /\bik\s+ben\s+(zo\s+)?teleurgesteld\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'nl_naherv_teleurgesteld', confidence: 0.7 },
  { pattern: /\bik\s+ben\s+uitgeput\s+na\s+(zijn|haar)\s+herval\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'nl_naherv_uitgeput', confidence: 0.8 },
  { pattern: /\bik\s+wil\s+(hem|haar)\s+niet\s+veroordelen\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'nl_naherv_niet_veroordelen', confidence: 0.75 },
  { pattern: /\bik\s+ben\s+weer\s+hoop\s+kwijt\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'nl_naherv_hoop_kwijt', confidence: 0.75 },
  { pattern: /\bik\s+durf\s+niet\s+opnieuw\s+hopen\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'nl_naherv_durf_niet_hopen', confidence: 0.75 },
  { pattern: /\bik\s+wil\s+grenzen\s+stellen\s+na\s+(dit|zijn|haar)\s+herval\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'nl_naherv_grenzen_na_herval', confidence: 0.8 },
  { pattern: /\bik\s+wil\s+niet\s+doen\s+alsof\s+er\s+niets\s+gebeurd\s+is\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'nl_naherv_niet_alsof', confidence: 0.75 },
  { pattern: /\bmoet\s+ik\s+(hem|haar)\s+vergeven\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'nl_naherv_vergeven', confidence: 0.75 },
  { pattern: /\bik\s+weet\s+niet\s+hoe\s+ik\s+verder\s+moet\s+na\s+(dit|zijn|haar)\s+herval\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'nl_naherv_hoe_verder', confidence: 0.8 },
];

// ============================================================
// CRISIS-K01: Acute caregiver crisis
// ============================================================
const CRISIS_NL_MARKERS: MarkerDefinition[] = [
  // Overwhelm / panic
  { pattern: /\bik\s+weet\s+niet\s+wat\s+ik\s+moet\s+doen\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'nl_crisis_weet_niet', confidence: 0.8 },
  { pattern: /\bwat\s+moet\s+ik\s+doen\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'nl_crisis_wat_doen', confidence: 0.7 },
  { pattern: /\bhelp\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'nl_crisis_help', confidence: 0.6 },
  { pattern: /\bik\s+(panikeer|ben\s+in\s+paniek)\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'nl_crisis_paniek', confidence: 0.85 },
  { pattern: /\bik\s+kan\s+niet\s+meer\s+nadenken\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'nl_crisis_niet_nadenken', confidence: 0.8 },
  { pattern: /\bik\s+ben\s+bang\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'nl_crisis_bang', confidence: 0.7 },
  // Safety
  { pattern: /\bik\s+ben\s+niet\s+veilig\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'nl_crisis_niet_veilig', confidence: 0.95 },
  { pattern: /\bde\s+kinderen\s+zijn\s+niet\s+veilig\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'nl_crisis_kinderen_niet_veilig', confidence: 0.95 },
  // Violence
  { pattern: /\b(hij|zij|ze)\s+dreigt\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'violence', markerId: 'nl_crisis_dreigt', confidence: 0.85 },
  { pattern: /\b(hij|zij|ze)\s+is\s+agressief\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'violence', markerId: 'nl_crisis_agressief', confidence: 0.9 },
  { pattern: /\b(hij|zij|ze)\s+slaat\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'violence', markerId: 'nl_crisis_slaat', confidence: 0.95 },
  // Disappearance
  { pattern: /\b(hij|zij|ze)\s+is\s+verdwenen\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'disappearance', markerId: 'nl_crisis_verdwenen', confidence: 0.85 },
  { pattern: /\bik\s+weet\s+niet\s+waar\s+(hij|zij)\s+is\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'disappearance', markerId: 'nl_crisis_weet_niet_waar', confidence: 0.8 },
  { pattern: /\b(hij|zij|ze)\s+neemt\s+niet\s+op\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'disappearance', markerId: 'nl_crisis_neemt_niet_op', confidence: 0.7 },
  // Suicide / self-harm
  { pattern: /\b(hij|zij|ze)\s+wil\s+zichzelf\s+iets\s+aandoen\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'suicide_self_harm', markerId: 'nl_crisis_zichzelf_aandoen', confidence: 0.95 },
  { pattern: /\b(hij|zij|ze)\s+wil\s+dood\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'suicide_self_harm', markerId: 'nl_crisis_wil_dood', confidence: 0.95 },
  { pattern: /\b(hij|zij|ze)\s+praat\s+over\s+zelfmoord\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'suicide_self_harm', markerId: 'nl_crisis_zelfmoord', confidence: 0.95 },
  // Medical emergency
  { pattern: /\b(hij|zij|ze)\s+heeft\s+pillen\s+genomen\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'medical_emergency', markerId: 'nl_crisis_pillen', confidence: 0.95 },
  { pattern: /\b(hij|zij|ze)\s+ademt\s+raar\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'medical_emergency', markerId: 'nl_crisis_ademt_raar', confidence: 0.9 },
  { pattern: /\b(hij|zij|ze)\s+is\s+bewusteloos\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'medical_emergency', markerId: 'nl_crisis_bewusteloos', confidence: 0.95 },
  // Impaired driving
  { pattern: /\b(hij|zij|ze)\s+rijdt\s+dronken\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'nl_crisis_rijdt_dronken', confidence: 0.9 },
  { pattern: /\b(hij|zij|ze)\s+is\s+dronken\s+met\s+de\s+auto\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'nl_crisis_dronken_auto', confidence: 0.9 },
];

export const NL_MARKERS: MarkerDefinition[] = [
  ...CRISIS_NL_MARKERS,
  ...HERV_NL_MARKERS,
  ...NAHERV_NL_MARKERS,
];
