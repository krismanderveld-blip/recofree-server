/**
 * PAAL01 — EN marker bank
 * Markers for detecting steunpilaren-relevant context in English
 * Aligned with PAAL01 spec V1.
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
    "what helps me",
    "what keeps me going despite everything",
    "what helps me stay sober",
    "what helps me stay stable",
  ],
  supportSeeking: [
    "who can i call",
    "where can i go",
    "what keeps me going",
    "what gives me strength",
    "i want to know what supports me",
    "i am looking for something to hold on to",
    "i want to map my network",
    "who helps me",
    "what can i fall back on",
    "i do not know what still helps me",
    "i need support pillars",
    "what are my support pillars",
    "where do i get strength from",
    "what keeps me standing",
  ],
  postDifficultyStabilization: [
    "it is getting better",
    "i got through it",
    "i survived it",
    "i am back on my feet",
    "it was hard but i am still here",
    "what helped just now",
    "how did i get through that",
    "i crashed, what helped",
    "i want to remember what helped",
    "i need to remember this for later",
  ],
  isolationBelief: [
    "i have nobody",
    "i am on my own",
    "i am completely on my own",
    "i cannot count on anyone",
    "nobody supports me",
  ],
  balkmetafoorExplicit: [
    "burden",
    "carrying capacity",
    "balance",
    "what weighs on me",
    "what pulls at me",
    "i want to see what is heavy and what helps",
  ],
  profileFeatureRequest: [
    "i want to put this in my profile",
    "i want to save this",
    "put this in my profile",
  ],
} as const;

export type Paal01EnMarkerGroup = keyof typeof PAAL01_EN_MARKERS;
