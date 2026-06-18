/**
 * PAAL-K01 EN Marker Bank — Kim's own support pillars
 */

export const paalK01MarkersEn = {
  supportPillar: [
    "what keeps me standing",
    "what helps me as a caregiver",
    "who is there for me",
    "I need support for myself",
    "I forget what helps me",
    "I want to see my own support pillars",
    "I also need something to lean on",
    "I do not want to be only the caregiver role",
    "what keeps me upright",
  ],
  balanceBar: [
    "what gives me capacity",
    "what is pulling on me",
    "what is weighing on me",
  ],
  caregiverSelf: [
    "me as a person",
    "my own wellbeing",
    "take care of myself",
    "my own support",
    "I also need something",
  ],
} as const;

export type PaalK01MarkerGroupEn = keyof typeof paalK01MarkersEn;
