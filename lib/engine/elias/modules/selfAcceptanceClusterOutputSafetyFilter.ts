/**
 * Self-Acceptance Cluster Output Safety Filter
 * Modules: BLIK01, ONTK01, IKST01, COEX01
 */
import type { EliasSelfAcceptanceModuleId, RecoFreePersona } from "../../../types/eliasSelfAcceptanceCluster.types";

interface SafetyFilterInput {
  moduleId: EliasSelfAcceptanceModuleId;
  text: string;
  persona: RecoFreePersona;
  crisisDetected: boolean;
}

const SHARED_FORBIDDEN: RegExp[] = [
  /diagnos/i,
  /\bKim\b/,
  /state\.dat/i,
  /user\.dat/i,
  /projections\.dat/i,
  /logs\.dat/i,
  /buffer/i,
  /in mijn geheugen/i,
  /in memory/i,
  /ik herinner mij/i,
  /hidden inference/i,
  /stored context/i,
];

const BLIK01_FORBIDDEN: RegExp[] = [
  /alles gebeurt met een reden/i,
  /everything happens for a reason/i,
  /bekijk het positief/i,
  /look at it positively/i,
  /je hebt die (steun|pilaar|support) niet nodig/i,
  /you don't need that support/i,
  /het valt wel mee/i,
  /it is not that bad/i,
  /je gaat hervallen/i,
  /dit verklaart je gebruik/i,
  /dit is trauma/i,
  /alles is weg/i,
  /in PAAL01 staat/i,
];

const ONTK01_FORBIDDEN: RegExp[] = [
  /je liegt tegen jezelf/i,
  /you are lying to yourself/i,
  /je bent in ontkenning/i,
  /you are in denial/i,
  /het heeft geen gevolgen/i,
  /there are no consequences/i,
  /je bent een leugenaar/i,
  /you are a liar/i,
];

const IKST01_FORBIDDEN: RegExp[] = [
  /je hebt geen ik-sterkte/i,
  /you have no ego strength/i,
  /je bent impulsief(?!\s*(handelen|gedrag))/i,
  /you are impulsive/i,
  /je bent onvolwassen/i,
  /je moet je gevoel negeren/i,
  /gevoelens zijn fout/i,
  /feelings are wrong/i,
  /dit is een persoonlijkheidsprobleem/i,
  /this is a personality problem/i,
];

const COEX01_FORBIDDEN: RegExp[] = [
  /stop met slachtoffer spelen/i,
  /stop playing victim/i,
  /alles is jouw schuld/i,
  /everything is your fault/i,
  /het is allemaal jouw schuld/i,
  /je hebt geen verantwoordelijkheid/i,
  /you have no responsibility/i,
  /door hen mag je drinken/i,
  /aanvaarden is goedkeuren/i,
  /acceptance means approval/i,
  /verantwoordelijkheid betekent schuld/i,
  /responsibility means fault/i,
  /je bent cynisch/i,
  /you are cynical/i,
];

const FALLBACKS: Record<EliasSelfAcceptanceModuleId, string> = {
  BLIK01: "Dit raakt iets dat steun gaf. We maken het niet kleiner, maar we maken het ook niet groter dan heel je bestaan. Wat staat er nog, al is het klein?",
  ONTK01: "Ik val je niet aan. Ik vertraag alleen de zin die gebruik kleiner maakt. Wat is het feit, zonder schaamte en zonder goedpraten?",
  IKST01: "Je gevoel mag er zijn, maar het hoeft niet meteen een bevel te worden. Wat weet je zeker, wat vul je in, en welke actie kan even wachten?",
  COEX01: "Het kan echt oneerlijk zijn. Verantwoordelijkheid nemen betekent niet dat alles jouw schuld was; het betekent dat je één volgende stap niet weggeeft.",
};

const MODULE_FORBIDDEN: Record<EliasSelfAcceptanceModuleId, RegExp[]> = {
  BLIK01: BLIK01_FORBIDDEN,
  ONTK01: ONTK01_FORBIDDEN,
  IKST01: IKST01_FORBIDDEN,
  COEX01: COEX01_FORBIDDEN,
};

export function enforceSelfAcceptanceClusterOutputSafety(input: SafetyFilterInput): string {
  // Persona check
  if (input.persona !== "elias") {
    return "[BLOCKED: Self-acceptance cluster modules are Elias-only.]";
  }

  // Crisis override
  if (input.crisisDetected) {
    return "[BLOCKED: Crisis detected. Reflective module output suppressed. Route to crisis protocol.]";
  }

  const text = input.text;

  // Check shared forbidden patterns
  for (const pattern of SHARED_FORBIDDEN) {
    if (pattern.test(text)) {
      return FALLBACKS[input.moduleId];
    }
  }

  // Check module-specific forbidden patterns
  const moduleForbidden = MODULE_FORBIDDEN[input.moduleId];
  for (const pattern of moduleForbidden) {
    if (pattern.test(text)) {
      return FALLBACKS[input.moduleId];
    }
  }

  // Check for crisis-weakening language
  if (/crisis (is|was) (niet|not) (echt|real|nodig|necessary)/i.test(text)) {
    return FALLBACKS[input.moduleId];
  }

  return text;
}
