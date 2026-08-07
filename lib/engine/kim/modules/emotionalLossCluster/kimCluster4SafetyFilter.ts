/**
 * Kim Cluster 4 — Output Safety Filter
 *
 * Rejects GPT output that violates the ethical rules:
 * - No forced decisions (stay/leave/forgive)
 * - No diagnosis
 * - No legal advice
 * - No rescue/control advice
 * - No minimizing grief/shame/isolation
 * - No "if you really love them" framing
 */

import type { KimCluster4ModuleId } from './kimCluster4.types';

export interface KimCluster4SafetyFilterResult {
  safe: boolean;
  violations: string[];
}

// ─── Shared Patterns ──────────────────────────────────────────────────────────

const SHARED_VIOLATION_PATTERNS: RegExp[] = [
  // Forced decisions
  /\bje\s+moet\s+(?:weg(?:gaan)?|blijven|vergeven|beslissen)\b/i,
  /\byou\s+(?:must|should|have to)\s+(?:leave|stay|forgive|decide)\b/i,
  /\btu\s+dois\s+(?:partir|rester|pardonner|d[ée]cider)\b/i,

  // "If you really love" framing
  /\bals\s+je\s+(?:echt|werkelijk)\s+(?:van\s+(?:hem|haar)\s+)?houdt\b/i,
  /\bif\s+you\s+really\s+love\b/i,
  /\bsi\s+tu\s+l'aimes\s+vraiment\b/i,

  // Diagnosis
  /\bje\s+hebt\s+(?:waarschijnlijk\s+)?(?:een\s+)?(?:depressie|burn.?out|ptss|angststoornis)\b/i,
  /\byou\s+(?:probably\s+)?have\s+(?:depression|burnout|ptsd|anxiety\s+disorder)\b/i,

  // Legal advice
  /\bjuridisch\s+gezien\b/i,
  /\bje\s+hebt\s+recht\s+op\b/i,
  /\blegally\s+(?:speaking|you)\b/i,
  /\bjuridiquement\b/i,

  // Rescue/control
  /\bcontroleer\s+(?:zijn|haar)\b/i,
  /\bcheck\s+(?:his|her)\s+(?:phone|messages)\b/i,
  /\bv[ée]rifie\s+son\b/i,

  // Polarization / demonization (shared across all modules)
  /\bde\s+ander\s+is\s+het\s+probleem\b/i,
  /\bjij\s+bent\s+volledig\s+slachtoffer\b/i,
  /\bdit\s+is\s+allemaal\s+niet\s+van\s+jou\b/i,
  /\bthe\s+other\s+(?:person\s+)?is\s+the\s+problem\b/i,
  /\byou\s+are\s+(?:completely|entirely)\s+(?:a\s+)?victim\b/i,
];

// ─── Module-Specific Patterns ─────────────────────────────────────────────────

const HOOP_VIOLATION_PATTERNS: RegExp[] = [
  /\bje\s+moet\s+(?:hoop\s+houden|stoppen\s+met\s+hopen|opgeven)\b/i,
  /\byou\s+(?:must|should)\s+(?:keep\s+hoping|stop\s+hoping|give\s+up)\b/i,
  /\bdit\s+is\s+het\s+einde\b/i,
  /\bthis\s+is\s+the\s+end\b/i,
  // New relational stance forbidden
  /\bblijf\s+hopen\b/i,
  /\bgeef\s+de\s+hoop\s+op\b/i,
  /\bmisschien\s+verandert\s+het\s+nooit\b/i,
  /\bhoop\s+maakt\s+je\s+afhankelijk\b/i,
  /\bzonder\s+hoop\s+is\s+het\s+klaar\b/i,
  /\bhoop\s+heeft\s+geen\s+zin\s+meer\b/i,
  /\bkeep\s+hoping\b/i,
  /\bgive\s+up\s+hope\b/i,
  /\bmaybe\s+it\s+will\s+never\s+change\b/i,
];

const SCHAAM_VIOLATION_PATTERNS: RegExp[] = [
  /\bje\s+moet\s+je\s+niet\s+schamen\b/i,
  /\byou\s+shouldn'?t\s+(?:be|feel)\s+ashamed\b/i,
  /\bhet\s+is\s+toch\s+niet\s+zo\s+erg\b/i,
  /\bit'?s\s+not\s+(?:that|so)\s+bad\b/i,
  /\bje\s+moet\s+het\s+aan\s+iedereen\s+vertellen\b/i,
  /\bje\s+overdrijft\b/i,
  // New relational stance forbidden
  /\bjij\s+hebt\s+niets\s+verkeerd\s+gedaan\b/i,
  /\bje\s+hoeft\s+nergens\s+naar\s+te\s+kijken\b/i,
  /\bje\s+moet\s+alleen\s+aan\s+jezelf\s+denken\b/i,
  /\byou\s+did\s+nothing\s+wrong\b/i,
  /\byou\s+(?:should|must)\s+only\s+think\s+(?:of|about)\s+yourself\b/i,
];

