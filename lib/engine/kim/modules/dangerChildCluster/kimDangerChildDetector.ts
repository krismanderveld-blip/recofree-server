/**
 * Kim Cluster 2 Detector: GEVAAR-K01 + KIND-K01
 * Scans markers in NL/EN/FR and determines which module to activate.
 * Priority: KIND-K01 (child safety) > GEVAAR-K01 (danger without child) > defer to other modules
 */

import type {
  KimCluster2RuntimeInput,
  KimCluster2DetectionResult,
  KimDangerCategory,
  KimChildSafetyCategory,
  KimCluster2ResponseMode,
  FixedBelgianCrisisNumber,
} from './kimDangerChildCluster.types';

import * as NL from './kimDangerChildMarkers.nl';
import * as EN from './kimDangerChildMarkers.en';
import * as FR from './kimDangerChildMarkers.fr';

// ============ MARKER SCANNING ============

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text));
}

function getMatchedLabels(text: string, patterns: RegExp[], label: string): string[] {
  return patterns.filter(p => p.test(text)).map(() => label);
}

export interface MarkerScanResult {
  drunkDriving: boolean;
  aggression: boolean;
  disappearance: boolean;
  medicalOverdose: boolean;
  selfHarmThreat: boolean;
  childWitnesses: boolean;
  childFear: boolean;
  childParentification: boolean;
  childNeglectMaltreatment: boolean;
  childAgeAppropriate: boolean;
  matchedLabels: string[];
}

export function scanMarkers(text: string): MarkerScanResult {
  const labels: string[] = [];

  const drunkDriving = matchesAny(text, [...NL.NL_DRUNK_DRIVING_MARKERS, ...EN.EN_DRUNK_DRIVING_MARKERS, ...FR.FR_DRUNK_DRIVING_MARKERS]);
  if (drunkDriving) labels.push('DRUNK_DRIVING');

  const aggression = matchesAny(text, [...NL.NL_AGGRESSION_MARKERS, ...EN.EN_AGGRESSION_MARKERS, ...FR.FR_AGGRESSION_MARKERS]);
  if (aggression) labels.push('AGGRESSION');

  const disappearance = matchesAny(text, [...NL.NL_DISAPPEARANCE_MARKERS, ...EN.EN_DISAPPEARANCE_MARKERS, ...FR.FR_DISAPPEARANCE_MARKERS]);
  if (disappearance) labels.push('DISAPPEARANCE');

  const medicalOverdose = matchesAny(text, [...NL.NL_MEDICAL_OVERDOSE_MARKERS, ...EN.EN_MEDICAL_OVERDOSE_MARKERS, ...FR.FR_MEDICAL_OVERDOSE_MARKERS]);
  if (medicalOverdose) labels.push('OVERDOSE_OR_MEDICAL_DANGER');

  const selfHarmThreat = matchesAny(text, [...NL.NL_SELF_HARM_THREAT_MARKERS, ...EN.EN_SELF_HARM_THREAT_MARKERS, ...FR.FR_SELF_HARM_THREAT_MARKERS]);
  if (selfHarmThreat) labels.push('SELF_HARM_THREAT');

  const childWitnesses = matchesAny(text, [...NL.NL_CHILD_WITNESSES_MARKERS, ...EN.EN_CHILD_WITNESSES_MARKERS, ...FR.FR_CHILD_WITNESSES_MARKERS]);
  if (childWitnesses) labels.push('CHILD_WITNESSES');

  const childFear = matchesAny(text, [...NL.NL_CHILD_FEAR_MARKERS, ...EN.EN_CHILD_FEAR_MARKERS, ...FR.FR_CHILD_FEAR_MARKERS]);
  if (childFear) labels.push('CHILD_FEAR');

  const childParentification = matchesAny(text, [...NL.NL_CHILD_PARENTIFICATION_MARKERS, ...EN.EN_CHILD_PARENTIFICATION_MARKERS, ...FR.FR_CHILD_PARENTIFICATION_MARKERS]);
  if (childParentification) labels.push('CHILD_PARENTIFICATION');

  const childNeglectMaltreatment = matchesAny(text, [...NL.NL_CHILD_NEGLECT_MALTREATMENT_MARKERS, ...EN.EN_CHILD_NEGLECT_MALTREATMENT_MARKERS, ...FR.FR_CHILD_NEGLECT_MALTREATMENT_MARKERS]);
  if (childNeglectMaltreatment) labels.push('CHILD_NEGLECT_MALTREATMENT');

  const childAgeAppropriate = matchesAny(text, [...NL.NL_CHILD_AGE_APPROPRIATE_MARKERS, ...EN.EN_CHILD_AGE_APPROPRIATE_MARKERS, ...FR.FR_CHILD_AGE_APPROPRIATE_MARKERS]);
  if (childAgeAppropriate) labels.push('CHILD_AGE_APPROPRIATE');

  return {
    drunkDriving,
    aggression,
    disappearance,
    medicalOverdose,
    selfHarmThreat,
    childWitnesses,
    childFear,
    childParentification,
    childNeglectMaltreatment,
    childAgeAppropriate,
    matchedLabels: labels,
  };
}

