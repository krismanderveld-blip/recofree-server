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
];

// ─── Module-Specific Patterns ─────────────────────────────────────────────────

const HOOP_VIOLATION_PATTERNS: RegExp[] = [
  /\bje\s+moet\s+(?:hoop\s+houden|stoppen\s+met\s+hopen|opgeven)\b/i,
  /\byou\s+(?:must|should)\s+(?:keep\s+hoping|stop\s+hoping|give\s+up)\b/i,
  /\bdit\s+is\s+het\s+einde\b/i,
  /\bthis\s+is\s+the\s+end\b/i,
];

const SCHAAM_VIOLATION_PATTERNS: RegExp[] = [
  /\bje\s+moet\s+je\s+niet\s+schamen\b/i,
  /\byou\s+shouldn'?t\s+(?:be|feel)\s+ashamed\b/i,
  /\bhet\s+is\s+toch\s+niet\s+zo\s+erg\b/i,
  /\bit'?s\s+not\s+(?:that|so)\s+bad\b/i,
  /\bje\s+moet\s+het\s+aan\s+iedereen\s+vertellen\b/i,
  /\bje\s+overdrijft\b/i,
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
];

const ISOL_VIOLATION_PATTERNS: RegExp[] = [
  /\bje\s+moet\s+(?:gewoon\s+)?(?:meer\s+)?buiten(?:komen)?\b/i,
  /\byou\s+(?:just\s+)?need\s+to\s+get\s+out\s+more\b/i,
  /\bje\s+hebt\s+jezelf\s+ge[ïi]soleerd\b/i,
  /\byou\s+isolated\s+yourself\b/i,
  /\bje\s+bent\s+zwak\b/i,
  /\byou(?:'re| are)\s+weak\b/i,
  /\bje\s+moet\s+nu\s+terug\s+sociaal\b/i,
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