const ROUW_VIOLATION_PATTERNS: RegExp[] = [
  /\bje\s+moet\s+(?:loslaten|verder|accepteren)\b/i,
  /\byou\s+(?:must|should|need to)\s+(?:let\s+go|move\s+on|accept)\b/i,
  /\b(?:hij|zij)\s+is\s+er\s+toch\s+nog\b/i,
  /\b(?:he|she)\s+is\s+still\s+(?:here|alive)\b/i,
  /\bwees\s+blij\s+dat\b/i,
  /\bbe\s+(?:glad|grateful|happy)\s+that\b/i,
  /\bdit\s+is\s+geen\s+echte\s+rouw\b/i,
  /\bthis\s+isn'?t\s+real\s+grief\b/i,
  /\bstop\s+met\s+vergelijken\b/i,
  // New relational stance forbidden — demonization / permanent loss
  /\bdie\s+persoon\s+bestaat\s+niet\s+meer\b/i,
  /\bde\s+oude\s+versie\s+komt\s+niet\s+terug\b/i,
  /\bdit\s+is\s+wie\s+de\s+ander\s+nu\s+is\b/i,
  /\bmisschien\s+moet\s+je\s+verder\s+zonder\s+hen\b/i,
  /\bverslaving\s+heeft\s+de\s+(?:echte|werkelijke)\s+persoon\s+vervangen\b/i,
  /\bje\s+moet\s+afscheid\s+nemen\b/i,
  /\bthat\s+person\s+(?:no\s+longer|doesn'?t)\s+exist\b/i,
  /\bthe\s+old\s+version\s+(?:won'?t|will\s+(?:not|never))\s+come\s+back\b/i,
  /\baddiction\s+has\s+replaced\s+the\s+real\s+person\b/i,
  /\byou\s+(?:must|should)\s+say\s+goodbye\b/i,
  /\bmaybe\s+you\s+should\s+move\s+on\s+without\b/i,
];

const ISOL_VIOLATION_PATTERNS: RegExp[] = [
  /\bje\s+moet\s+(?:gewoon\s+)?(?:meer\s+)?buiten(?:komen)?\b/i,
  /\byou\s+(?:just\s+)?need\s+to\s+get\s+out\s+more\b/i,
  /\bje\s+hebt\s+jezelf\s+ge[ïi]soleerd\b/i,
  /\byou\s+isolated\s+yourself\b/i,
  /\bje\s+bent\s+zwak\b/i,
  /\byou(?:'re| are)\s+weak\b/i,
  /\bje\s+moet\s+nu\s+terug\s+sociaal\b/i,
  // New relational stance forbidden
  /\bzoek\s+steun\s+zodat\s+je\s+de\s+ander\s+minder\s+nodig\s+hebt\b/i,
  /\bvervang\s+de\s+ander\s+door\s+andere\s+mensen\b/i,
  /\bde\s+relatie\s+is\s+de\s+oorzaak\s+van\s+je\s+isolatie\b/i,
  /\blaat\s+de\s+ander\s+los\b/i,
  /\btrek\s+je\s+terug\b/i,
  /\breplace\s+(?:the\s+other|them)\s+with\s+other\s+people\b/i,
  /\bthe\s+relationship\s+is\s+(?:the\s+)?cause\s+of\s+your\s+isolation\b/i,
];

// ─── Filter Function ──────────────────────────────────────────────────────────

export function applyKimCluster4SafetyFilter(
  output: string,
  moduleId: KimCluster4ModuleId
): KimCluster4SafetyFilterResult {
  const violations: string[] = [];

  // Check shared patterns
  for (const pattern of SHARED_VIOLATION_PATTERNS) {
    if (pattern.test(output)) {
      violations.push(`Shared violation: ${pattern.source}`);
    }
  }

  // Check module-specific patterns
  let modulePatterns: RegExp[] = [];
  switch (moduleId) {
    case 'HOOP-K01': modulePatterns = HOOP_VIOLATION_PATTERNS; break;
    case 'SCHAAM-K01': modulePatterns = SCHAAM_VIOLATION_PATTERNS; break;
    case 'ROUW-K01': modulePatterns = ROUW_VIOLATION_PATTERNS; break;
    case 'ISOL-K01': modulePatterns = ISOL_VIOLATION_PATTERNS; break;
    default: modulePatterns = []; break;
  }

  for (const pattern of modulePatterns) {
    if (pattern.test(output)) {
      violations.push(`${moduleId} violation: ${pattern.source}`);
    }
  }

  return {
    safe: violations.length === 0,
    violations,
  };
}
