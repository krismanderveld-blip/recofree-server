/**
 * FASE 9A: Core Epistemic Reasoning Engine — Pure Functions
 *
 * Deterministic reasoning layer. No runtime integration.
 * No pipeline. No prompt. No server. No provider.
 */

import type {
  EpistemicPersona,
  EpistemicClaimCategory,
  EpistemicCertainty,
  EpistemicResponsibilityOwner,
  EpistemicRiskLevel,
  EpistemicClaim,
  EpistemicResponsibilityMap,
  EpistemicAdviceGuard,
  EpistemicModelRoutingHints,
  CoreEpistemicReasoningInput,
  CoreEpistemicReasoningOutput,
} from './epistemic-reasoning-types';

// ─── Claim Extraction Patterns ─────────────────────────────────────────────────

const EMOTION_PATTERNS = /\b(ik voel|ik ben bang|ik ben boos|ik ben verdrietig|ik schaam me|ik voel me|ik ben gefrustreerd|ik ben teleurgesteld|ik ben moe|ik ben uitgeput|ik ben eenzaam|ik ben onzeker|ik ben wanhopig|i feel|i'm afraid|i'm angry|i'm sad)\b/i;
const OBSERVABLE_FACT_PATTERNS = /\b(hij zei|zij zei|hij deed|zij deed|er gebeurde|ik zag|ik hoorde|hij kwam|zij kwam|hij was|zij was|gisteren|vandaag|vorige week|hij heeft|zij heeft|hij is|zij is)\b/i;
const INTERPRETATION_PATTERNS = /\b(hij denkt|zij denkt|hij vindt|zij vindt|hij wil|zij wil|het lijkt|het voelt alsof|volgens mij|ik denk dat hij|ik denk dat zij|hij probeert|zij probeert|hij bedoelt|zij bedoelt|dat betekent dat|dus hij|dus zij)\b/i;
const CAUSAL_HYPOTHESIS_PATTERNS = /\b(omdat hij|omdat zij|daardoor|dat komt door|het is zijn schuld|het is haar schuld|als hij|als zij|door zijn|door haar|vanwege)\b/i;
const MEDICAL_CLINICAL_PATTERNS = /\b(adhd|medicatie|detox|ontwenning|cold turkey|afkicken|herstel|therapie|behandeling|psychiater|psycholoog|huisarts|dokter|arts|doctor|physician|médecin|red bull|cafeïne|suiker|slaappillen|antidepressiva|zenuwstelsel|dopamine|serotonine|verslaving.*hersen|brain|withdrawal|plots stoppen|abrupt stoppen|meteen stoppen)\b/i;
const RESPONSIBILITY_PATTERNS = /\b(hij moet|zij moet|ik moet|wij moeten|het is mijn schuld|het is zijn schuld|het is haar schuld|ik ben verantwoordelijk|hij is verantwoordelijk|zij is verantwoordelijk|ik had moeten|hij had moeten|zij had moeten)\b/i;
const ACTION_IMPULSE_PATTERNS = /\b(ik wil stoppen|ik wil weg|ik ga|ik wil drinken|ik wil gebruiken|ik wil het uitpraten|ik ga het zeggen|ik wil scheiden|ik wil vertrekken|ik wil eentje|ik wil er een einde aan)\b/i;
const SAFETY_PATTERNS = /\b(suïcide|zelfmoord|een einde aan|niet meer leven|dood|gevaar|geweld|slaan|bedreigen|mishandel|onveilig|noodgeval|112|politie|cold turkey.*zwaar|plots stoppen.*zwaar)\b/i;
const UNCERTAINTY_PATTERNS = /\b(misschien|ik weet niet|ik twijfel|het zou kunnen|wellicht|mogelijk|ik ben niet zeker|geen idee|wie weet)\b/i;
const MINDREADING_PATTERNS = /\b(hij heeft geen inzicht|zij heeft geen inzicht|hij beseft niet|zij beseft niet|hij ziet niet|zij ziet niet|hij begrijpt niet|zij begrijpt niet|hij voelt niets|zij voelt niets|het kan hem niet schelen|het kan haar niet schelen|hij geeft niet om|zij geeft niet om)\b/i;
const CRAVING_PERMISSION_PATTERNS = /\b(eentje kan geen kwaad|één keer|alleen vandaag|ik verdien het|ik heb het nodig|even ontspannen|het is maar|niemand merkt het|ik kan stoppen wanneer ik wil|ik heb controle)\b/i;
const SHAME_IDENTITY_PATTERNS = /\b(ik ben slecht|ik ben waardeloos|ik ben zwak|ik ben hopeloos|ik ben een slechte|ik deug niet|ik ben niks waard|ik ben een mislukkeling|ik verdien het niet|ik ben kapot)\b/i;
const RELATIONAL_HARM_PATTERNS = /\b(hij liegt|zij liegt|bedrog|ontrouw|vertrouwen.*kapot|vertrouwen.*weg|gelogen|weer gelogen|manipul|controle.*over mij|isoler|dreig)\b/i;
const RECOVERY_RISK_PATTERNS = /\b(terugval|hervallen|craving|trek|zuipen|gebruiken|drinken.*willen|drugs|alcohol.*nodig|spuit|snuiven|gokken.*weer)\b/i;
const PROTECTIVE_FACTOR_PATTERNS = /\b(steun|hulp|vriend|vriendin|groep|AA|NA|sponsor|therapie.*helpt|sport|wandelen|mediteren|dagboek|nuchter.*dagen|clean.*dagen)\b/i;
const RESCUE_ROLE_PATTERNS = /\b(ik moet hem redden|ik moet haar redden|zonder mij|als ik er niet ben|ik moet zorgen|ik moet oplossen|ik moet helpen|ik kan niet loslaten|hij kan het niet alleen|zij kan het niet alleen|wij moeten.*alternatieven|ik moet.*voorkomen)\b/i;

// ─── 1. buildCoreEpistemicReasoning ────────────────────────────────────────────

export function buildCoreEpistemicReasoning(input: CoreEpistemicReasoningInput): CoreEpistemicReasoningOutput {
  const text = input.normalizedMessage ?? input.userMessage;
  if (!text || text.trim().length < 3) {
    return createInactiveOutput(input.persona);
  }

  const claims = extractEpistemicClaims(text, input.persona);
  const responsibilityMap = buildResponsibilityMap(claims, input.persona);
  const adviceGuard = buildAdviceGuard(claims, responsibilityMap, input);
  const modelRoutingHints = buildModelRoutingHintsFromClaims(claims, input);
  const mustAvoidPhrases = buildMustAvoidPhrases(claims, input.persona);
  const mustPreferPhrases = buildMustPreferPhrases(claims, input.persona);
  const warnings = buildWarnings(claims);

  const output: CoreEpistemicReasoningOutput = {
    active: true,
    persona: input.persona,
    claims,
    responsibilityMap,
    adviceGuard,
    modelRoutingHints,
    mustAvoidPhrases,
    mustPreferPhrases,
    warnings,
  };

  return output;
}

// ─── 2. extractEpistemicClaims ─────────────────────────────────────────────────

export function extractEpistemicClaims(message: string, persona: EpistemicPersona): EpistemicClaim[] {
  const claims: EpistemicClaim[] = [];
  const text = message.toLowerCase();
  let claimId = 0;

  const makeClaim = (category: EpistemicClaimCategory, matchText: string): EpistemicClaim => {
    claimId++;
    const certainty = classifyClaimCertainty({ category, text: matchText } as EpistemicClaim);
    return {
      id: `ep_${claimId}`,
      persona,
      category,
      text: matchText.slice(0, 120),
      certainty,
      responsibilityOwner: inferResponsibilityOwner(category, persona),
      riskLevel: inferRiskLevel(category, text),
      shouldValidateEmotion: category === 'user_emotion',
      shouldTreatAsFact: category === 'observable_fact',
      shouldTreatAsHypothesis: ['causal_hypothesis', 'memory_hypothesis', 'user_interpretation'].includes(category),
      shouldAvoidAttribution: category === 'mindreading_risk',
      shouldAvoidMedicalCertainty: category === 'medical_or_clinical_claim',
      shouldAvoidRescueAdvice: category === 'responsibility_claim' && RESCUE_ROLE_PATTERNS.test(message),
      shouldPreferBoundaryLanguage: persona === 'kim',
      shouldPreferAgencyLanguage: persona === 'elias',
      source: 'current_message',
    };
  };

  // Order matters: safety first, then specific, then general
  if (SAFETY_PATTERNS.test(text)) claims.push(makeClaim('safety_relevant_claim', extractMatch(text, SAFETY_PATTERNS)));
  if (EMOTION_PATTERNS.test(text)) claims.push(makeClaim('user_emotion', extractMatch(text, EMOTION_PATTERNS)));
  if (MINDREADING_PATTERNS.test(text)) claims.push(makeClaim('mindreading_risk', extractMatch(text, MINDREADING_PATTERNS)));
  if (CRAVING_PERMISSION_PATTERNS.test(text)) claims.push(makeClaim('recovery_risk_claim', extractMatch(text, CRAVING_PERMISSION_PATTERNS)));
  if (SHAME_IDENTITY_PATTERNS.test(text)) claims.push(makeClaim('user_emotion', extractMatch(text, SHAME_IDENTITY_PATTERNS)));
  if (RELATIONAL_HARM_PATTERNS.test(text)) claims.push(makeClaim('relational_harm_claim', extractMatch(text, RELATIONAL_HARM_PATTERNS)));
  if (RECOVERY_RISK_PATTERNS.test(text)) claims.push(makeClaim('recovery_risk_claim', extractMatch(text, RECOVERY_RISK_PATTERNS)));
  if (MEDICAL_CLINICAL_PATTERNS.test(text)) claims.push(makeClaim('medical_or_clinical_claim', extractMatch(text, MEDICAL_CLINICAL_PATTERNS)));
  if (RESCUE_ROLE_PATTERNS.test(text)) claims.push(makeClaim('responsibility_claim', extractMatch(text, RESCUE_ROLE_PATTERNS)));
  if (RESPONSIBILITY_PATTERNS.test(text) && !RESCUE_ROLE_PATTERNS.test(text)) claims.push(makeClaim('responsibility_claim', extractMatch(text, RESPONSIBILITY_PATTERNS)));
  if (INTERPRETATION_PATTERNS.test(text)) claims.push(makeClaim('user_interpretation', extractMatch(text, INTERPRETATION_PATTERNS)));
  if (CAUSAL_HYPOTHESIS_PATTERNS.test(text)) claims.push(makeClaim('causal_hypothesis', extractMatch(text, CAUSAL_HYPOTHESIS_PATTERNS)));
  if (OBSERVABLE_FACT_PATTERNS.test(text) && !INTERPRETATION_PATTERNS.test(text)) claims.push(makeClaim('observable_fact', extractMatch(text, OBSERVABLE_FACT_PATTERNS)));
  if (ACTION_IMPULSE_PATTERNS.test(text)) claims.push(makeClaim('action_impulse', extractMatch(text, ACTION_IMPULSE_PATTERNS)));
  if (UNCERTAINTY_PATTERNS.test(text)) claims.push(makeClaim('uncertainty_marker', extractMatch(text, UNCERTAINTY_PATTERNS)));
  if (PROTECTIVE_FACTOR_PATTERNS.test(text)) claims.push(makeClaim('protective_factor_claim', extractMatch(text, PROTECTIVE_FACTOR_PATTERNS)));

  return claims;
}

// ─── 3. classifyClaimCertainty ─────────────────────────────────────────────────

export function classifyClaimCertainty(claim: Pick<EpistemicClaim, 'category' | 'text'>): EpistemicCertainty {
  switch (claim.category) {
    case 'user_emotion':
      return 'known'; // Direct own emotion = known
    case 'observable_fact':
      return 'likely'; // Observable behavior from user message = likely
    case 'mindreading_risk':
      return 'unsupported'; // Motive/inner state of other = unsupported
    case 'user_interpretation':
      return 'uncertain'; // Interpretation = uncertain
    case 'causal_hypothesis':
      return 'uncertain'; // Causal claim without evidence = uncertain
    case 'medical_or_clinical_claim':
      return 'uncertain'; // Medical/recovery causality without source = uncertain
    case 'memory_hypothesis':
      return 'plausible'; // Memory-supported pattern = plausible
    case 'memory_supported_pattern':
      return 'plausible'; // Pattern from memory = plausible unless confirmed
    case 'recovery_risk_claim':
      return CRAVING_PERMISSION_PATTERNS.test(claim.text) ? 'likely' : 'plausible';
    case 'safety_relevant_claim':
      return 'likely'; // Safety claims treated seriously
    case 'relational_harm_claim':
      return 'likely'; // Harm claims treated seriously
    case 'protective_factor_claim':
      return 'likely';
    case 'responsibility_claim':
      return 'uncertain'; // Responsibility attribution needs verification
    case 'action_impulse':
      return 'known'; // User states their own impulse
    case 'uncertainty_marker':
      return 'not_assessable';
    default:
      return 'not_assessable';
  }
}

// ─── 4. buildResponsibilityMap ─────────────────────────────────────────────────

export function buildResponsibilityMap(claims: EpistemicClaim[], persona: EpistemicPersona): EpistemicResponsibilityMap {
  const map: EpistemicResponsibilityMap = {
    userOwns: [],
    caregiverOwns: [],
    dependentPersonOwns: [],
    otherPersonOwns: [],
    treatmentTeamOwns: [],
    sharedRelationshipOwns: [],
    safetyServicesOwn: [],
    unknownOrUnclear: [],
  };

  for (const claim of claims) {
    const desc = claim.text.slice(0, 60);

    if (persona === 'kim') {
      // Kim responsibility rules
      if (claim.category === 'user_emotion') map.caregiverOwns.push(desc);
      else if (claim.category === 'safety_relevant_claim') map.safetyServicesOwn.push(desc);
      else if (claim.category === 'medical_or_clinical_claim') map.treatmentTeamOwns.push(desc);
      else if (claim.category === 'recovery_risk_claim') map.dependentPersonOwns.push(desc);
      else if (claim.category === 'responsibility_claim' && RESCUE_ROLE_PATTERNS.test(claim.text)) map.caregiverOwns.push(desc);
      else if (claim.category === 'relational_harm_claim') map.sharedRelationshipOwns.push(desc);
      else if (claim.category === 'mindreading_risk') map.unknownOrUnclear.push(desc);
      else if (claim.shouldPreferBoundaryLanguage) map.caregiverOwns.push(desc);
      else map.unknownOrUnclear.push(desc);
    } else {
      // Elias responsibility rules
      if (claim.category === 'user_emotion') map.userOwns.push(desc);
      else if (claim.category === 'safety_relevant_claim') map.safetyServicesOwn.push(desc);
      else if (claim.category === 'medical_or_clinical_claim') map.treatmentTeamOwns.push(desc);
      else if (claim.category === 'recovery_risk_claim') map.userOwns.push(desc);
      else if (claim.category === 'action_impulse') map.userOwns.push(desc);
      else if (claim.category === 'relational_harm_claim') map.sharedRelationshipOwns.push(desc);
      else if (claim.category === 'responsibility_claim') map.userOwns.push(desc);
      else if (claim.category === 'mindreading_risk') map.unknownOrUnclear.push(desc);
      else map.unknownOrUnclear.push(desc);
    }
  }

  return map;
}

// ─── 5. buildAdviceGuard ───────────────────────────────────────────────────────

export function buildAdviceGuard(
  claims: EpistemicClaim[],
  _responsibilityMap: EpistemicResponsibilityMap,
  input: CoreEpistemicReasoningInput,
): EpistemicAdviceGuard {
  const hasInterpretation = claims.some(c => c.category === 'user_interpretation' || c.category === 'causal_hypothesis');
  const hasMindreading = claims.some(c => c.category === 'mindreading_risk');
  const hasMedical = claims.some(c => c.category === 'medical_or_clinical_claim');
  const hasRescue = claims.some(c => c.shouldAvoidRescueAdvice);
  const hasCraving = claims.some(c => c.category === 'recovery_risk_claim' && CRAVING_PERMISSION_PATTERNS.test(c.text));
  const hasShame = claims.some(c => SHAME_IDENTITY_PATTERNS.test(c.text));
  const isOrangeOrRed = input.currentZone === 'orange' || input.currentZone === 'red' || input.currentZone === 'purple';
  const hasSafety = claims.some(c => c.category === 'safety_relevant_claim');

  return {
    validateEmotion: claims.some(c => c.category === 'user_emotion'),
    separateFactFromInterpretation: hasInterpretation,
    keepMultipleExplanationsOpen: hasInterpretation || hasMindreading,
    avoidMindReading: hasMindreading,
    avoidMedicalCertainty: hasMedical,
    avoidRescueRole: hasRescue,
    avoidControlAdvice: input.persona === 'kim' && hasRescue,
    preferBoundaryLanguage: input.persona === 'kim',
    preferAgencyLanguage: input.persona === 'elias',
    preferTreatmentTeamReferral: hasMedical,
    requireRegulationBeforeAnalysis: isOrangeOrRed,
    doNotUseOldMemoryAsCurrentFact: true, // Always true
    doNotTreatShameAsIdentity: hasShame,
    doNotFollowCravingStory: hasCraving,
    doNotOverrideSafety: true, // Always true — safety never overridden
  };
}

// ─── 6. buildModelRoutingHints (from claims) ───────────────────────────────────

function buildModelRoutingHintsFromClaims(claims: EpistemicClaim[], input: CoreEpistemicReasoningInput): EpistemicModelRoutingHints {
  const hasMindreading = claims.some(c => c.category === 'mindreading_risk');
  const hasMedical = claims.some(c => c.category === 'medical_or_clinical_claim');
  const hasRescue = claims.some(c => c.shouldAvoidRescueAdvice);
  const hasRelationalHarm = claims.some(c => c.category === 'relational_harm_claim');
  const hasRelapseRisk = claims.some(c => c.category === 'recovery_risk_claim');
  const hasSafety = claims.some(c => c.category === 'safety_relevant_claim');

  const epistemicComplexityScore = claims.length * 8 + (hasMindreading ? 15 : 0) + (hasMedical ? 12 : 0);
  const responsibilityComplexityScore = (hasRescue ? 25 : 0) + (hasRelationalHarm ? 20 : 0) + (claims.filter(c => c.category === 'responsibility_claim').length * 10);

  const reasonCodes: string[] = [];
  if (hasSafety) reasonCodes.push('safety_relevant');
  if (hasMedical) reasonCodes.push('medical_uncertainty');
  if (hasMindreading) reasonCodes.push('mindreading_risk');
  if (hasRescue) reasonCodes.push('rescue_role_risk');
  if (hasRelationalHarm) reasonCodes.push('relational_harm');
  if (hasRelapseRisk) reasonCodes.push('relapse_risk');
  if ((input.cmdEstimatedTokens ?? 0) > 600) reasonCodes.push('high_cmd_tokens');

  const needsFull = hasSafety || (epistemicComplexityScore >= 40) || (responsibilityComplexityScore >= 40) ||
    (input.currentZone === 'red' || input.currentZone === 'purple') ||
    (hasMedical && responsibilityComplexityScore >= 30) ||
    (hasRelapseRisk && (input.cravingLevel ?? 0) >= 7);

  return {
    epistemicComplexityScore,
    responsibilityComplexityScore,
    medicalUncertainty: hasMedical,
    mindReadingRisk: hasMindreading,
    contradictionDetected: false, // No contradiction detection in FASE 9A
    rescueRoleRisk: hasRescue,
    relapseRisk: hasRelapseRisk,
    relationalHarmRisk: hasRelationalHarm,
    safetyRelevant: hasSafety,
    recommendedModelTier: needsFull ? 'full' : 'mini',
    reasonCodes,
  };
}

// ─── 7. validateEpistemicOutput ────────────────────────────────────────────────

export function validateEpistemicOutput(output: CoreEpistemicReasoningOutput): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  if (output.active && !output.persona) errors.push('active=true but persona missing');

  for (const claim of output.claims) {
    if (!claim.category) errors.push(`claim ${claim.id} missing category`);
    if (!claim.certainty) errors.push(`claim ${claim.id} missing certainty`);
    if (claim.shouldTreatAsFact && claim.shouldTreatAsHypothesis) {
      errors.push(`claim ${claim.id} cannot be both fact and hypothesis`);
    }
    if (claim.category === 'medical_or_clinical_claim' && claim.certainty === 'known' && claim.responsibilityOwner !== 'treatment_team') {
      errors.push(`claim ${claim.id} medical claim as known without treatment_team source`);
    }
    if (claim.category === 'mindreading_risk' && claim.shouldTreatAsFact) {
      errors.push(`claim ${claim.id} mindreading cannot be treated as fact`);
    }
  }

  if (output.adviceGuard.doNotOverrideSafety === false) {
    errors.push('safety override cannot be lowered');
  }

  for (const w of output.warnings) {
    if (w.length > 200) errors.push('warning contains potentially raw personal text (too long)');
  }

  return { ok: errors.length === 0, errors };
}

