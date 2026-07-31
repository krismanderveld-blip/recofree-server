/**
 * AANP-K01 NL Marker Bank — Caregiver adaptation/covering-up patterns
 */

export const aanpK01MarkersNl = {
  coveringUp: [
    "ik houd het stil",
    "ik vertel het niet",
    "niemand weet het",
    "ik verzin excuses voor hem",
    "ik bel hem ziek",
    "ik doe alsof alles normaal is",
    "ik houd de schijn op",
    "ik bescherm hem naar buiten toe",
  ],
  selfErasure: [
    "ik pas me aan",
    "ik maak mezelf kleiner",
    "ik slik het in",
    "ik zeg niets",
    "ik loop op eieren",
    "ik vermijd conflict",
    "ik doe alsof het me niet raakt",
    "ik houd me stil",
  ],
  keepingUpAppearances: [
    "naar buiten toe lijkt alles goed",
    "niemand ziet hoe het echt is",
    "op het werk weten ze niets",
    "mijn familie weet het niet",
    "ik doe alsof we een normaal gezin zijn",
    "ik lach terwijl ik huil",
  ],
  awarenessOfCost: [
    "het kost me energie",
    "ik verlies mezelf",
    "ik weet niet meer wie ik ben",
    "ik ben moe van het aanpassen",
    "het vreet aan me",
    "ik kan niet meer",
  ],
} as const;

export type AanpK01MarkerGroupNl = keyof typeof aanpK01MarkersNl;
