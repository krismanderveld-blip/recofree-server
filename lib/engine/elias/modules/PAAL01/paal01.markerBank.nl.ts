/**
 * PAAL01 — NL marker bank
 * Markers for detecting steunpilaren-relevant context in Dutch
 * Aligned with PAAL01 spec V1.
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
    "wat helpt mij",
    "wat maakt dat ik toch doorga",
    "wat helpt mij nuchter blijven",
    "wat helpt mij stabiel blijven",
  ],
  supportSeeking: [
    "wie kan ik bellen",
    "waar kan ik terecht",
    "wat houdt mij overeind",
    "wat geeft mij kracht",
    "ik wil weten wat mij steunt",
    "ik zoek houvast",
    "ik wil mijn netwerk in kaart brengen",
    "wie helpt mij",
    "waar kan ik op terugvallen",
    "ik weet niet wat mij nog helpt",
    "ik heb steunpilaren nodig",
    "wat zijn mijn steunpilaren",
    "waar haal ik draagkracht uit",
    "wat houdt mij recht",
  ],
  postDifficultyStabilization: [
    "het gaat weer beter",
    "ik ben er doorheen gekomen",
    "ik heb het overleefd",
    "ik sta weer op",
    "het was zwaar maar ik ben er nog",
    "wat hielp daarnet",
    "hoe ben ik daar doorgeraakt",
    "ik ben gezakt, wat hielp",
    "ik wil onthouden wat hielp",
    "dit moet ik onthouden voor later",
  ],
  isolationBelief: [
    "ik heb niemand",
    "ik sta er alleen voor",
    "ik sta er helemaal alleen voor",
    "ik kan op niemand rekenen",
    "niemand steunt mij",
  ],
  balkmetafoorExplicit: [
    "draaglast",
    "draagkracht",
    "balans",
    "wat trekt aan mij",
    "wat weegt op mij",
    "ik wil zien wat zwaar is en wat helpt",
  ],
  profileFeatureRequest: [
    "ik wil dit in mijn profiel zetten",
    "ik wil dit opslaan",
    "zet dit in mijn profiel",
  ],
} as const;

export type Paal01NlMarkerGroup = keyof typeof PAAL01_NL_MARKERS;
