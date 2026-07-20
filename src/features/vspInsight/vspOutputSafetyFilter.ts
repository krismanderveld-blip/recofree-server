/**
 * VSP Insight Output Safety Filter
 *
 * Post-GPT output filter that ensures the VSP Insight System's prompt injections
 * do NOT cause the AI to violate safety boundaries.
 *
 * This filter runs AFTER the GPT response is received and BEFORE it is shown to the user.
 * It checks for:
 * 1. Clinical terminology leakage (schema/mode names, DSM labels, percentages)
 * 2. Diagnostic language (diagnosis, disorder, pathology)
 * 3. Framework disclosure (MI/MBT/DGT method names exposed to user)
 * 4. Discrepancy disclosure (silent discrepancy should NEVER be communicated)
 * 5. Store violation markers (GPT referencing stored insight data)
 *
 * RULES:
 * - NEVER blocks the response entirely (that would be worse than a minor leak)
 * - Flags violations for logging/monitoring
 * - In clinical mode: all checks are RELAXED (clinician sees everything)
 * - Does NOT modify the response text (read-only audit)
 * - Returns a safety report with violation details
 *
 * CRITICAL: This is a MONITORING layer, not a censorship layer.
 * The actual prevention happens in the prompt (NOOIT ZEGGEN rules).
 * This filter catches failures for quality improvement.
 */

import type { VspInsightState, VspTherapeuticFramework } from "./vspInsightTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VspOutputSafetyInput {
  /** The GPT response text to audit */
  responseText: string;
  /** Whether clinical mode is active (relaxes all checks) */
  clinicalModeActive: boolean;
  /** The active VSP Insight state (for context-aware checks) */
  insightState: VspInsightState | null;
  /** The selected framework (should never be disclosed to user) */
  framework: VspTherapeuticFramework | null;
  /** User type for persona-specific checks */
  persona: "elias" | "kim";
}

export interface VspOutputSafetyViolation {
  /** Violation category */
  category:
    | "clinical_terminology"
    | "diagnostic_language"
    | "framework_disclosure"
    | "discrepancy_disclosure"
    | "store_violation"
    | "percentage_leak"
    | "schema_mode_naming";
  /** Severity: low = minor wording issue, medium = concerning, high = safety rule broken */
  severity: "low" | "medium" | "high";
  /** The matched text fragment */
  matchedText: string;
  /** Human-readable explanation */
  explanation: string;
  /** Which safety rule was violated */
  ruleRef: string;
}

export interface VspOutputSafetyResult {
  /** Whether any violations were found */
  hasViolations: boolean;
  /** Total violation count */
  violationCount: number;
  /** Maximum severity found */
  maxSeverity: "none" | "low" | "medium" | "high";
  /** Individual violations */
  violations: VspOutputSafetyViolation[];
  /** Safety rules that were applied */
  rulesApplied: string[];
  /** Whether clinical mode relaxed the checks */
  clinicalModeRelaxed: boolean;
}

// ─── Safety Rules ─────────────────────────────────────────────────────────────

/** Clinical terminology that should NEVER appear in non-clinical responses */
const CLINICAL_TERMS: Array<{ pattern: RegExp; severity: "low" | "medium" | "high"; rule: string }> = [
  // Schema names (Dutch + English)
  { pattern: /\b(?:verlating|emotionele verwaarlozing|wantrouwen|sociaal isolement|afhankelijkheid|kwetsbaarheid|verstrengeling|mislukking|veeleisendheid|onvoldoende zelfcontrole|onderwerping|zelfopoffering|goedkeuring zoeken|negativiteit|emotionele inhibitie|strenge normen|bestraffendheid)\b/gi, severity: "high", rule: "SCHEMA_NAME_NL" },
  { pattern: /\b(?:abandonment|emotional deprivation|mistrust|social isolation|dependence|vulnerability|enmeshment|failure|entitlement|insufficient self-control|subjugation|self-sacrifice|approval-seeking|negativity|emotional inhibition|unrelenting standards|punitiveness)\b/gi, severity: "medium", rule: "SCHEMA_NAME_EN" },
  // Mode names
  { pattern: /\b(?:kwetsbaar kind|boos kind|ongedisciplineerd kind|gelukkig kind|afstandelijke beschermer|straffende ouder|veeleisende ouder|gezonde volwassene)\b/gi, severity: "high", rule: "MODE_NAME_NL" },
  { pattern: /\b(?:vulnerable child|angry child|undisciplined child|happy child|detached protector|punitive parent|demanding parent|healthy adult)\b/gi, severity: "medium", rule: "MODE_NAME_EN" },
  // DSM/diagnostic labels
  { pattern: /\b(?:DSM|ICD-10|persoonlijkheidsstoornis|borderline|narcistisch|antisociaal|afhankelijke persoonlijkheid|vermijdende persoonlijkheid)\b/gi, severity: "high", rule: "DSM_LABEL" },
];

