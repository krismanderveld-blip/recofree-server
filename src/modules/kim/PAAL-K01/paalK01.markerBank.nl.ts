/**
 * PAAL-K01 NL Marker Bank — Kim's own support pillars
 */

export const paalK01MarkersNl = {
  supportPillar: [
    "wat houdt mij overeind",
    "wat helpt mij als naaste",
    "wie is er voor mij",
    "ik heb zelf steun nodig",
    "ik vergeet wat mij helpt",
    "ik wil mijn eigen steunpilaren zien",
    "ik moet ook ergens op kunnen steunen",
    "ik wil niet alleen de zorgrol zijn",
    "wat houdt mij recht",
  ],
  balanceBar: [
    "wat geeft mij draagkracht",
    "wat trekt aan mij",
    "wat weegt op mij",
  ],
  caregiverSelf: [
    "ik als persoon",
    "mijn eigen welzijn",
    "voor mezelf zorgen",
    "mijn eigen steun",
    "ik heb ook iets nodig",
  ],
} as const;

export type PaalK01MarkerGroupNl = keyof typeof paalK01MarkersNl;
