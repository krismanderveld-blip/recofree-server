/**
 * AANP-K01 EN Marker Bank — Caregiver adaptation/covering-up patterns
 */

export const aanpK01MarkersEn = {
  coveringUp: [
    "I keep it quiet",
    "I do not tell anyone",
    "nobody knows",
    "I make excuses for him",
    "I call in sick for him",
    "I pretend everything is normal",
    "I keep up appearances",
    "I protect him to the outside world",
  ],
  selfErasure: [
    "I adapt myself",
    "I make myself smaller",
    "I swallow it",
    "I say nothing",
    "I walk on eggshells",
    "I avoid conflict",
    "I pretend it does not affect me",
    "I keep quiet",
  ],
  keepingUpAppearances: [
    "to the outside everything looks fine",
    "nobody sees how it really is",
    "at work they do not know",
    "my family does not know",
    "I pretend we are a normal family",
    "I smile while I cry",
  ],
  awarenessOfCost: [
    "it costs me energy",
    "I am losing myself",
    "I do not know who I am anymore",
    "I am tired of adapting",
    "it eats at me",
    "I cannot do this anymore",
  ],
} as const;

export type AanpK01MarkerGroupEn = keyof typeof aanpK01MarkersEn;
