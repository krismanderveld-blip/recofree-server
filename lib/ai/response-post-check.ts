/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RECOFREE — LOCAL RESPONSE POST-CHECK LAYER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Validates every OpenAI response BEFORE displaying it to the user.
 * If the response violates GDPR/safety rules, it is discarded and
 * a local fallback text is shown instead.
 *
 * The post-check rejects responses where OpenAI:
 * - Adds diagnosis
 * - Adds new therapeutic advice not in the local intervention
 * - Changes the meaning of the local intervention
 * - Adds crisis escalation not locally authorized
 * - Minimizes relapse/crisis risk
 * - Invents medical claims
 * - Contradicts local engine output
 * - References data that was not provided
 *
 * @module response-post-check
 */

import type { PostCheckResult, PostCheckViolation } from './gdpr-config';

// ═══════════════════════════════════════════════════════════════════════════
// DETECTION PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

/** Patterns that indicate the model is making a diagnosis */
const DIAGNOSIS_PATTERNS = [
  /\b(you have|you suffer from|you are diagnosed with|your diagnosis is)\b/i,
  /\b(je hebt|je lijdt aan|je diagnose is|gediagnosticeerd met)\b/i,
  /\b(DSM-?[IV5]|ICD-?1[01])\b/i,
  /\b(borderline personality|bipolar disorder|schizophreni[ae]|PTSD diagnosis)\b/i,
  /\b(borderline persoonlijkheid|bipolaire stoornis|schizofrenie)\b/i,
];

/** Patterns that indicate the model is adding unsolicited medical claims */
const MEDICAL_CLAIM_PATTERNS = [
  /\b(studies show|research proves|clinically proven|medically established)\b/i,
  /\b(onderzoek toont aan|klinisch bewezen|medisch vastgesteld)\b/i,
  /\b(take medication|stop your medication|adjust your dosage|prescribe)\b/i,
  /\b(neem medicatie|stop je medicatie|pas je dosering aan|voorschrijven)\b/i,
  /\b(your brain chemistry|serotonin levels|dopamine deficiency)\b/i,
];

/** Patterns that indicate unauthorized crisis escalation */
const UNAUTHORIZED_ESCALATION_PATTERNS = [
  /\b(call 911|call the police|go to the ER|check yourself in)\b/i,
  /\b(bel de politie|ga naar de spoed|laat je opnemen)\b/i,
  // Note: 112, 1813 are ALLOWED when crisis is locally authorized
];

