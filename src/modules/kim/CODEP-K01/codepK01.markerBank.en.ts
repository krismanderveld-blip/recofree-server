/**
 * CODEP-K01 EN Marker Bank — Codependency pattern recognition
 */

export const codepK01MarkersEn = {
  identityFusion: [
    "I only exist when he is there",
    "without him I am nothing",
    "my life revolves around him",
    "I live for him",
    "when he is doing well I am doing well",
    "his problem is my problem",
    "I feel what he feels",
  ],
  rescueBehavior: [
    "I have to save him",
    "if I am not there things go wrong",
    "he cannot manage without me",
    "I am the only one who can help him",
    "I take over",
    "I solve it for him",
    "I cannot let him down",
  ],
  boundaryAbsence: [
    "I cannot say no",
    "I always give in",
    "my boundaries no longer exist",
    "I do not know where he ends and I begin",
    "I have no life of my own anymore",
    "everything revolves around his addiction",
  ],
  selfNeglect: [
    "I forget myself",
    "I have no needs of my own anymore",
    "I always postpone myself",
    "I never get around to it",
    "my own health does not matter",
    "I have no friends left",
  ],
} as const;

export type CodepK01MarkerGroupEn = keyof typeof codepK01MarkersEn;
