/**
 * BEHE-K01 EN Marker Bank — Caregiver control patterns
 */

export const beheK01MarkersEn = {
  controlBehavior: [
    "I check his phone",
    "I check if he has been drinking",
    "I smell his breath",
    "I look through his pockets",
    "I follow him",
    "I check his bank account",
    "I control everything",
    "I call him all the time",
  ],
  threateningUltimatum: [
    "I threaten to leave",
    "if he does it one more time",
    "this is the last time",
    "I gave an ultimatum",
    "I threaten with the children",
    "if you do not stop I will leave",
  ],
  exhaustionFromControl: [
    "I am tired of controlling",
    "it does not help but I cannot stop",
    "it drives me crazy",
    "I feel like a police officer",
    "I do not want to be the controller anymore",
    "it exhausts me",
  ],
  awarenessOfPattern: [
    "I know it does not help",
    "I do it automatically",
    "I cannot do otherwise",
    "it is a pattern",
    "I recognize it in myself",
  ],
} as const;

export type BeheK01MarkerGroupEn = keyof typeof beheK01MarkersEn;
