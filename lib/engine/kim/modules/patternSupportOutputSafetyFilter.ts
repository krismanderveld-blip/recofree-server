/**
 * Kim Pattern Support Output Safety Filter
 *
 * Enforces safety rules for PAAL-K01, BEHE-K01, AANP-K01, CODEP-K01 output.
 * Returns cleaned text or fallback if violations are detected.
 */

import type {
  KimPatternSupportModuleId,
  RecoFreePersona,
} from "@/lib/types/kimPatternsSupport.types";

export interface KimPatternSafetyFilterInput {
  moduleId: KimPatternSupportModuleId;
  text: string;
  persona: RecoFreePersona;
  crisisDetected: boolean;
}

const GENERAL_FORBIDDEN: RegExp[] = [
  /\bdiagnos[e]?\b/i,
  /\belias\b/i,
  /\buser\.dat\b/i,
  /\bstate\.dat\b/i,
  /\bprojections\.dat\b/i,
  /\blogs\.dat\b/i,
  /\bbuffer\b/i,
  /\bopgeslagen\b/i,
  /\bgeheugen\b/i,
  /\bstorage\b/i,
  /\bje moet blijven\b/i,
  /\bje moet weggaan\b/i,
  /\bje moet hem verlaten\b/i,
  /\bje moet stoppen met om hem te geven\b/i,
  /\bjij veroorzaakt?\b.*\bverslaving\b/i,
  /\bhet is jouw schuld\b/i,
  /\bzonder jou zou hij beter zijn\b/i,
  /\bcontroleer hem\b/i,
  /\bred hem\b/i,
  /\bmonitor hem\b/i,
  /\bstraf hem\b/i,
  /\bdwing herstel\b/i,
];

const PAAL_K01_FORBIDDEN: RegExp[] = [
  /\bdit helpt hem (?:beter )?herstellen\b/i,
  /\bje draagkracht is te laag\b/i,
  /\bje hebt te weinig steun\b/i,
  /\bje scoort?\b/i,
  /\bscore\b/i,
  /\bbadge\b/i,
  /\bstreak\b/i,
  /\bgamif/i,
  /\bals jij genoeg steun hebt drinkt hij minder\b/i,
  /\bje moet sterker zijn\b/i,
];

const BEHE_K01_FORBIDDEN: RegExp[] = [
  /\bjij bent (?:een )?manipulati(?:ef|eve)\b/i,
  /\bjij bent toxic\b/i,
  /\bjij bent controlerend\b/i,
  /\bje bent de politie\b/i,
  /\bcheck zijn telefoon\b/i,
  /\bcontroleer zijn telefoon\b/i,
  /\bdreig harder\b/i,
  /\bstel strengere ultimatums\b/i,
  /\bals je echt grenzen had\b/i,
  /\bcodependent\b/i,
];

const AANP_K01_FORBIDDEN: RegExp[] = [
  /\bje liegt\b/i,
  /\bje bent oneerlijk\b/i,
  /\bje houdt het probleem in stand\b/i,
  /\bje moet iedereen (?:de waarheid|alles) vertellen\b/i,
  /\bje moet het op je werk melden\b/i,
  /\bje bent zwak\b/i,
  /\bje moet hem ontmaskeren\b/i,
  /\bcodependent\b/i,
];

const CODEP_K01_FORBIDDEN: RegExp[] = [
  /\bjij bent codependent\b/i,
  /\bje hebt codependency\b/i,
  /\bDSM\b/,
  /\bje houdt zijn verslaving in stand\b/i,
  /\bje bent verslaafd aan hem\b/i,
  /\bhet is jouw schuld\b/i,
  /\bzonder jou zou hij beter zijn\b/i,
];

const MODULE_FORBIDDEN: Record<KimPatternSupportModuleId, RegExp[]> = {
  "PAAL-K01": PAAL_K01_FORBIDDEN,
  "BEHE-K01": BEHE_K01_FORBIDDEN,
  "AANP-K01": AANP_K01_FORBIDDEN,
  "CODEP-K01": CODEP_K01_FORBIDDEN,
};

const FALLBACKS: Record<KimPatternSupportModuleId, string> = {
  "PAAL-K01":
    "Ik maak hier geen score van. We kijken alleen naar wat jou als persoon draagt, los van wat hij of zij nodig heeft.",
  "BEHE-K01":
    "Ik veroordeel dit niet. Controle zoeken kan begrijpelijk zijn naast onvoorspelbaarheid. De vraag is of het jou nog helpt, of vooral uitput.",
  "AANP-K01":
    "Ik ga je niet pushen om alles open te gooien. We kijken alleen naar wat het jou kost om jezelf telkens aan te passen.",
  "CODEP-K01":
    "Ik plak hier geen label op. Ik hoor vooral dat jouw rust heel sterk vast komt te zitten aan hoe het met hem of haar gaat.",
};

export function enforceKimPatternSupportOutputSafety(
  input: KimPatternSafetyFilterInput
): string {
  // Hard block: wrong persona
  if (input.persona !== "kim") {
    return FALLBACKS[input.moduleId];
  }

  // Hard block: crisis detected but reflective output attempted
  if (input.crisisDetected) {
    return FALLBACKS[input.moduleId];
  }

  const text = input.text;

  // Check general forbidden patterns
  for (const pattern of GENERAL_FORBIDDEN) {
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

  return text;
}