// ============ GEVAAR-K01 DETECTOR ============

export function detectGevaarK01(input: KimCluster2RuntimeInput): KimCluster2DetectionResult {
  if (input.persona !== 'kim') {
    return blocked('GEVAAR-K01', 'BLOCKED_BY_PERSONA', 'GEVAAR-K01 is Kim only.');
  }
  if (!input.intakeCompleted) {
    return blocked('GEVAAR-K01', 'BLOCKED_BY_INTAKE', 'Intake incomplete.');
  }

  const scan = scanMarkers(input.latestUserMessage);
  const dangerCategories: KimDangerCategory[] = [];
  const numbers: FixedBelgianCrisisNumber[] = [];

  if (scan.drunkDriving || input.drunkDrivingDetected) dangerCategories.push('DRUNK_DRIVING');
  if (scan.aggression || input.aggressionDetected) dangerCategories.push('AGGRESSION');
  if (scan.disappearance || input.disappearanceDetected) dangerCategories.push('DISAPPEARANCE');
  if (scan.medicalOverdose || input.overdoseOrMedicalDangerDetected) dangerCategories.push('OVERDOSE_OR_MEDICAL_DANGER');
  if (scan.selfHarmThreat || input.selfHarmThreatByLovedOneDetected) dangerCategories.push('SELF_HARM_THREAT_BY_LOVED_ONE');
  if (input.domesticViolenceOrAbuseDetected) dangerCategories.push('UNSAFE_HOME');

  // No danger detected → not active
  if (dangerCategories.length === 0) {
    return {
      moduleId: 'GEVAAR-K01',
      activationStatus: 'NOT_ACTIVE',
      confidenceScore: 0,
      matchedMarkers: scan.matchedLabels,
      dangerCategories: [],
      responseMode: 'SAFETY_FIRST',
      crisisNumbersToShow: [],
      routeNext: 'NO_MODULE',
      reason: 'No danger marker detected.',
    };
  }

  // Determine crisis numbers
  const immediateDanger = input.immediateDanger ||
    dangerCategories.includes('OVERDOSE_OR_MEDICAL_DANGER') ||
    (dangerCategories.includes('AGGRESSION') && input.immediateDanger);

  if (immediateDanger || dangerCategories.includes('OVERDOSE_OR_MEDICAL_DANGER')) {
    numbers.push('112');
  }
  if (dangerCategories.includes('AGGRESSION') || dangerCategories.includes('UNSAFE_HOME') || input.domesticViolenceOrAbuseDetected) {
    numbers.push('1712');
    if (immediateDanger) numbers.push('112');
  }
  if (dangerCategories.includes('DRUNK_DRIVING') || dangerCategories.includes('DISAPPEARANCE') || input.policeRelevantButNot112) {
    numbers.push('101');
  }
  if (dangerCategories.includes('SELF_HARM_THREAT_BY_LOVED_ONE')) {
    if (immediateDanger) numbers.push('112');
    numbers.push('1813');
  }

  // Determine response mode
  let responseMode: KimCluster2ResponseMode = 'SAFETY_FIRST';
  if (dangerCategories.includes('OVERDOSE_OR_MEDICAL_DANGER')) {
    responseMode = 'CALL_112_NOW';
  } else if (dangerCategories.includes('AGGRESSION') && immediateDanger) {
    responseMode = 'CALL_112_NOW';
  } else if (dangerCategories.includes('DRUNK_DRIVING')) {
    responseMode = 'DO_NOT_INTERVENE_PHYSICALLY';
  } else if (dangerCategories.includes('SELF_HARM_THREAT_BY_LOVED_ONE')) {
    responseMode = immediateDanger ? 'CALL_112_NOW' : 'CONTACT_1813';
  }

  // Confidence
  const confidenceScore =
    dangerCategories.includes('OVERDOSE_OR_MEDICAL_DANGER') ? 0.99 :
    dangerCategories.includes('AGGRESSION') ? 0.98 :
    dangerCategories.includes('SELF_HARM_THREAT_BY_LOVED_ONE') ? 0.96 :
    dangerCategories.includes('DRUNK_DRIVING') ? 0.95 :
    dangerCategories.includes('DISAPPEARANCE') ? 0.88 :
    0.85;

  return {
    moduleId: 'GEVAAR-K01',
    activationStatus: immediateDanger ? 'ESCALATE_TO_CRISIS_NUMBERS' : 'ACTIVE',
    confidenceScore,
    matchedMarkers: scan.matchedLabels,
    dangerCategories,
    responseMode,
    crisisNumbersToShow: [...new Set(numbers)],
    routeNext: 'GEVAAR-K01',
    reason: `Danger detected: ${dangerCategories.join(', ')}`,
  };
}

