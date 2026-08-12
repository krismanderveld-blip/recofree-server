/**
 * DIST01 Test Result Analyzer
 * FASE 9E: Pure classification — no runtime, no writeback, no mutation
 */

import type {
  Dist01FailureCategory,
  Dist01RecommendedAction,
  Dist01TargetLayer,
  Dist01QualityScenarioInput,
  Dist01TestResultAnalysis,
  Dist01BatchQualityAnalysis,
  Dist01BatchRecommendedNextPhase,
} from './dist01-test-result-analyzer-types';

// ─── DOMAIN KEYWORDS ───
const DOMAIN_KEYWORDS: Record<string, RegExp> = {
  craving: /craving|gebruik|drinken|middel|alcohol|drugs|zucht/i,
  relapse_risk: /terugval|relapse|herval|risico.*gebruik/i,
  shame: /schaam|schuld|zwak|faal|waardeloos|hopeloos/i,
  recovery_agency: /herstel|nuchter|agency|eigen.*kracht|stap/i,
  medical_uncertainty: /medisch|arts|dokter|medicijn|ontwenning|detox|cold.?turkey/i,
  responsibility_boundary: /verantwoordelijkheid|grens|boundary|zijn.*probleem|haar.*probleem/i,
  rescue_role: /redder|overnemen|plan.*maken.*voor|stoppen.*voor|controleren/i,
  mindreading: /inzicht|weet.*niet|begrijpt.*niet|ziet.*niet|denkt.*niet/i,
  relational_harm: /leugen|bedrog|vertrouwen.*breuk|misbruik|geweld|agressie/i,
  self_loss: /zelfverlies|verdwijn|alleen.*voor.*ander|geen.*eigen.*leven/i,
  safety: /veiligheid|gevaar|crisis|suicid|zelfmoord|agressie|dreig/i,
  crisis: /crisis|einde.*maken|niet.*meer.*willen|suicid/i,
  contradiction: /contradictie|tegenspr|eerder.*gezegd|vorige.*keer/i,
  stale_memory: /oud|verouderd|stale|lang.*geleden|maanden.*terug/i,
  persona_separation: /persona|leakage|elias.*kim|kim.*elias|verkeerde.*coach/i,
  raw_memory: /raw.*memory|backpack.*dump|user\.dat|state\.dat/i,
};

// ─── FAILURE DETECTION KEYWORDS ───
const FAILURE_KEYWORDS: Record<Dist01FailureCategory, RegExp> = {
  hypothesis_promoted_to_fact: /hypothese.*feit|aanname.*feit|veronderstelling.*waar/i,
  interpretation_treated_as_fact: /interpretatie.*feit|mening.*feit|indruk.*waar/i,
  mindreading: /mindread|gedachten.*lezen|weet.*wat.*denkt|geen.*inzicht/i,
  rescue_role_advice: /redders?rol|overnemen|plan.*voor.*hem|stoppen.*voor/i,
  responsibility_misattribution: /verantwoordelijkheid.*verkeerd|schuld.*verkeerd|blame/i,
  medical_certainty_overclaim: /medisch.*zeker|diagnose.*zonder|behandel.*advies/i,
  stale_memory_overweighted: /verouderd.*zwaar|oud.*geheugen|stale.*weight/i,
  contradiction_ignored: /contradictie.*genegeerd|tegenspr.*genegeerd/i,
  persona_leakage: /persona.*leak|elias.*in.*kim|kim.*in.*elias|verkeerde.*persona/i,
  raw_memory_risk: /raw.*memory|dump.*zichtbaar|backpack.*zichtbaar/i,
  safety_underweighted: /veiligheid.*onderschat|safety.*missed|crisis.*gemist/i,
  false_positive_pattern: /false.*positive|onterecht.*herkend|vals.*alarm/i,
  false_negative_pattern: /false.*negative|niet.*herkend|gemist.*patroon/i,
  confidence_too_high: /confidence.*hoog|zekerheid.*overdreven|te.*zeker/i,
  confidence_too_low: /confidence.*laag|zekerheid.*te.*laag|onderschat/i,
  unsupported_recovery_claim: /herstel.*claim.*zonder|recovery.*unsupported/i,
  unsupported_relational_claim: /relatie.*claim.*zonder|relational.*unsupported/i,
  shame_identity_reinforced: /schaamte.*identiteit|zwak.*bevestigd|faal.*bevestigd/i,
  craving_story_followed: /craving.*gevolgd|toestemming|permission.*loop.*gevolgd/i,
  user_emotion_not_validated: /emotie.*niet.*gevalideerd|gevoel.*genegeerd/i,
};

