/**
 * SLAAP01 Elias Detector
 * Detects sleep problems as addiction recovery risk.
 * Engine decides, GPT executes. No diagnosis. No medication advice.
 */

import type {
  SLAAP01EliasRuntimeInput,
  SLAAP01EliasDetectionResult,
  SLAAP01EliasResponseMode,
  SLAAP01EliasRouteNext,
} from "./slaap01-types";

const ELIAS_NL_MARKERS: Record<string, string[]> = {
  SLEEP_PROBLEM: [
    "ik slaap niet", "ik kan niet slapen", "ik val niet in slaap",
    "ik word telkens wakker", "ik slaap heel licht", "ik slaap slecht",
    "ik lig uren wakker", "ik ben kapot van vermoeidheid",
    "ik ben uitgeput maar ik slaap niet", "mijn nachten zijn verschrikkelijk",
    "slapeloze nachten", "ik slaap maar een paar uur",
    "mijn ritme is volledig kapot", "ik draai mijn dag en nacht om",
  ],
  NIGHT_CRAVING: [
    "'s nachts krijg ik zucht", "'s nachts wil ik drinken",
    "in bed krijg ik zin om te gebruiken", "als ik wakker lig wil ik gebruiken",
    "de nacht is gevaarlijk voor mij", "na middernacht wordt het moeilijk",
    "als iedereen slaapt, begint mijn hoofd", "ik krijg zucht als ik alleen wakker ben",
    "ik wil iets nemen om te kunnen slapen", "ik wil drinken zodat ik kan slapen",
    "ik gebruik om te slapen", "ik drink om mijn hoofd uit te zetten",
  ],
  FATIGUE_TRIGGER: [
    "als ik moe ben, herval ik sneller", "vermoeidheid maakt mij zwak",
    "als ik uitgeput ben heb ik geen rem meer", "moe zijn geeft mij zucht",
    "ik kan niet vechten tegen zucht als ik moe ben", "slaaptekort maakt alles erger",
    "na een slechte nacht wil ik gebruiken", "als ik slecht slaap, verlies ik controle",
    "mijn impulscontrole is weg als ik moe ben",
  ],
  WITHDRAWAL_SLEEP: [
    "sinds ik gestopt ben slaap ik niet", "sinds ik minder drink slaap ik slechter",
    "sinds ik gestopt ben met gebruiken lig ik wakker", "onthouding maakt slapen onmogelijk",
    "mijn lichaam is onrustig nu ik gestopt ben", "rebound slapeloosheid",
    "ik slaap niet sinds detox", "ik slaap niet sinds opname",
    "mijn lichaam wil niet slapen zonder alcohol", "mijn lichaam wil niet slapen zonder benzo",
  ],
  SLEEP_ANXIETY: [
    "ik ben bang dat ik weer niet slaap", "ik krijg stress van naar bed gaan",
    "ik haat de nacht", "ik lig al bang voor ik ga slapen",
    "ik voel paniek omdat ik moet slapen", "ik begin te tellen hoeveel uren ik nog heb",
    "ik maak mezelf gek omdat ik moet slapen", "hoe harder ik wil slapen, hoe wakkerder ik word",
    "ik durf niet naar bed",
  ],
};

const ELIAS_EN_MARKERS: Record<string, string[]> = {
  SLEEP_PROBLEM: [
    "i cannot sleep", "i do not sleep", "i cannot fall asleep",
    "i keep waking up", "i sleep very lightly", "i sleep badly",
    "i lie awake for hours", "i am exhausted but i cannot sleep",
    "my nights are terrible", "sleepless nights", "i only sleep a few hours",
    "my rhythm is completely broken", "my day and night are reversed",
  ],
  NIGHT_CRAVING: [
    "at night i get cravings", "at night i want to drink",
    "in bed i want to use", "when i lie awake i want to use",
    "the night is dangerous for me", "after midnight it gets difficult",
    "when everyone sleeps, my head starts", "i get cravings when i am awake alone",
    "i want to take something so i can sleep", "i want to drink so i can sleep",
    "i use to sleep", "i drink to switch my head off",
  ],
  FATIGUE_TRIGGER: [
    "when i am tired i relapse faster", "tiredness makes me weak",
    "when i am exhausted i have no brakes", "being tired gives me cravings",
    "i cannot fight craving when i am tired", "sleep deprivation makes everything worse",
    "after a bad night i want to use", "when i sleep badly, i lose control",
    "my impulse control is gone when i am tired",
  ],
  WITHDRAWAL_SLEEP: [
    "since i stopped i cannot sleep", "since i drink less i sleep worse",
    "since i stopped using i lie awake", "withdrawal makes sleep impossible",
    "my body is restless now that i stopped", "i have rebound insomnia",
    "i cannot sleep since detox", "i cannot sleep since admission",
    "my body will not sleep without alcohol", "my body will not sleep without benzos",
  ],
  SLEEP_ANXIETY: [
    "i am afraid i will not sleep again", "going to bed stresses me out",
    "i hate the night", "i am already anxious before bed",
    "i panic because i have to sleep", "i start counting how many hours i have left",
    "i drive myself crazy because i have to sleep",
    "the harder i try to sleep, the more awake i get", "i am afraid to go to bed",
  ],
};

