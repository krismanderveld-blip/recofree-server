/**
 * Kim Relapse Cluster Output Safety Filter
 * Post-processes GPT output to reject/flag rescue, control, diagnosis, and legal advice language.
 * This is a deterministic filter — GPT never overrides it.
 */

export interface SafetyFilterResult {
  passed: boolean;
  violations: SafetyViolation[];
  filteredOutput: string;
}

export interface SafetyViolation {
  ruleId: string;
  category: 'rescue' | 'control' | 'diagnosis' | 'legal' | 'physical_intervention' | 'wrong_number';
  matchedPhrase: string;
  severity: 'block' | 'warn';
}

interface FilterRule {
  ruleId: string;
  category: SafetyViolation['category'];
  pattern: RegExp;
  severity: 'block' | 'warn';
}

const SAFETY_RULES: FilterRule[] = [
  // Rescue language
  { ruleId: 'rescue_save', category: 'rescue', pattern: /\b(je\s+moet\s+(hem|haar)\s+redden|you\s+must\s+save\s+(him|her)|il\s+faut\s+l[ea]\s+sauver)\b/i, severity: 'block' },
  { ruleId: 'rescue_fix', category: 'rescue', pattern: /\b(je\s+kunt\s+(hem|haar)\s+genezen|you\s+can\s+(fix|cure)\s+(him|her)|tu\s+peux\s+l[ea]\s+gu[eé]rir)\b/i, severity: 'block' },
  { ruleId: 'rescue_responsibility', category: 'rescue', pattern: /\b(het\s+is\s+jouw\s+verantwoordelijkheid\s+om|it'?s\s+your\s+responsibility\s+to|c'est\s+ta\s+responsabilit[eé]\s+de)\b/i, severity: 'block' },
  { ruleId: 'rescue_only_you', category: 'rescue', pattern: /\b(alleen\s+jij\s+kunt|only\s+you\s+can\s+save|seul[e]?\s+toi\s+peu[xt]\s+sauver)\b/i, severity: 'block' },

  // Control language
  { ruleId: 'control_hide', category: 'control', pattern: /\b(verstop\s+de\s+drank|hide\s+the\s+(alcohol|drugs|bottles)|cache\s+l'alcool)\b/i, severity: 'block' },
  { ruleId: 'control_follow', category: 'control', pattern: /\b(volg\s+(hem|haar)|follow\s+(him|her)|suis-l[ea])\b/i, severity: 'block' },
  { ruleId: 'control_spy', category: 'control', pattern: /\b(bespioneer|check\s+(zijn|haar)\s+telefoon|spy\s+on|check\s+(his|her)\s+phone|v[eé]rifie\s+son\s+t[eé]l[eé]phone)\b/i, severity: 'block' },
  { ruleId: 'control_ultimatum', category: 'control', pattern: /\b(geef\s+(hem|haar)\s+een\s+ultimatum|give\s+(him|her)\s+an\s+ultimatum|donne-lui\s+un\s+ultimatum)\b/i, severity: 'block' },
  { ruleId: 'control_lock', category: 'control', pattern: /\b(sluit\s+(hem|haar)\s+op|lock\s+(him|her)\s+(up|in)|enferme-l[ea])\b/i, severity: 'block' },

  // Physical intervention
  { ruleId: 'physical_stop', category: 'physical_intervention', pattern: /\b(houd\s+(hem|haar)\s+fysiek\s+tegen|physically\s+stop\s+(him|her)|arr[eê]te-l[ea]\s+physiquement)\b/i, severity: 'block' },
  { ruleId: 'physical_force', category: 'physical_intervention', pattern: /\b(gebruik\s+geweld|use\s+force|utilise\s+la\s+force)\b/i, severity: 'block' },
  { ruleId: 'physical_restrain', category: 'physical_intervention', pattern: /\b(bind\s+(hem|haar)\s+vast|restrain\s+(him|her)|attache-l[ea])\b/i, severity: 'block' },

  // Diagnosis
  { ruleId: 'diagnosis_is', category: 'diagnosis', pattern: /\b((hij|zij)\s+is\s+(een\s+)?(alcoholist|verslaafde|junkie)|(he|she)\s+is\s+(an?\s+)?(alcoholic|addict|junkie)|(il|elle)\s+est\s+(un[e]?\s+)?(alcoolique|toxicomane))\b/i, severity: 'block' },
  { ruleId: 'diagnosis_has', category: 'diagnosis', pattern: /\b((hij|zij)\s+heeft\s+(een\s+)?stoornis|(he|she)\s+has\s+(a\s+)?disorder|(il|elle)\s+a\s+un\s+trouble)\b/i, severity: 'block' },
  { ruleId: 'diagnosis_clinical', category: 'diagnosis', pattern: /\b(de\s+diagnose\s+is|the\s+diagnosis\s+is|le\s+diagnostic\s+est)\b/i, severity: 'block' },

  // Legal advice
  { ruleId: 'legal_divorce', category: 'legal', pattern: /\b(je\s+moet\s+scheiden|you\s+should\s+divorce|tu\s+devrais\s+divorcer)\b/i, severity: 'block' },
  { ruleId: 'legal_custody', category: 'legal', pattern: /\b(vraag\s+het\s+hoederecht|file\s+for\s+custody|demande\s+la\s+garde)\b/i, severity: 'block' },
  { ruleId: 'legal_report', category: 'legal', pattern: /\b(doe\s+aangifte|file\s+a\s+report|porte\s+plainte)\b/i, severity: 'warn' },

  // Wrong crisis number (1813 should never appear)
  { ruleId: 'wrong_number_1813', category: 'wrong_number', pattern: /\b1813\b/, severity: 'block' },
];

/**
 * Run the output safety filter on GPT-generated text.
 * Returns passed=true if no blocking violations found.
 */
export function filterKimRelapseClusterOutput(gptOutput: string): SafetyFilterResult {
  const violations: SafetyViolation[] = [];

  for (const rule of SAFETY_RULES) {
    const match = rule.pattern.exec(gptOutput);
    if (match) {
      violations.push({
        ruleId: rule.ruleId,
        category: rule.category,
        matchedPhrase: match[0],
        severity: rule.severity,
      });
    }
  }

  const hasBlockingViolation = violations.some(v => v.severity === 'block');

  return {
    passed: !hasBlockingViolation,
    violations,
    filteredOutput: hasBlockingViolation ? '' : gptOutput,
  };
}

/**
 * Get all safety rule IDs for testing purposes.
 */
export function getSafetyRuleIds(): string[] {
  return SAFETY_RULES.map(r => r.ruleId);
}