// ─── FUNCTION 1: analyzeDist01TestResult ───
export function analyzeDist01TestResult(input: Dist01QualityScenarioInput): Dist01TestResultAnalysis {
  const failureCategories: Dist01FailureCategory[] = [];
  const notes: string[] = [];
  const warnings: string[] = [];

  // Pass with high score = no change needed
  if (input.pass && (input.score ?? 10) >= 9) {
    return {
      scenarioId: input.scenarioId,
      persona: input.persona,
      pass: true,
      failureCategories: [],
      recommendedActions: ['no_dist01_change_needed'],
      targetLayers: ['none'],
      affectedDomains: determineAffectedDomains(input),
      shouldModifyDetection: false,
      shouldModifyPromotion: false,
      shouldModifyDecay: false,
      shouldModifyContradiction: false,
      shouldModifyPromptUsePermission: false,
      shouldModifyPersonaFilter: false,
      shouldModifySafetyPriority: false,
      notes: ['Scenario passed with high quality score'],
      warnings: [],
    };
  }

  // Detect failure categories from observed behavior and tags
  const searchText = [
    ...input.observedBehavior,
    ...(input.tags ?? []),
    ...(input.pass ? [] : input.expectedBehavior.map(e => `expected:${e}`)),
  ].join(' ');

  for (const [category, regex] of Object.entries(FAILURE_KEYWORDS)) {
    if (regex.test(searchText)) {
      failureCategories.push(category as Dist01FailureCategory);
    }
  }

  // If failed but no category detected, add warning
  if (!input.pass && failureCategories.length === 0) {
    warnings.push('Failed scenario without clear failure category detected');
  }

  // Build recommended actions and target layers
  const recommendedActions: Dist01RecommendedAction[] = [];
  const targetLayers: Dist01TargetLayer[] = [];

  for (const cat of failureCategories) {
    recommendedActions.push(...mapFailureToRecommendedActions(cat));
    targetLayers.push(...mapFailureToTargetLayers(cat, input.persona, input.tags ?? []));
  }

  // Deduplicate
  const uniqueActions = [...new Set(recommendedActions)];
  const uniqueLayers = [...new Set(targetLayers)];

  // Determine shouldModify flags
  const shouldModifyDetection = failureCategories.some(c =>
    ['false_positive_pattern', 'false_negative_pattern'].includes(c));
  const shouldModifyPromotion = failureCategories.some(c =>
    ['confidence_too_high', 'confidence_too_low', 'hypothesis_promoted_to_fact'].includes(c));
  const shouldModifyDecay = failureCategories.some(c =>
    ['stale_memory_overweighted'].includes(c));
  const shouldModifyContradiction = failureCategories.some(c =>
    ['contradiction_ignored'].includes(c));
  const shouldModifyPromptUsePermission = failureCategories.some(c =>
    ['raw_memory_risk', 'hypothesis_promoted_to_fact', 'medical_certainty_overclaim'].includes(c));
  const shouldModifyPersonaFilter = failureCategories.some(c =>
    ['persona_leakage'].includes(c));
  const shouldModifySafetyPriority = failureCategories.some(c =>
    ['safety_underweighted'].includes(c));

  // Privacy: no raw user input in notes/warnings
  if (failureCategories.length > 0) {
    notes.push(`Detected ${failureCategories.length} failure categories`);
  }

  return {
    scenarioId: input.scenarioId,
    persona: input.persona,
    pass: input.pass,
    failureCategories,
    recommendedActions: uniqueActions.length > 0 ? uniqueActions : ['no_dist01_change_needed'],
    targetLayers: uniqueLayers.length > 0 ? uniqueLayers : ['none'],
    affectedDomains: determineAffectedDomains(input),
    shouldModifyDetection,
    shouldModifyPromotion,
    shouldModifyDecay,
    shouldModifyContradiction,
    shouldModifyPromptUsePermission,
    shouldModifyPersonaFilter,
    shouldModifySafetyPriority,
    notes,
    warnings,
  };
}