/** Framework names that should not be disclosed to non-clinical users */
const FRAMEWORK_DISCLOSURE_PATTERNS: Array<{ pattern: RegExp; severity: "low" | "medium" | "high"; rule: string }> = [
  { pattern: /\b(?:motiverende gespreksvoering|motivational interviewing)\b/gi, severity: "low", rule: "FRAMEWORK_MI" },
  { pattern: /\b(?:mentaliseren|mentalization-based|MBT)\b/gi, severity: "medium", rule: "FRAMEWORK_MBT" },
  { pattern: /\b(?:dialectische gedragstherapie|dialectical behavior|DGT|DBT)\b/gi, severity: "medium", rule: "FRAMEWORK_DGT" },
  { pattern: /\bVSP.?Insight\b/gi, severity: "high", rule: "SYSTEM_NAME_LEAK" },
];

/** Discrepancy disclosure patterns (silent discrepancy should NEVER be communicated) */
const DISCREPANCY_PATTERNS: Array<{ pattern: RegExp; severity: "low" | "medium" | "high"; rule: string }> = [
  { pattern: /\b(?:discrepantie|discrepancy)\b.*\b(?:gedetecteerd|detected|opgemerkt|noticed)\b/gi, severity: "high", rule: "DISCREPANCY_DIRECT" },
  { pattern: /\b(?:je zegt.*groen.*maar|you say.*green.*but)\b/gi, severity: "medium", rule: "DISCREPANCY_INDIRECT" },
  { pattern: /\b(?:rationeel groen|rational green)\b/gi, severity: "high", rule: "RATIONAL_GREEN_TERM" },
  { pattern: /\b(?:silent.*discrepancy|stille.*discrepantie)\b/gi, severity: "high", rule: "SILENT_DISCREPANCY" },
];

/** Store violation patterns (GPT should never reference stored insight data) */
const STORE_VIOLATION_PATTERNS: Array<{ pattern: RegExp; severity: "low" | "medium" | "high"; rule: string }> = [
  { pattern: /\b(?:uit je profiel|from your profile|in je dossier|in your file)\b/gi, severity: "medium", rule: "PROFILE_REFERENCE" },
  { pattern: /\b(?:mijn systeem|my system|het systeem|the system)\s+(?:ziet|sees|detecteert|detects)\b/gi, severity: "high", rule: "SYSTEM_DETECTION_CLAIM" },
  { pattern: /\b(?:volgens mijn analyse|according to my analysis)\b/gi, severity: "medium", rule: "ANALYSIS_CLAIM" },
];

/** Percentage/confidence leak patterns */
const PERCENTAGE_PATTERNS: Array<{ pattern: RegExp; severity: "low" | "medium" | "high"; rule: string }> = [
  { pattern: /\b\d{1,3}%\s*(?:kans|chance|waarschijnlijk|likely|confidence|zekerheid)\b/gi, severity: "high", rule: "CONFIDENCE_PERCENTAGE" },
  { pattern: /\b(?:confidence|betrouwbaarheid)\s*[:=]\s*\d/gi, severity: "high", rule: "CONFIDENCE_SCORE" },
];

// ─── Main Filter Function ─────────────────────────────────────────────────────

/**
 * Audits a GPT response for VSP Insight safety violations.
 * Returns a safety report — does NOT modify the response.
 *
 * In clinical mode, all checks are relaxed (returns empty violations).
 */