// ─── 8. buildEpistemicGuidanceSummary ──────────────────────────────────────────

export function buildEpistemicGuidanceSummary(output: CoreEpistemicReasoningOutput): string {
  if (!output.active) return '';

  const parts: string[] = [];
  parts.push(`[EPISTEMIC GUIDANCE — persona: ${output.persona}]`);

  const guard = output.adviceGuard;
  if (guard.validateEmotion) parts.push('• Validate emotion before analysis');
  if (guard.separateFactFromInterpretation) parts.push('• Separate fact from interpretation');
  if (guard.avoidMindReading) parts.push('• Avoid mindreading / attributing motive');
  if (guard.avoidMedicalCertainty) parts.push('• Avoid medical certainty — refer to treatment team');
  if (guard.avoidRescueRole) parts.push('• Avoid rescue role — agency first');
  if (guard.requireRegulationBeforeAnalysis) parts.push('• Regulate first, analyze later (orange/red zone)');
  if (guard.doNotTreatShameAsIdentity) parts.push('• Shame is not identity');
  if (guard.doNotFollowCravingStory) parts.push('• Do not follow craving permission story');
  if (guard.preferBoundaryLanguage) parts.push('• Prefer boundary language');
  if (guard.preferAgencyLanguage) parts.push('• Prefer agency language');
  if (guard.preferTreatmentTeamReferral) parts.push('• Prefer treatment team referral');

  const hints = output.modelRoutingHints;
  parts.push(`• Model tier: ${hints.recommendedModelTier} (complexity: ${hints.epistemicComplexityScore}, responsibility: ${hints.responsibilityComplexityScore})`);

  if (output.mustAvoidPhrases.length > 0) {
    parts.push(`• Must avoid: ${output.mustAvoidPhrases.slice(0, 5).join('; ')}`);
  }

  const summary = parts.join('\n');
  return summary.slice(0, 1200);
}

