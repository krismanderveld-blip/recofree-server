/**
 * Steunpilaren Output Safety Filter
 * Enforces forbidden output rules for PAAL01.
 * Aligned with PAAL01 spec V1.
 */

import type { RecoFreePersona, Paal01InterventionType } from "@/src/types/eliasSteunpilaren.types";

const REJECT_PATTERNS_PAAL01: string[] = [
  // Scoring / gamification
  "score",
  "punten",
  "level",
  "badge",
  "streak",
  "ranking",
  "je scoort slecht",
  "je score is",
  // Draagkracht/draaglast judgment
  "je draagkracht is te laag",
  "je draaglast is te hoog",
  "je balans is negatief",
  "negatieve balans",
  "positieve balans",
  // Relapse prediction
  "je gaat hervallen",
  "dit voorspelt herval",
  "dit voorspelt",
  "dit betekent dat je gaat hervallen",
  "als je genoeg steunpilaren hebt herval je niet",
  "zonder steunpilaren ga je terugvallen",
  // Diagnosis / pathologizing
  "diagnose",
  "symptoom van",
  "symptoom",
  // Isolation confirmation
  "je hebt geen steun",
  "je bent alleen",
  "je hebt onvoldoende steun",
  "je hebt te weinig steunpilaren",
  "je netwerk is te klein",
  // Prescriptive / demanding
  "je moet meer mensen hebben",
  "je moet dit invullen",
  "je moet dit elke dag doen om punten te halen",
  "je moet gewoon positief denken",
  "je moet dankbaar zijn",
  "zonder dit werkt herstel niet",
  // Failure language
  "je faalt",
  // Storage disclosure
  "ik heb opgeslagen",
  "in user.dat",
  "in projections.dat",
  "in logs.dat",
  "opgeslagen in logs.dat",
  "de engine weet",
  // Crisis protocol weakening
  "crisisprotocol hoeft niet",
  // Mood slider de-prioritization
  "mood sliders zijn minder belangrijk",
  // Persona violation
  "kim",
];

const FALLBACK_PAAL01 =
  "Ik maak hier geen score van. We kijken alleen naar twee kanten: wat trekt er aan jou, en wat houdt je nog overeind?";

/**
 * Enforces output safety for PAAL01 module responses.
 * Returns the original text if safe, or a fallback if violations detected.
 */
export function enforceSteunpilarenOutputSafety(input: {
  moduleId: "PAAL01";
  text: string;
  persona: RecoFreePersona;
  crisisDetected: boolean;
  selectedInterventionType?: Paal01InterventionType;
}): string {
  // Persona guard
  if (input.persona !== "elias") {
    return FALLBACK_PAAL01;
  }

  // Crisis guard — reject reflective output during crisis
  if (input.crisisDetected) {
    return FALLBACK_PAAL01;
  }

  // Check for forbidden patterns
  const lower = input.text.toLowerCase();
  for (const pattern of REJECT_PATTERNS_PAAL01) {
    if (lower.includes(pattern.toLowerCase())) {
      return FALLBACK_PAAL01;
    }
  }

  return input.text;
}