export function auditVspOutputSafety(input: VspOutputSafetyInput): VspOutputSafetyResult {
  const rulesApplied: string[] = [];

  // Clinical mode: all checks relaxed
  if (input.clinicalModeActive) {
    return {
      hasViolations: false,
      violationCount: 0,
      maxSeverity: "none",
      violations: [],
      rulesApplied: ["CLINICAL_MODE_BYPASS"],
      clinicalModeRelaxed: true,
    };
  }

  const violations: VspOutputSafetyViolation[] = [];
  const text = input.responseText;

  // 1. Clinical terminology check
  rulesApplied.push("CLINICAL_TERMINOLOGY");
  for (const rule of CLINICAL_TERMS) {
    const matches = text.matchAll(rule.pattern);
    for (const match of matches) {
      violations.push({
        category: "clinical_terminology",
        severity: rule.severity,
        matchedText: match[0],
        explanation: `Clinical term "${match[0]}" found in non-clinical response`,
        ruleRef: rule.rule,
      });
    }
  }

  // 2. Framework disclosure check
  rulesApplied.push("FRAMEWORK_DISCLOSURE");
  for (const rule of FRAMEWORK_DISCLOSURE_PATTERNS) {
    const matches = text.matchAll(rule.pattern);
    for (const match of matches) {
      violations.push({
        category: "framework_disclosure",
        severity: rule.severity,
        matchedText: match[0],
        explanation: `Framework name "${match[0]}" disclosed to user`,
        ruleRef: rule.rule,
      });
    }
  }

  // 3. Discrepancy disclosure check
  rulesApplied.push("DISCREPANCY_DISCLOSURE");
  for (const rule of DISCREPANCY_PATTERNS) {
    const matches = text.matchAll(rule.pattern);
    for (const match of matches) {
      violations.push({
        category: "discrepancy_disclosure",
        severity: rule.severity,
        matchedText: match[0],
        explanation: `Discrepancy information leaked: "${match[0]}"`,
        ruleRef: rule.rule,
      });
    }
  }

  // 4. Store violation check
  rulesApplied.push("STORE_VIOLATION");
  for (const rule of STORE_VIOLATION_PATTERNS) {
    const matches = text.matchAll(rule.pattern);
    for (const match of matches) {
      violations.push({
        category: "store_violation",
        severity: rule.severity,
        matchedText: match[0],
        explanation: `Store/profile reference found: "${match[0]}"`,
        ruleRef: rule.rule,
      });
    }
  }

  // 5. Percentage/confidence leak check
  rulesApplied.push("PERCENTAGE_LEAK");
  for (const rule of PERCENTAGE_PATTERNS) {
    const matches = text.matchAll(rule.pattern);
    for (const match of matches) {
      violations.push({
        category: "percentage_leak",
        severity: rule.severity,
        matchedText: match[0],
        explanation: `Confidence/percentage leaked: "${match[0]}"`,
        ruleRef: rule.rule,
      });
    }
  }

  // 6. Schema/mode naming check (direct naming like "je hebt schema X")
  rulesApplied.push("SCHEMA_MODE_NAMING");
  const directNamingPatterns = [
    /\bje\s+(?:hebt|heeft)\s+(?:schema|modus)\s+/gi,
    /\bjouw\s+(?:schema|modus)\s+(?:is|heet)\b/gi,
    /\b(?:schema|modus)\s+['"]?[A-Z]/g,
  ];
  for (const pattern of directNamingPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      violations.push({
        category: "schema_mode_naming",
        severity: "high",
        matchedText: match[0],
        explanation: `Direct schema/mode naming to user: "${match[0]}"`,
        ruleRef: "DIRECT_NAMING",
      });
    }
  }

  // Determine max severity
  let maxSeverity: "none" | "low" | "medium" | "high" = "none";
  for (const v of violations) {
    if (v.severity === "high") { maxSeverity = "high"; break; }
    if (v.severity === "medium" && maxSeverity !== "high") maxSeverity = "medium";
    if (v.severity === "low" && maxSeverity === "none") maxSeverity = "low";
  }

  return {
    hasViolations: violations.length > 0,
    violationCount: violations.length,
    maxSeverity,
    violations,
    rulesApplied,
    clinicalModeRelaxed: false,
  };
}

/**
 * Quick check — returns true if the response has HIGH severity violations.
 * Use this for fast-path decisions (e.g., whether to log a warning).
 */
export function hasHighSeverityViolation(input: VspOutputSafetyInput): boolean {
  if (input.clinicalModeActive) return false;
  const result = auditVspOutputSafety(input);
  return result.maxSeverity === "high";
}
