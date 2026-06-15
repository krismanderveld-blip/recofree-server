/**
 * French (FR) markers for Kim Relapse Cluster modules.
 * All markers detect caregiver perspective about loved one's relapse/use.
 */
import type { KimRelapseClusterModuleId, KimRelapseMarkerType } from './kimRelapseCluster.types';
import type { MarkerDefinition } from './kimRelapseClusterMarkers.nl';

// ============================================================
// HERV-K01: Active relapse / active use NOW
// ============================================================
const HERV_FR_MARKERS: MarkerDefinition[] = [
  { pattern: /\b(il|elle)\s+a\s+encore\s+bu\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'fr_herv_encore_bu', confidence: 0.9 },
  { pattern: /\b(il|elle)\s+est\s+en\s+train\s+de\s+(boire|consommer)\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'fr_herv_en_train', confidence: 0.9 },
  { pattern: /\b(il|elle)\s+consomme\s+encore\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'fr_herv_consomme_encore', confidence: 0.9 },
  { pattern: /\b(il|elle)\s+est\s+(ivre|bourr[eé]e?|sous\s+influence)(?:\b|\s|$|,)/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'fr_herv_est_ivre', confidence: 0.85 },
  { pattern: /\b(il|elle)\s+est\s+parti[e]?\s+(acheter|chercher)\s+(de\s+l'alcool|de\s+la\s+drogue)\b/i, moduleCandidate: 'HERV-K01', markerType: 'active_use', markerId: 'fr_herv_parti_acheter', confidence: 0.85 },
  // Imminent use
  { pattern: /\b(il|elle)\s+veut\s+(consommer|boire|fumer)\b/i, moduleCandidate: 'HERV-K01', markerType: 'imminent_use', markerId: 'fr_herv_veut_consommer', confidence: 0.85 },
  { pattern: /\b(il|elle)\s+va\s+(consommer|boire|fumer)\b/i, moduleCandidate: 'HERV-K01', markerType: 'imminent_use', markerId: 'fr_herv_va_consommer', confidence: 0.85 },
  // Rescue/control
  { pattern: /\bje\s+(veux|dois)\s+l'arr[eê]ter\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'fr_herv_arreter', confidence: 0.8 },
  { pattern: /\bje\s+dois\s+l[ea]\s+sauver\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'fr_herv_sauver', confidence: 0.8 },
  { pattern: /\best-ce\s+que\s+je\s+dois\s+aller\s+l[ea]\s+chercher\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'fr_herv_aller_chercher', confidence: 0.75 },
  { pattern: /\best-ce\s+que\s+je\s+dois\s+lui\s+prendre\s+(l'alcool|son\s+argent)\b/i, moduleCandidate: 'HERV-K01', markerType: 'boundary_rescue_pressure', markerId: 'fr_herv_prendre', confidence: 0.75 },
];

// ============================================================
// NAHERV-K01: Post-relapse aftermath
// ============================================================
const NAHERV_FR_MARKERS: MarkerDefinition[] = [
  { pattern: /\b(il|elle)\s+a\s+rechut[eé](?:\b|\s|$|,)/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'fr_naherv_rechute', confidence: 0.9 },
  { pattern: /\b(il|elle)\s+a\s+bu\s+hier\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'fr_naherv_bu_hier', confidence: 0.85 },
  { pattern: /\bapr[eè]s\s+sa\s+rechute\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'fr_naherv_apres_rechute', confidence: 0.9 },
  { pattern: /\bqu'est-ce\s+que\s+je\s+dois\s+dire\s+maintenant\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'fr_naherv_que_dire', confidence: 0.75 },
  { pattern: /\bcomment\s+parler\s+de\s+[cç]a\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'fr_naherv_comment_parler', confidence: 0.75 },
  { pattern: /\bcomment\s+commencer\s+la\s+conversation\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'fr_naherv_commencer', confidence: 0.75 },
  { pattern: /\bje\s+suis\s+tellement\s+d[eé][cç]u[e]?(?:\b|\s|$|,)/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'fr_naherv_decu', confidence: 0.7 },
  { pattern: /\bje\s+suis\s+[eé]puis[eé][e]?\s+apr[eè]s\s+sa\s+rechute(?:\b|\s|$|,)/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'fr_naherv_epuise', confidence: 0.8 },
  { pattern: /\bje\s+ne\s+veux\s+pas\s+l[ea]\s+juger\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'fr_naherv_pas_juger', confidence: 0.75 },
  { pattern: /\bj'ai\s+encore\s+perdu\s+espoir\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'fr_naherv_perdu_espoir', confidence: 0.75 },
  { pattern: /\bj'ai\s+peur\s+d'esp[eé]rer\s+[àa]\s+nouveau(?:\b|\s|$|,)/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'fr_naherv_peur_esperer', confidence: 0.75 },
  { pattern: /\bje\s+veux\s+poser\s+des\s+limites\s+apr[eè]s\s+cette\s+rechute\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'fr_naherv_limites', confidence: 0.8 },
  { pattern: /\bje\s+ne\s+veux\s+pas\s+faire\s+comme\s+si\s+rien\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'fr_naherv_pas_rien', confidence: 0.75 },
  { pattern: /\best-ce\s+que\s+je\s+dois\s+lui\s+pardonner\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'aftercare_conversation', markerId: 'fr_naherv_pardonner', confidence: 0.75 },
  { pattern: /\bje\s+ne\s+sais\s+pas\s+comment\s+continuer\s+apr[eè]s\s+cette\s+rechute\b/i, moduleCandidate: 'NAHERV-K01', markerType: 'post_relapse', markerId: 'fr_naherv_continuer', confidence: 0.8 },
];

// ============================================================
// CRISIS-K01: Acute caregiver crisis
// ============================================================
const CRISIS_FR_MARKERS: MarkerDefinition[] = [
  { pattern: /\bje\s+ne\s+sais\s+pas\s+quoi\s+faire\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'fr_crisis_pas_quoi_faire', confidence: 0.8 },
  { pattern: /\bqu'est-ce\s+que\s+je\s+dois\s+faire\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'fr_crisis_que_faire', confidence: 0.7 },
  { pattern: /\baidez-moi\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'fr_crisis_aidez', confidence: 0.6 },
  { pattern: /\bje\s+panique\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'fr_crisis_panique', confidence: 0.85 },
  { pattern: /\bje\s+n'arrive\s+plus\s+[aà]\s+penser\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'fr_crisis_plus_penser', confidence: 0.8 },
  { pattern: /\bj'ai\s+peur\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'caregiver_overwhelm', markerId: 'fr_crisis_peur', confidence: 0.7 },
  // Safety
  { pattern: /\bje\s+ne\s+suis\s+pas\s+en\s+s[eé]curit[eé](?:\b|\s|$|,)/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'fr_crisis_pas_securite', confidence: 0.95 },
  { pattern: /\bles\s+enfants\s+ne\s+sont\s+pas\s+en\s+s[eé]curit[eé](?:\b|\s|$|,)/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'fr_crisis_enfants', confidence: 0.95 },
  // Violence
  { pattern: /\b(il|elle)\s+menace\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'violence', markerId: 'fr_crisis_menace', confidence: 0.85 },
  { pattern: /\b(il|elle)\s+est\s+agressi(f|ve)\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'violence', markerId: 'fr_crisis_agressif', confidence: 0.9 },
  { pattern: /\b(il|elle)\s+m'a\s+frapp[eé](?:\b|\s|$|,)/i, moduleCandidate: 'CRISIS-K01', markerType: 'violence', markerId: 'fr_crisis_frappe', confidence: 0.95 },
  // Disappearance
  { pattern: /\b(il|elle)\s+a\s+disparu\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'disappearance', markerId: 'fr_crisis_disparu', confidence: 0.85 },
  { pattern: /\bje\s+ne\s+sais\s+pas\s+o[uù]\s+(il|elle)\s+est\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'disappearance', markerId: 'fr_crisis_ou_est', confidence: 0.8 },
  { pattern: /\b(il|elle)\s+ne\s+r[eé]pond\s+pas(?:\b|\s|$|,)/i, moduleCandidate: 'CRISIS-K01', markerType: 'disappearance', markerId: 'fr_crisis_repond_pas', confidence: 0.7 },
  // Suicide / self-harm
  { pattern: /\b(il|elle)\s+veut\s+se\s+faire\s+du\s+mal\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'suicide_self_harm', markerId: 'fr_crisis_faire_mal', confidence: 0.95 },
  { pattern: /\b(il|elle)\s+veut\s+mourir\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'suicide_self_harm', markerId: 'fr_crisis_veut_mourir', confidence: 0.95 },
  { pattern: /\b(il|elle)\s+parle\s+de\s+suicide\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'suicide_self_harm', markerId: 'fr_crisis_parle_suicide', confidence: 0.95 },
  // Medical emergency
  { pattern: /\b(il|elle)\s+a\s+pris\s+des\s+m[eé]dicaments(?:\b|\s|$|,)/i, moduleCandidate: 'CRISIS-K01', markerType: 'medical_emergency', markerId: 'fr_crisis_medicaments', confidence: 0.95 },
  { pattern: /\b(il|elle)\s+respire\s+bizarrement\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'medical_emergency', markerId: 'fr_crisis_respire', confidence: 0.9 },
  { pattern: /\b(il|elle)\s+est\s+inconscient[e]?\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'medical_emergency', markerId: 'fr_crisis_inconscient', confidence: 0.95 },
  // Impaired driving
  { pattern: /\b(il|elle)\s+conduit\s+ivre\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'fr_crisis_conduit_ivre', confidence: 0.9 },
  { pattern: /\b(il|elle)\s+est\s+ivre\s+en\s+voiture\b/i, moduleCandidate: 'CRISIS-K01', markerType: 'acute_danger', markerId: 'fr_crisis_ivre_voiture', confidence: 0.9 },
];

export const FR_MARKERS: MarkerDefinition[] = [
  ...CRISIS_FR_MARKERS,
  ...HERV_FR_MARKERS,
  ...NAHERV_FR_MARKERS,
];