// ============ KIND-K01 DETECTOR ============

export function detectKindK01(input: KimCluster2RuntimeInput): KimCluster2DetectionResult {
  if (input.persona !== 'kim') {
    return blocked('KIND-K01', 'BLOCKED_BY_PERSONA', 'KIND-K01 is Kim only.');
  }
  if (!input.intakeCompleted) {
    return blocked('KIND-K01', 'BLOCKED_BY_INTAKE', 'Intake incomplete.');
  }

  const scan = scanMarkers(input.latestUserMessage);
  const categories: KimChildSafetyCategory[] = [];
  const numbers: FixedBelgianCrisisNumber[] = [];

  if (scan.childWitnesses || input.childPresentOrAffected) categories.push('CHILD_WITNESSES_USE');
  if (scan.childFear) categories.push('CHILD_IS_AFRAID');
  if ((scan.aggression || input.aggressionDetected) && (scan.childWitnesses || scan.childFear || input.childPresentOrAffected)) {
    categories.push('CHILD_EXPOSED_TO_AGGRESSION');
  }
  if (scan.childNeglectMaltreatment || input.childMaltreatmentOrNeglectDetected) categories.push('CHILD_NEGLECT');
  if (scan.childParentification || input.childParentificationRiskDetected) categories.push('CHILD_PARENTIFICATION');
  if ((scan.drunkDriving || input.drunkDrivingDetected) && (scan.childWitnesses || scan.childFear || scan.childNeglectMaltreatment || input.childPresentOrAffected)) {
    categories.push('CHILD_IN_CAR_WITH_INTOXICATED_ADULT');
  }

  // No child marker detected
  if (categories.length === 0) {
    // Check if it's just an age-appropriate question
    if (scan.childAgeAppropriate) {
      categories.push('CHILD_WITNESSES_USE'); // minimal category for age-appropriate questions
    } else {
      return {
        moduleId: 'KIND-K01',
        activationStatus: 'NOT_ACTIVE',
        confidenceScore: 0,
        matchedMarkers: scan.matchedLabels,
        childSafetyCategories: [],
        responseMode: 'PROTECT_CHILDREN_FIRST',
        crisisNumbersToShow: [],
        routeNext: 'NO_MODULE',
        reason: 'No child-related addiction/safety marker detected.',
      };
    }
  }

  // Crisis numbers
  const immediateDanger = input.immediateDanger ||
    categories.includes('CHILD_IN_CAR_WITH_INTOXICATED_ADULT') ||
    categories.includes('CHILD_EXPOSED_TO_AGGRESSION');

  if (immediateDanger && (categories.includes('CHILD_IN_CAR_WITH_INTOXICATED_ADULT') || input.immediateDanger)) {
    numbers.push('112');
  }
  if (categories.includes('CHILD_NEGLECT') || categories.includes('CHILD_EXPOSED_TO_AGGRESSION') || input.domesticViolenceOrAbuseDetected || input.childMaltreatmentOrNeglectDetected) {
    numbers.push('1712');
  }
  if (categories.includes('CHILD_IN_CAR_WITH_INTOXICATED_ADULT') || input.policeRelevantButNot112 || input.drunkDrivingDetected) {
    numbers.push('101');
  }
  if (input.selfHarmThreatByLovedOneDetected) {
    if (input.immediateDanger) numbers.push('112');
    numbers.push('1813');
  }

  // Response mode
  let responseMode: KimCluster2ResponseMode = 'AGE_APPROPRIATE_CHILD_SUPPORT';
  if (immediateDanger) {
    responseMode = 'PROTECT_CHILDREN_FIRST';
  } else if (categories.includes('CHILD_NEGLECT')) {
    responseMode = 'CHILD_MALTREATMENT_ROUTE';
  } else if (categories.includes('CHILD_PARENTIFICATION')) {
    responseMode = 'DO_NOT_PARENTIFY_CHILD';
  }

  // Confidence
  const confidenceScore =
    categories.includes('CHILD_IN_CAR_WITH_INTOXICATED_ADULT') ? 0.99 :
    categories.includes('CHILD_NEGLECT') ? 0.98 :
    categories.includes('CHILD_EXPOSED_TO_AGGRESSION') ? 0.94 :
    categories.includes('CHILD_IS_AFRAID') ? 0.90 :
    categories.includes('CHILD_PARENTIFICATION') ? 0.88 :
    categories.includes('CHILD_WITNESSES_USE') ? 0.85 :
    0.72;

  return {
    moduleId: 'KIND-K01',
    activationStatus: immediateDanger ? 'ESCALATE_TO_CRISIS_NUMBERS' : 'ACTIVE',
    confidenceScore,
    matchedMarkers: scan.matchedLabels,
    childSafetyCategories: categories,
    responseMode,
    crisisNumbersToShow: [...new Set(numbers)],
    routeNext: 'KIND-K01',
    reason: `Child safety marker detected: ${categories.join(', ')}`,
  };
}

