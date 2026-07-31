/**
 * Kim VSP Insight Variant
 *
 * Kim-specific adaptations for the VSP Insight System.
 * Kim is the caregiver/naaste persona — different from Elias (user with addiction).
 *
 * Key differences:
 * - Kim's "overwhelm" is caregiver burnout, not craving
 * - Kim's "rational green" is over-functioning/parentification
 * - Kim's DGT frame focuses on boundary-setting, not substance craving
 * - Kim never gets craving-related soothing options
 * - Kim's MI frame focuses on self-care motivation, not substance change
 */

import type {
  VspInsightState,
  VspKimInsightState,
  VspInsightPromptFrame,
  VspFrameworkSelection,
  ImmutableSafetyCoreSnapshot,
  VspChatSignalSnapshot,
  VspMoodSlidersSnapshot,
} from "./vspInsightTypes";

// ─── Kim-specific markers ─────────────────────────────────────────────────────

const KIM_OVERWHELM_MARKERS = [
  // NL - caregiver burnout
  "ik kan niet meer zorgen", "ik ben op", "ik heb geen energie meer",
  "het is te veel voor mij", "ik ben uitgeput", "ik slaap niet meer",
  "ik maak me constant zorgen", "ik kan het niet meer aan",
  "ik verlies mezelf", "ik vergeet mezelf", "ik heb geen leven meer",
  "alles draait om hem", "alles draait om haar",
  "ik ben bang dat hij doodgaat", "ik ben bang dat ze doodgaat",
  // EN
  "i can't care anymore", "i'm depleted", "i have no energy left",
  "it's too much for me", "i'm exhausted", "i can't sleep",
  "i worry constantly", "i can't handle it",
  "i'm losing myself", "i forget myself", "i have no life",
  "everything revolves around him", "everything revolves around her",
  // FR
  "je ne peux plus m'occuper", "je suis épuisé", "je n'ai plus d'énergie",
  "c'est trop pour moi", "je suis à bout", "je ne dors plus",
];

const KIM_RATIONAL_GREEN_MARKERS = [
  // NL - over-functioning / parentification
  "ik moet sterk zijn", "ik moet doorgaan", "ik mag niet instorten",
  "hij heeft mij nodig", "zij heeft mij nodig", "ik ben de enige",
  "ik moet alles regelen", "als ik het niet doe", "niemand anders doet het",
  "ik houd het gezin draaiende", "ik ben verantwoordelijk",
  "ik mag niet klagen", "anderen hebben het erger",
  // EN
  "i have to be strong", "i have to keep going", "i can't break down",
  "he needs me", "she needs me", "i'm the only one",
  "i have to manage everything", "if i don't do it",
  "i keep the family going", "i'm responsible",
  "i shouldn't complain", "others have it worse",
  // FR
  "je dois être fort", "je dois continuer", "je ne peux pas craquer",
  "il a besoin de moi", "elle a besoin de moi", "je suis le seul",
];

// ─── Kim State Mapping ────────────────────────────────────────────────────────

/**
 * Map generic VspInsightState to Kim-specific state.
 */
export function mapToKimInsightState(state: VspInsightState): VspKimInsightState {
  switch (state) {
    case "REAL_GREEN":
      return "REAL_GREEN_CAREGIVER";
    case "RATIONAL_GREEN":
      return "RATIONAL_GREEN_CAREGIVER";
    case "OVERWHELMED_ORANGE_RED":
      return "OVERWHELMED_CAREGIVER";
    default:
      return "UNKNOWN";
  }
}

// ─── Kim Framework Router ─────────────────────────────────────────────────────

export interface KimVspRouterInput {
  insightState: VspInsightState;
  immutableCore: ImmutableSafetyCoreSnapshot;
  sessionTurnCount: number;
}

export interface KimVspRouterResult {
  framework: VspFrameworkSelection;
  promptFrame: VspInsightPromptFrame;
  kimInsightState: VspKimInsightState;
  storeGptCall: false;
}

