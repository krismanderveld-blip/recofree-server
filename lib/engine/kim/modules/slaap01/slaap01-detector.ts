/**
 * SLAAP01 Kim Detector
 * Detects caregiver sleep problems as sustainability risk.
 * Engine decides, GPT executes. No diagnosis. No medication advice.
 */

import type {
  SLAAP01KimRuntimeInput,
  SLAAP01KimDetectionResult,
  SLAAP01KimResponseMode,
  SLAAP01KimRouteNext,
} from "./slaap01-types";

const KIM_NL_MARKERS: Record<string, string[]> = {
  SLEEP_PROBLEM: [
    "ik slaap niet", "ik kan niet slapen", "ik lig wakker",
    "ik word wakker van stress", "ik slaap slecht door alles",
    "mijn nachten zijn kapot", "ik ben uitgeput",
    "ik slaap maar een paar uur", "ik rust niet meer uit",
    "mijn hoofd blijft draaien",
  ],
  NIGHT_VIGILANCE: [
    "ik blijf wakker om hem in het oog te houden",
    "ik blijf wakker om haar in het oog te houden",
    "ik luister of hij drinkt", "ik luister of zij drinkt",
    "ik check de hele nacht", "ik durf mijn telefoon niet uit te zetten",
    "ik wacht tot hij thuis is", "ik wacht tot zij thuis is",
    "ik slaap niet omdat ik bang ben dat er iets gebeurt",
    "ik ben 's nachts op wacht",
    "ik controleer of hij nog ademt", "ik controleer of zij veilig is",
  ],
  SLEEP_GUILT: [
    "ik voel me schuldig als ik ga slapen",
    "ik kan toch niet slapen terwijl hij zo zit",
    "ik kan toch niet slapen terwijl zij zo zit",
    "als ik slaap laat ik hem in de steek",
    "als ik slaap laat ik haar in de steek",
    "rust nemen voelt egoistisch",
    "ik mag niet slapen zolang het niet opgelost is",
    "ik moet beschikbaar blijven", "ik moet sterk blijven, ook 's nachts",
  ],
  FATIGUE_BOUNDARY: [
    "als ik moe ben ontplof ik sneller",
    "als ik moe ben kan ik mijn grens niet houden",
    "vermoeidheid maakt mij harder", "ik word kortaf door slaaptekort",
    "ik kan niet meer zorgen als ik zo moe ben",
    "ik verlies mezelf als ik niet slaap",
    "mijn grenzen zakken weg als ik uitgeput ben",
    "ik blijf zorgen terwijl ik niet meer kan",
  ],
};

