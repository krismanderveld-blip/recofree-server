/**
 * PAAL01 — EN marker bank
 * Markers for detecting steunpilaren-relevant context in English
 */

export const PAAL01_EN_MARKERS = {
  positiveReflection: [
    "i am grateful for",
    "luckily i have",
    "i find support in",
    "what helps me is",
    "my .* helps me",
    "i have good people around me",
    "my routine helps",
    "walking helps me",
    "my dog gives me peace",
    "my cat gives me peace",
    "i feel supported",
  ],
  supportSeeking: [
    "who can i call",
    "where can i go",
    "what keeps me going",
    "what gives me strength",
    "i want to know what supports me",
    "i am looking for something to hold on to",
    "i want to map my network",
  ],
  postDifficultyStabilization: [
    "it is getting better",
    "i got through it",
    "i survived it",
    "i am back on my feet",
    "it was hard but i am still here",
  ],
  isolationBelief: [
    "i have nobody",
    "i am on my own",
    "i am completely on my own",
    "i cannot count on anyone",
    "nobody supports me",
  ],
} as const;

export type Paal01EnMarkerGroup = keyof typeof PAAL01_EN_MARKERS;