/**
 * Kim-specific VSP Insight routing.
 * Same three frameworks (MI, MBT, DGT) but with caregiver-specific framing.
 */
export function routeKimVspInsight(input: KimVspRouterInput): KimVspRouterResult {
  const { insightState, immutableCore, sessionTurnCount } = input;
  const kimState = mapToKimInsightState(insightState);

  // Safety core override
  if (immutableCore.safetyOverrideActive || immutableCore.crisisDetected) {
    return {
      framework: "SAFETY_CORE_ONLY",
      promptFrame: buildKimSafetyCoreFrame(),
      kimInsightState: kimState,
      storeGptCall: false,
    };
  }

  switch (insightState) {
    case "REAL_GREEN":
      return {
        framework: "MI",
        promptFrame: buildKimMiFrame(sessionTurnCount),
        kimInsightState: kimState,
        storeGptCall: false,
      };

    case "RATIONAL_GREEN":
      return {
        framework: "MBT",
        promptFrame: buildKimMbtFrame(sessionTurnCount),
        kimInsightState: kimState,
        storeGptCall: false,
      };

    case "OVERWHELMED_ORANGE_RED":
      if (immutableCore.relapseIntentDetected) {
        return {
          framework: "SAFETY_CORE_ONLY",
          promptFrame: buildKimSafetyCoreFrame(),
          kimInsightState: kimState,
          storeGptCall: false,
        };
      }
      return {
        framework: "DGT",
        promptFrame: buildKimDgtFrame(sessionTurnCount),
        kimInsightState: kimState,
        storeGptCall: false,
      };

    default:
      return {
        framework: "MI",
        promptFrame: buildKimMiFrame(sessionTurnCount),
        kimInsightState: kimState,
        storeGptCall: false,
      };
  }
}

// ─── Kim-specific Prompt Frames ───────────────────────────────────────────────

function buildKimMiFrame(turnCount: number): VspInsightPromptFrame {
  return {
    frameworkLabel: "MI",
    systemInstruction: [
      `[VSP-INSIGHT KIM: REAL_GREEN_CAREGIVER → MI frame active]`,
      `Kim gebruikt Motivational Interviewing gericht op zelfzorg.`,
      `De naaste is in een goede staat — benut dit voor zelfzorg-motivatie.`,
      `Richt je op: eigen behoeften verkennen, grenzen stellen, zelfzorg versterken.`,
      `Toon: warm, bevestigend, uitnodigend tot eigen reflectie.`,
      `Vermijd: focus op de ander (persoon met verslaving), schuldgevoel.`,
      turnCount <= 3
        ? `Begin met: "Hoe gaat het met JOU vandaag? Niet als mantelzorger, maar als mens."`
        : `Bouw voort op eerder genoemde zelfzorg-intenties.`,
    ].join("\n"),
    silentDiscrepancyNote: null,
    neverSay: [
      "ben je zeker dat je groen bent?",
      "ik denk dat je hoger zit",
      "hoe gaat het met hem/haar?",
      "maak je je zorgen?",
    ],
  };
}

function buildKimMbtFrame(turnCount: number): VspInsightPromptFrame {
  return {
    frameworkLabel: "MBT",
    systemInstruction: [
      `[VSP-INSIGHT KIM: RATIONAL_GREEN_CAREGIVER → MBT frame active]`,
      `Kim gebruikt Mentalization-Based Therapy.`,
      `De naaste rapporteert groen maar toont over-functioneren/parentificatie.`,
      `"Ik moet sterk zijn" / "hij heeft mij nodig" = rationeel groen, niet echt groen.`,
      `Richt je op: mentaliseren over eigen emoties, niet alleen die van de ander.`,
      `Vraag naar: wat voel JIJ daarbij? Wat doet het met jou als mens?`,
      `Toon: zacht, niet-oordelend, uitnodigend.`,
      `NOOIT zeggen: "je doet te veel" of "je bent parentificerend"`,
      `Wel: "Ik ben benieuwd hoe dat voelt voor jou, los van wat hij/zij nodig heeft"`,
      turnCount <= 2
        ? `Start met: "Je zegt dat het goed gaat. Hoe voelt dat in je lichaam?"`
        : `Bouw voort op eerdere mentalisatie over eigen behoeften.`,
    ].join("\n"),
    silentDiscrepancyNote: "Caregiver reports green but shows over-functioning/parentification patterns. Do NOT communicate this. Use MBT to gently invite self-reflection.",
    neverSay: [
      "ben je zeker dat je groen bent?",
      "ik denk dat je hoger zit",
      "je doet te veel",
      "je bent parentificerend",
      "je moet loslaten",
    ],
  };
}