// ─── FUNCTION 2: analyzeDist01TestBatch ───
export function analyzeDist01TestBatch(inputs: Dist01QualityScenarioInput[]): Dist01BatchQualityAnalysis {
  const analyses = inputs.map(analyzeDist01TestResult);
  const passedScenarios = analyses.filter(a => a.pass).length;
  const failedScenarios = analyses.filter(a => !a.pass).length;

  // Count recurrent failure categories (appearing 2+ times)
  const categoryCounts = new Map<Dist01FailureCategory, number>();
  for (const a of analyses) {
    for (const cat of a.failureCategories) {
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    }
  }
  const recurrentFailureCategories = [...categoryCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([cat]) => cat);

  // Determine recommended next phase (priority order)
  let recommendedNextPhase: Dist01BatchRecommendedNextPhase = 'no_dist01_change_needed';

  const hasSafety = analyses.some(a => a.failureCategories.includes('safety_underweighted'));
  const hasPersonaLeakage = analyses.some(a => a.failureCategories.includes('persona_leakage'));
  const contradictionCount = categoryCounts.get('contradiction_ignored') ?? 0;
  const staleCount = categoryCounts.get('stale_memory_overweighted') ?? 0;
  const confidenceHighCount = categoryCounts.get('confidence_too_high') ?? 0;
  const confidenceLowCount = categoryCounts.get('confidence_too_low') ?? 0;

  // Priority: safety > persona > contradiction > confidence > decay > none
  if (hasSafety) {
    recommendedNextPhase = 'safety_priority_patch';
  } else if (hasPersonaLeakage) {
    recommendedNextPhase = 'persona_filter_patch';
  } else if (contradictionCount >= 2) {
    recommendedNextPhase = 'contradiction_resolution';
  } else if ((confidenceHighCount + confidenceLowCount) >= 2) {
    recommendedNextPhase = 'confidence_promotion';
  } else if (staleCount >= 2) {
    recommendedNextPhase = 'decay_stale_cleanup';
  }

  return {
    totalScenarios: inputs.length,
    passedScenarios,
    failedScenarios,
    recurrentFailureCategories,
    recommendedNextPhase,
    analyses,
  };
}

// ─── FUNCTION 3: mapFailureToRecommendedActions ───
export function mapFailureToRecommendedActions(category: Dist01FailureCategory): Dist01RecommendedAction[] {
  const map: Record<Dist01FailureCategory, Dist01RecommendedAction[]> = {
    hypothesis_promoted_to_fact: ['store_as_hypothesis_only', 'suppress_from_gpt'],
    interpretation_treated_as_fact: ['store_as_hypothesis_only'],
    mindreading: ['add_mindreading_guard', 'store_as_hypothesis_only'],
    rescue_role_advice: ['add_rescue_role_guard', 'add_responsibility_boundary_label'],
    responsibility_misattribution: ['add_responsibility_boundary_label'],
    medical_certainty_overclaim: ['add_medical_uncertainty_label', 'require_user_confirmation'],
    stale_memory_overweighted: ['apply_decay'],
    contradiction_ignored: ['mark_contradiction', 'require_user_confirmation'],
    persona_leakage: ['add_persona_filter', 'suppress_from_gpt'],
    raw_memory_risk: ['suppress_from_gpt'],
    safety_underweighted: ['add_safety_priority'],
    false_positive_pattern: ['lower_confidence'],
    false_negative_pattern: ['raise_confidence_threshold'],
    confidence_too_high: ['lower_confidence'],
    confidence_too_low: ['promote_after_repetition'],
    unsupported_recovery_claim: ['store_as_hypothesis_only', 'require_user_confirmation'],
    unsupported_relational_claim: ['store_as_hypothesis_only', 'require_user_confirmation'],
    shame_identity_reinforced: ['add_shame_identity_guard'],
    craving_story_followed: ['add_craving_permission_guard'],
    user_emotion_not_validated: ['no_dist01_change_needed'],
  };
  return map[category] ?? ['no_dist01_change_needed'];
}