function matchMarkers(text: string, markerBank: Record<string, string[]>): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const [category, phrases] of Object.entries(markerBank)) {
    for (const phrase of phrases) {
      if (lower.includes(phrase.toLowerCase())) {
        matched.push(`${category}:${phrase}`);
      }
    }
  }
  return matched;
}

export function detectSLAAP01Elias(input: SLAAP01EliasRuntimeInput): SLAAP01EliasDetectionResult {
  // Gate: intake
  if (!input.intakeCompleted) {
    return {
      moduleId: "SLAAP01",
      persona: "elias",
      activationStatus: "BLOCKED_BY_INTAKE",
      confidenceScore: 0,
      matchedMarkers: [],
      responseMode: "SAFETY_EXIT",
      routeNext: "NO_MODULE",
      reason: "Intake incomplete. Engine blocks module activation.",
    };
  }

  // Gate: persona
  if (input.persona !== "elias") {
    return {
      moduleId: "SLAAP01",
      persona: "elias",
      activationStatus: "BLOCKED_BY_PERSONA_SEPARATION",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "NO_MODULE",
      reason: "Persona separation violation. Elias detector received non-Elias persona.",
    };
  }

  // Gate: crisis
  if (input.crisisProtocolStatus === "ACTIVE" || input.safetyRisk >= 0.7) {
    return {
      moduleId: "SLAAP01",
      persona: "elias",
      activationStatus: "BLOCKED_BY_CRISIS",
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "CRISIS_PROTOCOL",
      reason: "Crisis protocol overrides sleep module.",
    };
  }

  // Gate: medical
  if (input.medicalRisk >= 0.7) {
    return {
      moduleId: "SLAAP01",
      persona: "elias",
      activationStatus: "BLOCKED_BY_MEDICAL",
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: "MEDICAL_SAFETY_EXIT",
      routeNext: "MEDICAL_SAFETY_PROTOCOL",
      reason: "Medical safety overrides sleep module.",
    };
  }

  // Marker detection
  const nlMatches = matchMarkers(input.latestUserMessage, ELIAS_NL_MARKERS);
  const enMatches = matchMarkers(input.latestUserMessage, ELIAS_EN_MARKERS);
  const allMatches = [...nlMatches, ...enMatches, ...input.detectedMarkers];

  // Confidence scoring
  let score = 0;
  if (input.sleepProblemDetected) score += 0.30;
  if (input.nightCravingDetected) score += 0.30;
  if (input.fatigueRelapseTriggerDetected) score += 0.20;
  if (input.withdrawalSleepConcern) score += 0.20;
  if (input.sleepAnxietyDetected) score += 0.15;
  if (allMatches.length > 0) score += 0.05;
  const confidenceScore = Math.min(score, 0.98);

  // PAARS zone deferral
  if (input.paarsZoneActive) {
    return {
      moduleId: "SLAAP01",
      persona: "elias",
      activationStatus: "DEFERRED_TO_RELAPSE_OR_SAFETY",
      confidenceScore,
      matchedMarkers: allMatches,
      responseMode: "SAFETY_EXIT",
      routeNext: "FALE01",
      reason: "PAARS zone active. Relapse containment outranks sleep module.",
    };
  }

  // Withdrawal risk override
  if (input.withdrawalRisk >= 0.7) {
    return {
      moduleId: "SLAAP01",
      persona: "elias",
      activationStatus: "BLOCKED_BY_MEDICAL",
      confidenceScore: 1,
      matchedMarkers: allMatches,
      responseMode: "ELIAS_WITHDRAWAL_SLEEP_MEDICAL_CAUTION",
      routeNext: "MEDICAL_SAFETY_PROTOCOL",
      reason: "Withdrawal sleep concern requires medical safety routing.",
    };
  }

  // Below threshold
  if (confidenceScore < 0.5) {
    return {
      moduleId: "SLAAP01",
      persona: "elias",
      activationStatus: "NOT_ACTIVE",
      confidenceScore,
      matchedMarkers: allMatches,
      responseMode: "ELIAS_SLEEP_HYGIENE_NO_PRESSURE",
      routeNext: "NO_MODULE",
      reason: "Sleep recovery signal below threshold.",
    };
  }

  // Response mode routing
  let responseMode: SLAAP01EliasResponseMode = "ELIAS_SLEEP_HYGIENE_NO_PRESSURE";
  let routeNext: SLAAP01EliasRouteNext = "SLAAP01";

  if (input.nightCravingDetected && input.cravingIntensity >= 0.6) {
    responseMode = "ELIAS_NIGHT_CRAVING_DISTRESS_TOLERANCE";
    routeNext = "E01";
  } else if (input.sleepAnxietyDetected) {
    responseMode = "ELIAS_SLEEP_ANXIETY_ACCEPTANCE";
  } else if (input.fatigueRelapseTriggerDetected) {
    responseMode = "ELIAS_FATIGUE_TRIGGER_RECOGNITION";
  } else if (input.withdrawalSleepConcern) {
    responseMode = "ELIAS_WITHDRAWAL_SLEEP_MEDICAL_CAUTION";
    routeNext = "MEDICAL_SAFETY_PROTOCOL";
  }

  return {
    moduleId: "SLAAP01",
    persona: "elias",
    activationStatus: "ACTIVE",
    confidenceScore,
    matchedMarkers: allMatches,
    responseMode,
    routeNext,
    reason: "Elias sleep-and-addiction recovery pattern detected.",
  };
}
