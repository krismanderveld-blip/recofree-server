/**
 * Steunpilaren Output Safety Filter
 * Enforces forbidden output rules for PAAL01.
 */

import type { RecoFreePersona } from "@/src/types/eliasSteunpilaren.types";

const REJECT_PATTERNS_PAAL01: string[] = [
  "je hebt geen steun",
  "je bent alleen",
  "zonder steunpilaren ga je terugvallen",
  "je netwerk is te klein",
  "je moet meer mensen hebben",
  "ik heb opgeslagen",
  "in user.dat staat",
  "in projections.dat staat",
  "in logs.dat staat",
  "kim",
  "score:",
  "punten",
  "level",
  "badge",
  "streak",
  "je moet dit invullen",
  "zonder dit werkt herstel niet",
];

const FALLBACK_PAAL01 =
  "Ik wil niet vastzetten dat je niets hebt. Soms zijn pilaren kleiner dan we denken. Wat is één ding — hoe klein ook — dat je vandaag een beetje draagt?";

/**
 * Enforces output safety for PAAL01 module responses.
 * Returns the original text if safe, or a fallback if violations detected.
 */
export function enforceSteunpilarenOutputSafety(input: {
  moduleId: "PAAL01";
  text: string;
  persona: RecoFreePersona;
  crisisDetected: boolean;
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
