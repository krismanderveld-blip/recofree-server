/**
 * Output safety filter for Kim Cluster 2 (GEVAAR-K01 + KIND-K01)
 * Rejects rescue/control/parentification/diagnosis language in GPT output
 */

export interface SafetyFilterResult {
  passed: boolean;
  violations: string[];
  filteredOutput?: string;
}

// Patterns that indicate rescue/control behavior (forbidden)
const RESCUE_CONTROL_PATTERNS: RegExp[] = [
  /\b(je\s+moet\s+(hem|haar)\s+tegenhouden)\b/i,
  /\b(pak\s+de\s+sleutels\s+af)\b/i,
  /\b(hou\s+(hem|haar)\s+tegen)\b/i,
  /\b(stop\s+(hem|haar)\s+fysiek)\b/i,
  /\b(grijp\s+in)\b/i,
  /\b(physically\s+stop)\b/i,
  /\b(take\s+the\s+keys)\b/i,
  /\b(restrain\s+(him|her))\b/i,
  /\b(confront\s+(him|her)\s+now)\b/i,
  /\b(block\s+the\s+door)\b/i,
  /\b(lock\s+(him|her)\s+in)\b/i,
  /\b(hide\s+the\s+(car|keys|bottles?))\b/i,
  /\b(verberg\s+de\s+(auto|sleutels|flessen?))\b/i,
  /\b(sluit\s+(hem|haar)\s+op)\b/i,
];

// Patterns that indicate parentification (forbidden in KIND-K01)
const PARENTIFICATION_PATTERNS: RegExp[] = [
  /\b(laat\s+je\s+kind\s+(op\s+)?(hem|haar)\s+letten)\b/i,
  /\b(je\s+kind\s+moet\s+het\s+geheim\s+houden)\b/i,
  /\b(je\s+kind\s+kan\s+helpen\s+door)\b/i,
  /\b(het\s+kind\s+moet\s+kiezen)\b/i,
  /\b(let\s+your\s+child\s+watch)\b/i,
  /\b(your\s+child\s+should\s+help)\b/i,
  /\b(the\s+child\s+must\s+choose)\b/i,
  /\b(ask\s+your\s+child\s+to\s+(monitor|watch|report))\b/i,
  /\b(vraag\s+je\s+kind\s+om\s+(te\s+)?(melden|rapporteren|in\s+de\s+gaten\s+houden))\b/i,
  /\b(keep\s+it\s+secret\s+from\s+the\s+children)\b/i,
  /\b(hou\s+het\s+geheim\s+voor\s+de\s+kinderen)\b/i,
];

// Patterns that indicate diagnosis (forbidden)
const DIAGNOSIS_PATTERNS: RegExp[] = [
  /\b(hij\s+heeft\s+waarschijnlijk)\b.*(stoornis|syndroom|aandoening)/i,
  /\b(she|he)\s+probably\s+has\b.*(disorder|syndrome|condition)/i,
  /\b(het\s+lijkt\s+op)\b.*(bipolair|borderline|narcis|psycho)/i,
  /\b(it\s+sounds?\s+like)\b.*(bipolar|borderline|narciss|psycho)/i,
  /\b(ik\s+denk\s+dat\s+(hij|zij|ze)\s+.{0,20}(heeft|is))\b.*(diagnose|stoornis)/i,
];

// Patterns that indicate legal advice (forbidden)
const LEGAL_ADVICE_PATTERNS: RegExp[] = [
  /\b(je\s+(moet|kan)\s+aangifte\s+doen)\b/i,
  /\b(you\s+should\s+file\s+a\s+(report|complaint|lawsuit))\b/i,
  /\b(je\s+hebt\s+recht\s+op)\b.*\b(voogdij|hoederecht|custody)\b/i,
  /\b(you\s+have\s+the\s+right\s+to)\b.*\b(custody|divorce|restraining)\b/i,
  /\b(neem\s+een\s+advocaat)\b/i,
  /\b(get\s+a\s+lawyer)\b/i,
  /\b(strafrechtelijk|civielrechtelijk)\b/i,
];

export function filterDangerChildOutput(
  output: string,
  moduleId: 'GEVAAR-K01' | 'KIND-K01'
): SafetyFilterResult {
  const violations: string[] = [];

  // Check rescue/control patterns
  for (const pattern of RESCUE_CONTROL_PATTERNS) {
    if (pattern.test(output)) {
      violations.push(`RESCUE_CONTROL: ${pattern.source}`);
    }
  }

  // Check parentification patterns (especially for KIND-K01)
  if (moduleId === 'KIND-K01') {
    for (const pattern of PARENTIFICATION_PATTERNS) {
      if (pattern.test(output)) {
        violations.push(`PARENTIFICATION: ${pattern.source}`);
      }
    }
  }

  // Check diagnosis patterns
  for (const pattern of DIAGNOSIS_PATTERNS) {
    if (pattern.test(output)) {
      violations.push(`DIAGNOSIS: ${pattern.source}`);
    }
  }

  // Check legal advice patterns
  for (const pattern of LEGAL_ADVICE_PATTERNS) {
    if (pattern.test(output)) {
      violations.push(`LEGAL_ADVICE: ${pattern.source}`);
    }
  }

  if (violations.length === 0) {
    return { passed: true, violations: [] };
  }

  return {
    passed: false,
    violations,
    filteredOutput: undefined,
  };
}
