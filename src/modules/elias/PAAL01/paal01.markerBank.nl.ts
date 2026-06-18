/**
 * PAAL01 — NL marker bank
 * Markers for detecting steunpilaren-relevant context in Dutch
 */

export const PAAL01_NL_MARKERS = {
  positiveReflection: [
    "ik ben dankbaar voor",
    "gelukkig heb ik",
    "ik heb steun aan",
    "wat mij helpt is",
    "mijn .* helpt mij",
    "ik heb goede mensen om mij heen",
    "mijn routine helpt",
    "wandelen helpt mij",
    "mijn hond geeft mij rust",
    "mijn kat geeft mij rust",
    "ik voel mij gedragen",
  ],
  supportSeeking: [
    "wie kan ik bellen",
    "waar kan ik terecht",
    "wat houdt mij overeind",
    "wat geeft mij kracht",
    "ik wil weten wat mij steunt",
    "ik zoek houvast",
    "ik wil mijn netwerk in kaart brengen",
  ],
  postDifficultyStabilization: [
    "het gaat weer beter",
    "ik ben er doorheen gekomen",
    "ik heb het overleefd",
    "ik sta weer op",
    "het was zwaar maar ik ben er nog",
  ],
  isolationBelief: [
    "ik heb niemand",
    "ik sta er alleen voor",
    "ik sta er helemaal alleen voor",
    "ik kan op niemand rekenen",
    "niemand steunt mij",
  ],
} as const;

export type Paal01NlMarkerGroup = keyof typeof PAAL01_NL_MARKERS;
