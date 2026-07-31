/**
 * BEHE-K01 NL Marker Bank — Caregiver control patterns
 */

export const beheK01MarkersNl = {
  controlBehavior: [
    "ik controleer zijn telefoon",
    "ik check of hij gedronken heeft",
    "ik ruik aan zijn adem",
    "ik kijk in zijn zakken",
    "ik volg hem",
    "ik check zijn bankrekening",
    "ik controleer alles",
    "ik bel hem de hele tijd",
  ],
  threateningUltimatum: [
    "ik dreig te vertrekken",
    "als hij nog één keer",
    "dit is de laatste keer",
    "ik heb een ultimatum gesteld",
    "ik dreig met de kinderen",
    "als je niet stopt ga ik weg",
  ],
  exhaustionFromControl: [
    "ik ben moe van het controleren",
    "het helpt niet maar ik kan niet stoppen",
    "ik word er gek van",
    "ik voel me een politieagent",
    "ik wil niet meer de controleur zijn",
    "het put me uit",
  ],
  awarenessOfPattern: [
    "ik weet dat het niet helpt",
    "ik doe het automatisch",
    "ik kan niet anders",
    "het is een patroon",
    "ik herken het bij mezelf",
  ],
} as const;

export type BeheK01MarkerGroupNl = keyof typeof beheK01MarkersNl;