// ─── FUNCTION 4: mapFailureToTargetLayers ───
export function mapFailureToTargetLayers(
  category: Dist01FailureCategory,
  persona: 'elias' | 'kim',
  tags: string[],
): Dist01TargetLayer[] {
  const layers: Dist01TargetLayer[] = [];

  switch (category) {
    case 'hypothesis_promoted_to_fact':
    case 'interpretation_treated_as_fact':
      layers.push('dist01_signals', 'cmd_selector', 'epistemic_engine');
      break;
    case 'mindreading':
      layers.push('epistemic_engine', persona === 'kim' ? 'kim_adapter' : 'elias_adapter');
      break;
    case 'rescue_role_advice':
      layers.push('epistemic_engine', 'kim_adapter');
      break;
    case 'responsibility_misattribution':
      layers.push('epistemic_engine', persona === 'kim' ? 'kim_adapter' : 'elias_adapter');
      break;
    case 'medical_certainty_overclaim':
      layers.push('epistemic_engine', 'cmd_contract');
      break;
    case 'stale_memory_overweighted':
      layers.push('dist01_contexts', 'cmd_selector');
      break;
    case 'contradiction_ignored':
      layers.push('dist01_signals', 'dist01_contexts');
      break;
    case 'persona_leakage':
      layers.push('cmd_selector', persona === 'kim' ? 'kim_adapter' : 'elias_adapter');
      break;
    case 'raw_memory_risk':
      layers.push('cmd_selector', 'cmd_contract');
      break;
    case 'safety_underweighted':
      layers.push('safety_engine', 'model_routing');
      break;
    case 'false_positive_pattern':
    case 'false_negative_pattern':
      layers.push('dist01_signals', persona === 'kim' ? 'kim_adapter' : 'elias_adapter');
      break;
    case 'confidence_too_high':
    case 'confidence_too_low':
      layers.push('dist01_signals');
      break;
    case 'unsupported_recovery_claim':
      layers.push('dist01_signals', 'elias_adapter');
      break;
    case 'unsupported_relational_claim':
      layers.push('dist01_signals', 'kim_adapter');
      break;
    case 'shame_identity_reinforced':
      layers.push('dist01_signals', 'elias_adapter');
      break;
    case 'craving_story_followed':
      layers.push('dist01_signals', 'elias_adapter');
      break;
    case 'user_emotion_not_validated':
      layers.push('none');
      break;
  }

  return layers.length > 0 ? layers : ['none'];
}

// ─── FUNCTION 5: determineAffectedDomains ───
export function determineAffectedDomains(input: Dist01QualityScenarioInput): string[] {
  const searchText = [
    input.userInputSummary,
    ...input.expectedBehavior,
    ...input.observedBehavior,
    ...(input.tags ?? []),
  ].join(' ');

  const domains: string[] = [];
  for (const [domain, regex] of Object.entries(DOMAIN_KEYWORDS)) {
    if (regex.test(searchText)) {
      domains.push(domain);
    }
  }
  return domains;
}

// ─── FUNCTION 6: buildDist01QualitySummary ───
export function buildDist01QualitySummary(batch: Dist01BatchQualityAnalysis): string {
  const lines: string[] = [];
  lines.push(`[DIST01 QUALITY SUMMARY]`);
  lines.push(`Total: ${batch.totalScenarios} | Pass: ${batch.passedScenarios} | Fail: ${batch.failedScenarios}`);

  if (batch.recurrentFailureCategories.length > 0) {
    lines.push(`Recurrent: ${batch.recurrentFailureCategories.join(', ')}`);
  }

  lines.push(`Next phase: ${batch.recommendedNextPhase}`);

  // Per-scenario compact
  for (const a of batch.analyses) {
    if (!a.pass || a.failureCategories.length > 0) {
      const cats = a.failureCategories.length > 0 ? a.failureCategories.join(',') : 'none';
      const actions = a.recommendedActions.filter(x => x !== 'no_dist01_change_needed').join(',') || 'none';
      lines.push(`  ${a.scenarioId}(${a.persona}): ${cats} → ${actions}`);
    }
  }

  // Truncate to max 1500 chars
  let result = lines.join('\n');
  if (result.length > 1500) {
    result = result.substring(0, 1497) + '...';
  }
  return result;
}