// ============ PRIORITY RESOLVER ============

export interface KimCluster2PriorityResult {
  primary: KimCluster2DetectionResult | null;
  secondary: KimCluster2DetectionResult | null;
  reason: string;
}

/**
 * Resolves priority between GEVAAR-K01 and KIND-K01.
 * KIND-K01 wins when children are directly affected.
 * GEVAAR-K01 wins when danger exists without child marker.
 */
export function resolveCluster2Priority(
  gevaarResult: KimCluster2DetectionResult,
  kindResult: KimCluster2DetectionResult
): KimCluster2PriorityResult {
  const gevaarActive = gevaarResult.activationStatus === 'ACTIVE' || gevaarResult.activationStatus === 'ESCALATE_TO_CRISIS_NUMBERS';
  const kindActive = kindResult.activationStatus === 'ACTIVE' || kindResult.activationStatus === 'ESCALATE_TO_CRISIS_NUMBERS';

  if (kindActive && gevaarActive) {
    // KIND-K01 wins when children are directly affected
    return {
      primary: kindResult,
      secondary: gevaarResult,
      reason: 'KIND-K01 wins: children affected in danger situation.',
    };
  }

  if (kindActive) {
    return {
      primary: kindResult,
      secondary: null,
      reason: 'KIND-K01 active: child safety concern.',
    };
  }

  if (gevaarActive) {
    return {
      primary: gevaarResult,
      secondary: null,
      reason: 'GEVAAR-K01 active: danger without child marker.',
    };
  }

  return {
    primary: null,
    secondary: null,
    reason: 'Neither GEVAAR-K01 nor KIND-K01 active.',
  };
}

// ============ HELPERS ============

function blocked(
  moduleId: 'GEVAAR-K01' | 'KIND-K01',
  status: 'BLOCKED_BY_PERSONA' | 'BLOCKED_BY_INTAKE',
  reason: string
): KimCluster2DetectionResult {
  return {
    moduleId,
    activationStatus: status,
    confidenceScore: 0,
    matchedMarkers: [],
    dangerCategories: moduleId === 'GEVAAR-K01' ? [] : undefined,
    childSafetyCategories: moduleId === 'KIND-K01' ? [] : undefined,
    responseMode: moduleId === 'KIND-K01' ? 'PROTECT_CHILDREN_FIRST' : 'SAFETY_FIRST',
    crisisNumbersToShow: [],
    routeNext: 'NO_MODULE',
    reason,
  };
}