// ─── Internal Helpers ──────────────────────────────────────────────────────────

function createInactiveOutput(persona: EpistemicPersona): CoreEpistemicReasoningOutput {
  return {
    active: false,
    persona,
    claims: [],
    responsibilityMap: { userOwns: [], caregiverOwns: [], dependentPersonOwns: [], otherPersonOwns: [], treatmentTeamOwns: [], sharedRelationshipOwns: [], safetyServicesOwn: [], unknownOrUnclear: [] },
    adviceGuard: { validateEmotion: false, separateFactFromInterpretation: false, keepMultipleExplanationsOpen: false, avoidMindReading: false, avoidMedicalCertainty: false, avoidRescueRole: false, avoidControlAdvice: false, preferBoundaryLanguage: false, preferAgencyLanguage: false, preferTreatmentTeamReferral: false, requireRegulationBeforeAnalysis: false, doNotUseOldMemoryAsCurrentFact: true, doNotTreatShameAsIdentity: false, doNotFollowCravingStory: false, doNotOverrideSafety: true },
    modelRoutingHints: { epistemicComplexityScore: 0, responsibilityComplexityScore: 0, medicalUncertainty: false, mindReadingRisk: false, contradictionDetected: false, rescueRoleRisk: false, relapseRisk: false, relationalHarmRisk: false, safetyRelevant: false, recommendedModelTier: 'mini', reasonCodes: [] },
    mustAvoidPhrases: [],
    mustPreferPhrases: [],
    warnings: [],
  };
}

