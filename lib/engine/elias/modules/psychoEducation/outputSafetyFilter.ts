import type {
  EliasPsychoEducationModuleId,
  EliasPsychoEducationMemoryHint,
} from "@/lib/types/eliasPsychoEducation.types";

const FORBIDDEN_PATTERNS: string[] = [
  "je bent zwak",
  "je hebt geen karakter",
  "het maakt niet uit",
  "er zijn geen gevolgen",
  "je kon er niets aan doen",
  "je hebt geen verantwoordelijkheid",
  "herval is onvermijdelijk",
  "herval was onvermijdelijk",
  "je brein deed het dus jij niet",
  "je brein deed het, jij niet",
  "gebruik gewoon meer wilskracht",
  "straf jezelf",
  "ga jezelf testen",
  "ga naar de winkel om te oefenen",
  "ga naar de winkel om jezelf te testen",
  "test je craving",
  "ga toch even rijden om af te koelen",
  "je bent machteloos",
  "je kon niets doen",
  "je kunt er niets aan doen",
  "you are weak",
  "just use more willpower",
  "relapse is inevitable",
  "it doesn't matter",
  "there are no consequences",
  "your brain did it so it was not you",
];

const MEMORY_INTERNALS: string[] = [
  "logs.dat",
  "user.dat",
  "projections.dat",
  "state.dat",
  "je profiel zegt",
  "ik heb opgeslagen",
  "in je geheugen staat",
  "je data laat zien",
  "your profile says",
  "I have stored",
];

const DIAGNOSIS_PATTERNS: string[] = [
  "je hebt een stoornis",
  "je lijdt aan",
  "de diagnose is",
  "klinisch gezien",
  "you have a disorder",
  "you suffer from",
  "the diagnosis is",
];

const FALLBACK_WILSKRACHT01 =
  "Dit hoeft niet te starten bij zelfhaat. Het snelle impulssysteem kan eerder vertrekken dan je bewuste controle, maar dat wist de gevolgen niet uit; het geeft ons wel een plek om vroeger in te grijpen. Wat was het allereerste signaal vóór het laatste moment?";

const FALLBACK_AUTOPILOT01 =
  "Dit klinkt als automatische piloot rond zucht of trigger. Dat is geen excuus, maar een signaal om de route vroeger te onderbreken. Wat was de eerste cue: plek, tijd, gevoel, gedachte of beweging?";

/**
 * Enforces output safety for Elias psycho-education modules.
 * Rejects outputs containing forbidden patterns, diagnosis language,
 * memory internals, or Kim persona language.
 * Returns the original text if safe, or the fallback if rejected.
 */
export function enforceEliasPsychoEducationOutputSafety(input: {
  moduleId: EliasPsychoEducationModuleId;
  text: string;
  crisisProtocolActive: boolean;
  memoryHintsUsed: EliasPsychoEducationMemoryHint[];
}): string {
  const lower = input.text.toLowerCase();

  // If crisis is active and output provides psycho-education instead of safety → reject
  if (input.crisisProtocolActive) {
    return getFallback(input.moduleId);
  }

  // Check forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
      return getFallback(input.moduleId);
    }
  }

  // Check memory internals
  for (const internal of MEMORY_INTERNALS) {
    if (lower.includes(internal.toLowerCase())) {
      return getFallback(input.moduleId);
    }
  }

  // Check diagnosis language
  for (const diag of DIAGNOSIS_PATTERNS) {
    if (lower.includes(diag.toLowerCase())) {
      return getFallback(input.moduleId);
    }
  }

  // Check Kim persona language (these modules are Elias-only)
  if (lower.includes("kim hier") || lower.includes("ik ben kim")) {
    return getFallback(input.moduleId);
  }

  return input.text;
}

function getFallback(moduleId: EliasPsychoEducationModuleId): string {
  return moduleId === "WILSKRACHT01"
    ? FALLBACK_WILSKRACHT01
    : FALLBACK_AUTOPILOT01;
}
