/**
 * Clinical Factor Chat Detector
 * Detects ONLY explicit user-reported clinical factors from chat messages.
 * NEVER infers diagnoses from symptoms.
 * Only triggers on clear self-reports like "ik heb ADHD", "mijn psychiater zegt borderline".
 */

import type { UserReportedClinicalFactor, ClinicalFactorCategory, ClinicalFactorStatus, ClinicalFactorPromptUse, ClinicalFactorImpactArea } from '@/lib/ai/types';

interface DetectedClinicalFactor {
  factorId: string;
  label: string;
  category: ClinicalFactorCategory;
  status: ClinicalFactorStatus;
  activeImpactAreas: ClinicalFactorImpactArea[];
  promptUse: ClinicalFactorPromptUse;
  safetyNotes?: string;
}

// ─── DETECTION PATTERNS ─────────────────────────────────────────
// Each pattern requires EXPLICIT self-report language.
// We NEVER detect from symptoms alone.

const DIAGNOSED_PREFIXES = [
  /\b(ik heb|ik ben gediagnosticeerd met|mijn diagnose is|ik heb de diagnose)\b/i,
  /\b(i have|i was diagnosed with|my diagnosis is|i've been diagnosed)\b/i,
];

const CLINICIAN_REPORTED_PREFIXES = [
  /\b(mijn psychiater zegt|mijn psycholoog zegt|mijn arts zegt|mijn therapeut zegt|volgens mijn psychiater|volgens mijn arts)\b/i,
  /\b(my psychiatrist says|my therapist says|my doctor says|according to my)\b/i,
];

const SUSPECTED_PREFIXES = [
  /\b(ik vermoed|ik denk dat ik|misschien heb ik|zou ik.*hebben|ik herken.*bij mezelf)\b/i,
  /\b(i suspect|i think i have|maybe i have|i might have|i recognize.*in myself)\b/i,
];

const DUAL_DIAGNOSIS_PATTERNS = [
  /\b(dubbeldiagnose|dubbel diagnose|dual diagnosis|co-morbid)\b/i,
];

const MEDICATION_PATTERNS = [
  /\b(ik slik|ik neem|ik gebruik|mijn medicatie|mijn medicijn)\b\s*([\w\s]+)/i,
  /\b(i take|i'm on|my medication|my meds)\b\s*([\w\s]+)/i,
];

// ─── KNOWN CLINICAL FACTORS ─────────────────────────────────────

interface KnownFactor {
  patterns: RegExp[];
  factorId: string;
  label: string;
  category: ClinicalFactorCategory;
  activeImpactAreas: ClinicalFactorImpactArea[];
  promptUse: ClinicalFactorPromptUse;
  safetyNotes?: string;
}

const KNOWN_FACTORS: KnownFactor[] = [
  {
    patterns: [/\bADHD\b/i, /\bADD\b/i, /\battention deficit\b/i, /\baandachtstekort\b/i],
    factorId: 'adhd',
    label: 'ADHD',
    category: 'neurodevelopmental',
    activeImpactAreas: ['impulse_control', 'attention_focus', 'pacing_needs', 'emotional_regulation'],
    promptUse: 'adapt_pacing',
  },
  {
    patterns: [/\bautis\w*\b/i, /\bASS\b/, /\bASD\b/i, /\bspectrum\b/i],
    factorId: 'autism_spectrum',
    label: 'Autisme spectrum',
    category: 'neurodevelopmental',
    activeImpactAreas: ['social_interaction', 'communication_style', 'pacing_needs', 'emotional_regulation'],
    promptUse: 'adapt_structure',
  },
  {
    patterns: [/\bborderline\b/i, /\bBPD\b/, /\bborderline.*trek\w*/i],
    factorId: 'borderline_traits',
    label: 'Borderline trekken',
    category: 'personality_traits',
    activeImpactAreas: ['emotional_regulation', 'relationship_patterns', 'self_image', 'crisis_vulnerability', 'impulse_control'],
    promptUse: 'increase_risk_awareness',
    safetyNotes: 'Avoid abandonment-triggering phrasing. Validate emotions before challenging.',
  },
  {
    patterns: [/\bdepressie\b/i, /\bdepression\b/i, /\bdepressief\b/i, /\bdepressive\b/i],
    factorId: 'depression',
    label: 'Depressie',
    category: 'mood_disorder',
    activeImpactAreas: ['emotional_regulation', 'sleep', 'crisis_vulnerability', 'relapse_risk'],
    promptUse: 'increase_risk_awareness',
    safetyNotes: 'Monitor for suicidal ideation. Gentle activation, not pressure.',
  },
  {
    patterns: [/\bangst\w*stoornis\b/i, /\banxiety\b/i, /\bGAD\b/, /\bpaniek\w*stoornis\b/i, /\bpanic\b/i],
    factorId: 'anxiety_disorder',
    label: 'Angststoornis',
    category: 'anxiety_disorder',
    activeImpactAreas: ['emotional_regulation', 'sleep', 'crisis_vulnerability', 'pacing_needs'],
    promptUse: 'adapt_tone',
  },
  {
    patterns: [/\bPTSS\b/, /\bPTSD\b/, /\btrauma\b/i, /\bposttraumatisch\b/i, /\bpost-traumatic\b/i],
    factorId: 'ptsd',
    label: 'PTSS / Trauma',
    category: 'trauma_related',
    activeImpactAreas: ['emotional_regulation', 'crisis_vulnerability', 'sleep', 'relationship_patterns'],
    promptUse: 'avoid_triggers',
    safetyNotes: 'Avoid re-traumatization. Use grounding techniques. Never push for trauma details.',
  },
  {
    patterns: [/\bbipolair\b/i, /\bbipolar\b/i, /\bmanisch\b/i, /\bmanic\b/i],
    factorId: 'bipolar',
    label: 'Bipolaire stoornis',
    category: 'mood_disorder',
    activeImpactAreas: ['emotional_regulation', 'impulse_control', 'sleep', 'medication_adherence', 'crisis_vulnerability'],
    promptUse: 'increase_risk_awareness',
    safetyNotes: 'Monitor for manic episodes. Medication adherence critical.',
  },
  {
    patterns: [/\bOCD\b/, /\bobsessief\b/i, /\bcompulsief\b/i, /\bdwang\w*stoornis\b/i],
    factorId: 'ocd',
    label: 'OCD / Dwangstoornis',
    category: 'anxiety_disorder',
    activeImpactAreas: ['emotional_regulation', 'pacing_needs', 'attention_focus'],
    promptUse: 'adapt_structure',
  },
  {
    patterns: [/\bschizofrenie\b/i, /\bschizophreni\w*\b/i, /\bpsychos\w*\b/i],
    factorId: 'psychotic_spectrum',
    label: 'Psychotisch spectrum',
    category: 'psychotic_spectrum',
    activeImpactAreas: ['crisis_vulnerability', 'medication_adherence', 'social_interaction'],
    promptUse: 'increase_risk_awareness',
    safetyNotes: 'Never challenge reality perception. Medication adherence critical. Refer to professional immediately if active symptoms.',
  },
  {
    patterns: [/\banorexia\b/i, /\bbulimi\w*\b/i, /\beet\w*stoornis\b/i, /\beating disorder\b/i, /\bBED\b/],
    factorId: 'eating_disorder',
    label: 'Eetstoornis',
    category: 'eating_disorder',
    activeImpactAreas: ['self_image', 'emotional_regulation', 'impulse_control', 'crisis_vulnerability'],
    promptUse: 'avoid_triggers',
    safetyNotes: 'Avoid body/weight/food discussions unless user initiates. No diet advice.',
  },
  {
    patterns: [/\bdyslexie\b/i, /\bdyslexia\b/i],
    factorId: 'dyslexia',
    label: 'Dyslexie',
    category: 'neurodevelopmental',
    activeImpactAreas: ['pacing_needs', 'communication_style'],
    promptUse: 'adapt_pacing',
  },
  {
    patterns: [/\bHSP\b/, /\bhooggevoel\w*\b/i, /\bhighly sensitive\b/i],
    factorId: 'hsp',
    label: 'Hooggevoeligheid (HSP)',
    category: 'other',
    activeImpactAreas: ['emotional_regulation', 'pacing_needs', 'communication_style'],
    promptUse: 'adapt_tone',
  },
];

// ─── MAIN DETECTION FUNCTION ────────────────────────────────────

export function detectClinicalFactorsFromChat(
  userMessage: string,
  existingFactors: UserReportedClinicalFactor[] = []
): UserReportedClinicalFactor[] {
  const newFactors: UserReportedClinicalFactor[] = [];
  const now = new Date().toISOString();
  
  // Determine status from prefix
  let detectedStatus: ClinicalFactorStatus = 'unclear';
  
  for (const pattern of DIAGNOSED_PREFIXES) {
    if (pattern.test(userMessage)) {
      detectedStatus = 'user_reported_diagnosed';
      break;
    }
  }
  if (detectedStatus === 'unclear') {
    for (const pattern of CLINICIAN_REPORTED_PREFIXES) {
      if (pattern.test(userMessage)) {
        detectedStatus = 'clinician_reported_by_user';
        break;
      }
    }
  }
  if (detectedStatus === 'unclear') {
    for (const pattern of SUSPECTED_PREFIXES) {
      if (pattern.test(userMessage)) {
        detectedStatus = 'user_suspected';
        break;
      }
    }
  }
  
  // If no explicit self-report prefix found, do NOT detect
  if (detectedStatus === 'unclear') {
    // Check dual diagnosis as special case
    for (const pattern of DUAL_DIAGNOSIS_PATTERNS) {
      if (pattern.test(userMessage)) {
        detectedStatus = 'user_reported_diagnosed';
        const existing = existingFactors.find(f => f.factorId === 'dual_diagnosis');
        if (!existing) {
          newFactors.push({
            factorId: 'dual_diagnosis',
            label: 'Dubbeldiagnose',
            category: 'substance_related',
            status: detectedStatus,
            source: 'chat',
            evidenceSnippet: userMessage.slice(0, 200),
            firstSeenAt: now,
            lastSeenAt: now,
            activeImpactAreas: ['relapse_risk', 'medication_adherence', 'crisis_vulnerability'],
            promptUse: 'increase_risk_awareness',
            confidence: 0.8,
          });
        }
        break;
      }
    }
    
    // Check medication mentions
    for (const pattern of MEDICATION_PATTERNS) {
      if (pattern.test(userMessage)) {
        const existing = existingFactors.find(f => f.factorId === 'medication_use');
        if (!existing) {
          newFactors.push({
            factorId: 'medication_use',
            label: 'Medicatiegebruik',
            category: 'medication',
            status: 'user_reported_diagnosed',
            source: 'chat',
            evidenceSnippet: userMessage.slice(0, 200),
            firstSeenAt: now,
            lastSeenAt: now,
            activeImpactAreas: ['medication_adherence'],
            promptUse: 'medication_awareness',
            safetyNotes: 'No dosage advice. No medical advice. Context/awareness only.',
            confidence: 0.9,
          });
        }
        break;
      }
    }
    
    return newFactors;
  }
  
  // Match against known factors
  for (const known of KNOWN_FACTORS) {
    for (const pattern of known.patterns) {
      if (pattern.test(userMessage)) {
        const existing = existingFactors.find(f => f.factorId === known.factorId);
        if (!existing) {
          newFactors.push({
            factorId: known.factorId,
            label: known.label,
            category: known.category,
            status: detectedStatus,
            source: 'chat',
            evidenceSnippet: userMessage.slice(0, 200),
            firstSeenAt: now,
            lastSeenAt: now,
            activeImpactAreas: known.activeImpactAreas,
            promptUse: known.promptUse,
            safetyNotes: known.safetyNotes,
            confidence: detectedStatus === 'user_reported_diagnosed' ? 0.95 : detectedStatus === 'clinician_reported_by_user' ? 0.9 : 0.6,
          });
        } else {
          // Update lastSeenAt and potentially upgrade status
          if (statusHierarchy(detectedStatus) > statusHierarchy(existing.status)) {
            existing.status = detectedStatus;
            existing.confidence = Math.max(existing.confidence, detectedStatus === 'user_reported_diagnosed' ? 0.95 : 0.9);
          }
          existing.lastSeenAt = now;
        }
        break; // Only match first pattern per factor
      }
    }
  }
  
  return newFactors;
}

function statusHierarchy(status: ClinicalFactorStatus): number {
  switch (status) {
    case 'user_reported_diagnosed': return 4;
    case 'clinician_reported_by_user': return 3;
    case 'user_suspected': return 2;
    case 'screening_indicated': return 1;
    case 'unclear': return 0;
  }
}
