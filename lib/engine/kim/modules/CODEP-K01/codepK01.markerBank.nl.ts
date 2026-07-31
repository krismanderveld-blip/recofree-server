/**
 * CODEP-K01 NL Marker Bank — Codependency pattern recognition
 */

export const codepK01MarkersNl = {
  identityFusion: [
    "ik besta alleen als hij er is",
    "zonder hem ben ik niets",
    "mijn leven draait om hem",
    "ik leef voor hem",
    "als het goed gaat met hem gaat het goed met mij",
    "zijn probleem is mijn probleem",
    "ik voel wat hij voelt",
  ],
  rescueBehavior: [
    "ik moet hem redden",
    "als ik er niet ben gaat het mis",
    "hij kan niet zonder mij",
    "ik ben de enige die hem kan helpen",
    "ik neem het over",
    "ik los het voor hem op",
    "ik kan hem niet laten vallen",
  ],
  boundaryAbsence: [
    "ik kan geen nee zeggen",
    "ik geef altijd toe",
    "mijn grenzen bestaan niet meer",
    "ik weet niet waar hij ophoudt en ik begin",
    "ik heb geen eigen leven meer",
    "alles staat in het teken van zijn verslaving",
  ],
  selfNeglect: [
    "ik vergeet mezelf",
    "ik heb geen eigen behoeften meer",
    "ik stel mezelf altijd uit",
    "ik kom er niet aan toe",
    "mijn eigen gezondheid doet er niet toe",
    "ik heb geen vrienden meer over",
  ],
} as const;

export type CodepK01MarkerGroupNl = keyof typeof codepK01MarkersNl;