function extractMatch(text: string, pattern: RegExp): string {
  const match = text.match(pattern);
  return match ? match[0] : text.slice(0, 60);
}

function inferResponsibilityOwner(category: EpistemicClaimCategory, persona: EpistemicPersona): EpistemicResponsibilityOwner {
  if (category === 'safety_relevant_claim') return 'safety_services';
  if (category === 'medical_or_clinical_claim') return 'treatment_team';
  if (category === 'user_emotion' || category === 'action_impulse') return persona === 'kim' ? 'caregiver' : 'user';
  if (category === 'recovery_risk_claim') return persona === 'kim' ? 'dependent_person' : 'user';
  if (category === 'relational_harm_claim') return 'shared_relationship';
  if (category === 'mindreading_risk') return 'unknown';
  return 'unknown';
}

function inferRiskLevel(category: EpistemicClaimCategory, text: string): EpistemicRiskLevel {
  if (category === 'safety_relevant_claim') return 'acute';
  if (category === 'recovery_risk_claim' && CRAVING_PERMISSION_PATTERNS.test(text)) return 'high';
  if (category === 'recovery_risk_claim') return 'medium';
  if (category === 'relational_harm_claim') return 'medium';
  if (category === 'medical_or_clinical_claim') return 'low';
  return 'none';
}