const KIM_EN_MARKERS: Record<string, string[]> = {
  SLEEP_PROBLEM: [
    "i cannot sleep", "i lie awake", "i wake up from stress",
    "i sleep badly because of everything", "my nights are broken",
    "i am exhausted", "i only sleep a few hours",
    "i do not rest anymore", "my head keeps spinning",
  ],
  NIGHT_VIGILANCE: [
    "i stay awake to watch him", "i stay awake to watch her",
    "i listen to hear if he drinks", "i listen to hear if she drinks",
    "i check all night", "i cannot turn my phone off",
    "i wait until he gets home", "i wait until she gets home",
    "i cannot sleep because i am afraid something will happen",
    "i am on watch at night",
    "i check if he is still breathing", "i check if she is safe",
  ],
  SLEEP_GUILT: [
    "i feel guilty when i go to sleep",
    "i cannot sleep while he is like this",
    "i cannot sleep while she is like this",
    "if i sleep i abandon him", "if i sleep i abandon her",
    "resting feels selfish", "i am not allowed to sleep until it is solved",
    "i have to remain available", "i have to stay strong, even at night",
  ],
  FATIGUE_BOUNDARY: [
    "when i am tired i explode faster",
    "when i am tired i cannot hold my boundary",
    "tiredness makes me harsher", "i become short because of sleep deprivation",
    "i cannot care anymore when i am this tired",
    "i lose myself when i do not sleep",
    "my boundaries collapse when i am exhausted",
    "i keep caring when i cannot anymore",
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

export function detectSLAAP01Kim(input: SLAAP01KimRuntimeInput): SLAAP01KimDetectionResult {
  // Gate: intake
  if (!input.intakeCompleted) {
    return {
      moduleId: "SLAAP01",
      persona: "kim",
      activationStatus: "BLOCKED_BY_INTAKE",
      confidenceScore: 0,
      matchedMarkers: [],
      responseMode: "SAFETY_EXIT",
      routeNext: "NO_MODULE",
      reason: "Intake incomplete. Engine blocks module activation.",
    };
  }

  // Gate: persona
  if (input.persona !== "kim") {
    return {
      moduleId: "SLAAP01",
      persona: "kim",
      activationStatus: "BLOCKED_BY_PERSONA_SEPARATION",
      confidenceScore: 0,
      matchedMarkers: input.detectedMarkers,
      responseMode: "SAFETY_EXIT",
      routeNext: "NO_MODULE",
      reason: "Persona separation violation. Kim detector received non-Kim persona.",
    };
  }

  // Gate: crisis
  if (input.crisisProtocolStatus === "ACTIVE" || input.safetyRisk >= 0.7) {
    return {
      moduleId: "SLAAP01",
      persona: "kim",
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
      persona: "kim",
      activationStatus: "BLOCKED_BY_MEDICAL",
      confidenceScore: 1,
      matchedMarkers: input.detectedMarkers,
      responseMode: "MEDICAL_SAFETY_EXIT",
      routeNext: "MEDICAL_SAFETY_PROTOCOL",
      reason: "Medical safety overrides sleep module.",
    };
  }

  // Marker detection
  const nlMatches = matchMarkers(input.latestUserMessage, KIM_NL_MARKERS);
  const enMatches = matchMarkers(input.latestUserMessage, KIM_EN_MARKERS);
  const allMatches = [...nlMatches, ...enMatches, ...input.detectedMarkers];

  // Confidence scoring
  let score = 0;
  if (input.sleepProblemDetected) score += 0.25;
  if (input.nightVigilanceDetected) score += 0.30;
  if (input.sleepGuiltDetected) score += 0.20;
  if (input.fatigueBoundaryTriggerDetected) score += 0.20;
  if (input.sleepAnxietyDetected) score += 0.10;
  if (allMatches.length > 0) score += 0.05;
  const confidenceScore = Math.min(score, 0.98);

  // Acute household safety
  if (input.acuteHouseholdSafetyRisk) {
    return {
      moduleId: "SLAAP01",
      persona: "kim",
      activationStatus: "ACTIVE",
      confidenceScore: Math.max(confidenceScore, 0.9),
      matchedMarkers: allMatches,
      responseMode: "KIM_CAREGIVER_SAFETY_DISTINCTION",
      routeNext: "SAFETY_PROTOCOL",
      reason: "Caregiver sleep concern includes possible acute household safety risk.",
    };
  }

  // Below threshold
  if (confidenceScore < 0.5) {
    return {
      moduleId: "SLAAP01",
      persona: "kim",
      activationStatus: "NOT_ACTIVE",
      confidenceScore,
      matchedMarkers: allMatches,
      responseMode: "KIM_SLEEP_HYGIENE_WITHOUT_GUILT",
      routeNext: "NO_MODULE",
      reason: "Caregiver sleep signal below threshold.",
    };
  }

  // Response mode routing
  let responseMode: SLAAP01KimResponseMode = "KIM_SLEEP_HYGIENE_WITHOUT_GUILT";
  let routeNext: SLAAP01KimRouteNext = "SLAAP01";

  if (input.nightVigilanceDetected) {
    responseMode = "KIM_NIGHT_VIGILANCE_BOUNDARY";
    routeNext = "KBR01";
  } else if (input.sleepGuiltDetected) {
    responseMode = "KIM_SLEEP_GUILT_DECOUPLING";
    routeNext = "KSC01";
  } else if (input.fatigueBoundaryTriggerDetected) {
    responseMode = "KIM_FATIGUE_BOUNDARY_TRIGGER";
    routeNext = "KBR01";
  }

  return {
    moduleId: "SLAAP01",
    persona: "kim",
    activationStatus: "ACTIVE",
    confidenceScore,
    matchedMarkers: allMatches,
    responseMode,
    routeNext,
    reason: "Kim caregiver sleep-and-load pattern detected.",
  };
}