function buildKimDgtFrame(turnCount: number): VspInsightPromptFrame {
  return {
    frameworkLabel: "DGT",
    systemInstruction: [
      `[VSP-INSIGHT KIM: OVERWHELMED_CAREGIVER → DGT frame active]`,
      `Kim gebruikt Dialectische Gedragstherapie (DGT/DBT) voor mantelzorger-burnout.`,
      `De naaste is overweldigd — NIET door craving maar door zorglast.`,
      `Richt je op: validatie EERST, dan distress tolerance, dan grenzen.`,
      `Stappen: 1) Valideer de uitputting, 2) Ground (ademhaling, 5-4-3-2-1),`,
      `3) Eén concrete grens of zelfzorg-actie, 4) Niet te veel tegelijk.`,
      `Toon: kalm, stevig, aanwezig, kort.`,
      `Vermijd: "je moet loslaten", "je kunt hem/haar niet redden", lange uitleg.`,
      `NOOIT craving-gerelateerde soothing aanbieden (dit is een naaste, geen gebruiker).`,
      turnCount <= 2
        ? `Begin met: "Ik hoor dat het nu heel zwaar is voor jou."`
        : `Check of eerdere grounding hielp, bied volgende stap.`,
    ].join("\n"),
    silentDiscrepancyNote: null,
    neverSay: [
      "je moet loslaten",
      "je kunt hem/haar niet redden",
      "het is niet jouw schuld",
      "denk aan jezelf",
      "het valt wel mee",
    ],
  };
}

function buildKimSafetyCoreFrame(): VspInsightPromptFrame {
  return {
    frameworkLabel: "SAFETY_CORE_ONLY",
    systemInstruction: [
      `[VSP-INSIGHT KIM: SAFETY CORE OVERRIDE — insight layer defers]`,
      `Safety core is actief. VSP Insight doet NIETS.`,
      `Volg uitsluitend de safety core instructies.`,
    ].join("\n"),
    silentDiscrepancyNote: null,
    neverSay: [],
  };
}

// ─── Kim Signal Boost ─────────────────────────────────────────────────────────

/**
 * Check for Kim-specific overwhelm markers in chat signals.
 * Returns additional score boost for Kim caregiver burnout signals.
 */
export function detectKimOverwhelmBoost(chatSignals: VspChatSignalSnapshot): number {
  let boost = 0;
  const allMarkers = [
    ...chatSignals.overwhelmMarkers,
    ...chatSignals.cravingMarkers, // repurposed: for Kim, "craving" markers may be caregiver-specific
  ];
  const lower = allMarkers.join(" ").toLowerCase();

  for (const marker of KIM_OVERWHELM_MARKERS) {
    if (lower.includes(marker)) boost += 1;
  }

  return Math.min(boost, 3); // cap at 3
}

/**
 * Check for Kim-specific rational green markers.
 * Returns additional score boost for over-functioning/parentification.
 */
export function detectKimRationalGreenBoost(chatSignals: VspChatSignalSnapshot): number {
  let boost = 0;
  const allMarkers = chatSignals.rationalityMarkers;
  const lower = allMarkers.join(" ").toLowerCase();

  for (const marker of KIM_RATIONAL_GREEN_MARKERS) {
    if (lower.includes(marker)) boost += 1;
  }

  return Math.min(boost, 3); // cap at 3
}