function buildMustAvoidPhrases(claims: EpistemicClaim[], persona: EpistemicPersona): string[] {
  const phrases: string[] = [];
  if (claims.some(c => c.category === 'mindreading_risk')) {
    phrases.push('hij/zij heeft geen inzicht');
    phrases.push('hij/zij beseft niet');
    phrases.push('hij/zij begrijpt het niet');
  }
  if (claims.some(c => c.category === 'medical_or_clinical_claim')) {
    phrases.push('dat is zeker schadelijk voor herstel');
    phrases.push('dat veroorzaakt terugval');
  }
  if (claims.some(c => c.shouldAvoidRescueAdvice)) {
    phrases.push('je moet hem/haar redden');
    phrases.push('zonder jou lukt het niet');
  }
  if (claims.some(c => SHAME_IDENTITY_PATTERNS.test(c.text))) {
    phrases.push('je bent inderdaad zwak');
    phrases.push('je hebt gefaald');
  }
  if (claims.some(c => CRAVING_PERMISSION_PATTERNS.test(c.text))) {
    phrases.push('eentje kan geen kwaad');
    phrases.push('je verdient het');
  }
  return phrases;
}

function buildMustPreferPhrases(claims: EpistemicClaim[], persona: EpistemicPersona): string[] {
  const phrases: string[] = [];
  if (claims.some(c => c.category === 'user_interpretation' || c.category === 'causal_hypothesis')) {
    phrases.push('dat is één mogelijke verklaring');
    phrases.push('er kunnen meerdere redenen zijn');
  }
  if (claims.some(c => c.category === 'mindreading_risk')) {
    phrases.push('je weet niet zeker wat de ander denkt of voelt');
    phrases.push('wat je observeert is..., wat je interpreteert is...');
  }
  if (claims.some(c => c.category === 'medical_or_clinical_claim')) {
    phrases.push('dit is iets om met je behandelteam te bespreken');
  }
  if (persona === 'elias') {
    phrases.push('wat is jouw volgende veilige stap');
  }
  if (persona === 'kim') {
    phrases.push('wat heb jij nodig om veilig aanwezig te blijven');
  }
  return phrases;
}

function buildWarnings(claims: EpistemicClaim[]): string[] {
  const warnings: string[] = [];
  if (claims.some(c => c.category === 'mindreading_risk')) warnings.push('mindreading_detected');
  if (claims.some(c => c.category === 'medical_or_clinical_claim')) warnings.push('medical_uncertainty_detected');
  if (claims.some(c => c.shouldAvoidRescueAdvice)) warnings.push('rescue_role_risk_detected');
  if (claims.some(c => CRAVING_PERMISSION_PATTERNS.test(c.text))) warnings.push('craving_permission_loop_detected');
  if (claims.some(c => SHAME_IDENTITY_PATTERNS.test(c.text))) warnings.push('shame_identity_risk_detected');
  return warnings;
}
