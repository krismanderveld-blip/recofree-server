/**
 * VSP Insight Router
 *
 * Selects therapeutic framework based on insight state:
 * - REAL_GREEN → MI (Motivational Interviewing)
 * - RATIONAL_GREEN → MBT (Mentalization-Based Therapy)
 * - OVERWHELMED_ORANGE_RED → DGT (Dialectical Behavior Therapy)
 *   (only if safety core allows — if crisis, safety core takes over)
 *
 * NEVER overrides safety core decisions.
 * store:false on all GPT calls.
 */

import type {
  VspInsightState,
  VspFrameworkSelection,
  VspInsightPromptFrame,
  ImmutableSafetyCoreSnapshot,
} from "./vspInsightTypes";

export interface VspInsightRouterInput {
  insightState: VspInsightState;
  immutableCore: ImmutableSafetyCoreSnapshot;
  persona: "elias" | "kim";
  sessionTurnCount: number;
}

export interface VspInsightRouterResult {
  framework: VspFrameworkSelection;
  promptFrame: VspInsightPromptFrame;
  storeGptCall: false; // always false per spec
}

/**
 * Route to framework based on insight state.
 * Safety core always wins — if crisis/relapse active, we yield.
 */
export function routeVspInsight(
  input: VspInsightRouterInput
): VspInsightRouterResult {
  const { insightState, immutableCore, persona, sessionTurnCount } = input;

  // Safety core override: yield completely
  if (immutableCore.safetyOverrideActive || immutableCore.crisisDetected) {
    return {
      framework: "SAFETY_CORE_ONLY",
      promptFrame: buildSafetyCoreFrame(),
      storeGptCall: false,
    };
  }

  switch (insightState) {
    case "REAL_GREEN":
      return {
        framework: "MI",
        promptFrame: buildMiFrame(persona, sessionTurnCount),
        storeGptCall: false,
      };

    case "RATIONAL_GREEN":
      return {
        framework: "MBT",
        promptFrame: buildMbtFrame(persona, sessionTurnCount),
        storeGptCall: false,
      };

    case "OVERWHELMED_ORANGE_RED":
      // DGT only if safety core allows
      if (immutableCore.relapseIntentDetected) {
        return {
          framework: "SAFETY_CORE_ONLY",
          promptFrame: buildSafetyCoreFrame(),
          storeGptCall: false,
        };
      }
      return {
        framework: "DGT",
        promptFrame: buildDgtFrame(persona, sessionTurnCount),
        storeGptCall: false,
      };

    default:
      return {
        framework: "MI",
        promptFrame: buildMiFrame(persona, sessionTurnCount),
        storeGptCall: false,
      };
  }
}

// ─── Prompt Frame Builders ──────────────────────────────────────────────────

function buildMiFrame(persona: "elias" | "kim", turnCount: number): VspInsightPromptFrame {
  const personaName = persona === "elias" ? "Elias" : "Kim";
  return {
    frameworkLabel: "MI",
    systemInstruction: [
      `[VSP-INSIGHT: REAL_GREEN → MI frame active]`,
      `${personaName} gebruikt Motivational Interviewing.`,
      `Richt je op: verandertaal versterken, ambivalentie verkennen, autonomie ondersteunen.`,
      `Toon: warm, nieuwsgierig, niet-oordelend.`,
      `Vermijd: directieve adviezen, confrontatie, druk.`,
      turnCount <= 3
        ? `Begin met open vragen over motivatie en waarden.`
        : `Bouw voort op eerder genoemde verandertaal.`,
    ].join("\n"),
    silentDiscrepancyNote: null,
    neverSay: [
      "ben je zeker dat je groen bent?",
      "ik denk dat je hoger zit",
      "misschien voel je meer dan je zegt",
    ],
  };
}

function buildMbtFrame(persona: "elias" | "kim", turnCount: number): VspInsightPromptFrame {
  const personaName = persona === "elias" ? "Elias" : "Kim";
  return {
    frameworkLabel: "MBT",
    systemInstruction: [
      `[VSP-INSIGHT: RATIONAL_GREEN → MBT frame active]`,
      `${personaName} gebruikt Mentalization-Based Therapy.`,
      `De gebruiker rapporteert groen maar toont afstand/intellectualisering.`,
      `Richt je op: mentaliseren stimuleren, affect-focus, embodiment.`,
      `Vraag naar: wat voel je in je lichaam? Wat zou een ander zien?`,
      `Toon: zacht uitnodigend, niet confronterend.`,
      `NOOIT zeggen: "ik denk dat je eigenlijk niet groen bent" of "ben je zeker?"`,
      `Wel: nieuwsgierig doorvragen naar de beleving achter de woorden.`,
      turnCount <= 2
        ? `Start met: "Hoe voelt dat in je lichaam als je dat zegt?"`
        : `Bouw voort op eerdere mentalisatie-pogingen.`,
    ].join("\n"),
    silentDiscrepancyNote: "User reports green but language shows detachment/rationalization. Do NOT communicate this discrepancy. Use MBT to gently invite embodied reflection.",
    neverSay: [
      "ben je zeker dat je groen bent?",
      "ik denk dat je hoger zit",
      "je zegt groen maar ik geloof je niet",
      "misschien ben je niet zo oké als je denkt",
    ],
  };
}

function buildDgtFrame(persona: "elias" | "kim", turnCount: number): VspInsightPromptFrame {
  const personaName = persona === "elias" ? "Elias" : "Kim";
  return {
    frameworkLabel: "DGT",
    systemInstruction: [
      `[VSP-INSIGHT: OVERWHELMED_ORANGE_RED → DGT frame active]`,
      `${personaName} gebruikt Dialectische Gedragstherapie (DGT/DBT).`,
      `De gebruiker is overweldigd, dysgereguleerd, of in craving.`,
      `Richt je op: validatie EERST, dan distress tolerance skills.`,
      `Stappen: 1) Valideer de pijn/chaos, 2) Ground (5-4-3-2-1 of ademhaling),`,
      `3) Eén concrete skill aanbieden, 4) Niet te veel tegelijk.`,
      `Toon: kalm, stevig, aanwezig, kort.`,
      `Vermijd: lange uitleg, intellectuele analyse, te veel vragen.`,
      turnCount <= 2
        ? `Begin met validatie: "Ik hoor dat het nu heel zwaar is."`
        : `Check of eerdere grounding hielp, bied volgende stap.`,
    ].join("\n"),
    silentDiscrepancyNote: null,
    neverSay: [
      "je moet je ontspannen",
      "het valt wel mee",
      "denk positief",
      "het komt wel goed",
    ],
  };
}

function buildSafetyCoreFrame(): VspInsightPromptFrame {
  return {
    frameworkLabel: "SAFETY_CORE_ONLY",
    systemInstruction: [
      `[VSP-INSIGHT: SAFETY CORE OVERRIDE — insight layer defers]`,
      `Safety core is actief. VSP Insight doet NIETS.`,
      `Volg uitsluitend de safety core instructies.`,
    ].join("\n"),
    silentDiscrepancyNote: null,
    neverSay: [],
  };
}