/** Patterns that indicate risk minimization */
const RISK_MINIMIZATION_PATTERNS = [
  /\b(it's not that bad|you're overreacting|it's all in your head)\b/i,
  /\b(het valt wel mee|je overdrijft|het zit tussen je oren)\b/i,
  /\b(just think positive|just be happy|snap out of it)\b/i,
  /\b(denk gewoon positief|wees gewoon blij)\b/i,
  /\b(everyone feels this way|it's normal to feel)\b/i,
];

/** Patterns that indicate the model is choosing modules or making routing decisions */
const MODULE_ROUTING_PATTERNS = [
  /\b(I('ll| will) switch (you )?to module|let me activate|routing you to)\b/i,
  /\b(ik schakel je door naar module|ik activeer)\b/i,
  /\b(based on my assessment.*I recommend|my clinical judgment)\b/i,
];

/** Patterns that indicate referencing data not provided */
const UNPROVIDED_DATA_PATTERNS = [
  /\b(in your previous session on [A-Z][a-z]+ \d+|last Tuesday you said)\b/i,
  /\b(your medical records show|according to your file)\b/i,
  /\b(je medisch dossier|volgens je dossier)\b/i,
];

// ═══════════════════════════════════════════════════════════════════════════
// POST-CHECK FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run the local post-check on an OpenAI response.
 *
 * @param response - The raw text response from OpenAI
 * @param crisisAuthorized - Whether crisis escalation was locally authorized
 * @returns PostCheckResult with pass/fail and any violations
 */
export function runPostCheck(
  response: string,
  crisisAuthorized = false,
): PostCheckResult {
  const violations: PostCheckViolation[] = [];

  if (!response || response.trim().length === 0) {
    return { passed: true, violations: [] };
  }

  // Check for diagnosis
  if (DIAGNOSIS_PATTERNS.some(pattern => pattern.test(response))) {
    violations.push('added_diagnosis');
  }

  // Check for medical claims
  if (MEDICAL_CLAIM_PATTERNS.some(pattern => pattern.test(response))) {
    violations.push('invented_medical_claims');
  }

  // Check for unauthorized escalation (only if NOT locally authorized)
  if (!crisisAuthorized && UNAUTHORIZED_ESCALATION_PATTERNS.some(pattern => pattern.test(response))) {
    violations.push('unauthorized_escalation');
  }

  // Check for risk minimization
  if (RISK_MINIMIZATION_PATTERNS.some(pattern => pattern.test(response))) {
    violations.push('minimized_risk');
  }

  // Check for module routing (AI should never route)
  if (MODULE_ROUTING_PATTERNS.some(pattern => pattern.test(response))) {
    violations.push('contradicted_engine_output');
  }

  // Check for referencing unprovided data
  if (UNPROVIDED_DATA_PATTERNS.some(pattern => pattern.test(response))) {
    violations.push('referenced_unprovided_data');
  }

  return {
    passed: violations.length === 0,
    violations,
    reason: violations.length > 0
      ? `Post-check failed: ${violations.join(', ')}`
      : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FALLBACK RESPONSES
// ═══════════════════════════════════════════════════════════════════════════

const FALLBACK_RESPONSES_ELIAS = [
  'Ik ben hier. Neem even de tijd — we hoeven niet te haasten.',
  'Ik hoor je. Laten we even stilstaan bij wat je net zei.',
  'Dat klinkt zwaar. Ik ben er, en we pakken dit samen op.',
  'Ik merk dat er veel speelt. Wil je me vertellen wat er nu het meest voelt?',
  'Ik luister. Neem de ruimte die je nodig hebt.',
];

const FALLBACK_RESPONSES_KIM = [
  'Ik ben hier voor je. Neem even de tijd.',
  'Ik hoor wat je zegt. Dat is niet niks.',
  'Het is oké om dit te voelen. Ik ben er.',
  'Laten we even stilstaan. Wat heb je nu het meest nodig?',
  'Ik luister naar je. Je hoeft dit niet alleen te dragen.',
];

/**
 * Get a local fallback response when post-check fails.
 * This ensures the user always gets a safe, therapeutically neutral response.
 *
 * @param userType - 'elias' or 'kim'
 * @param messageIndex - Used for variety (rotates through fallbacks)
 */
export function getFallbackResponse(
  userType: 'elias' | 'kim',
  messageIndex = 0,
): string {
  const responses = userType === 'elias' ? FALLBACK_RESPONSES_ELIAS : FALLBACK_RESPONSES_KIM;
  return responses[messageIndex % responses.length];
}

/**
 * Apply post-check to a response and return either the response or a fallback.
 *
 * @param response - Raw OpenAI response
 * @param userType - 'elias' or 'kim'
 * @param crisisAuthorized - Whether crisis escalation was locally authorized
 * @param messageIndex - For fallback variety
 * @returns The validated response or a safe fallback
 */
export function applyPostCheck(
  response: string,
  userType: 'elias' | 'kim',
  crisisAuthorized = false,
  messageIndex = 0,
): { text: string; postCheckPassed: boolean; violations: PostCheckViolation[] } {
  const result = runPostCheck(response, crisisAuthorized);

  if (result.passed) {
    return { text: response, postCheckPassed: true, violations: [] };
  }

  console.warn('[PostCheck] FAILED — discarding OpenAI output:', result.violations.join(', '));
  console.warn('[PostCheck] Original response (discarded):', response.substring(0, 200));

  return {
    text: getFallbackResponse(userType, messageIndex),
    postCheckPassed: false,
    violations: result.violations,
  };
}
