/**
 * BackpackSectionAnalysis — Deep per-section extraction types.
 * Used by the section analysis service to produce structured memory
 * from Backpack content that merges into user.dat.
 */

// ── Core Analysis Result ──────────────────────────────────────────────

export interface BackpackSectionAnalysisResult {
  persona: 'elias' | 'kim';
  sectionId: string;
  sectionHash: string;
  analyzedAt: string; // ISO timestamp

  personalAnchors: PersonAnchor[];
  relationGraph: RelationEdge[];
  lifeEvents: LifeEvent[];
  lifeStatusFacts: LifeStatusFact[];
  schemas: SchemaSignal[];
  modes: ModeSignal[];
  triggers: TriggerSignal[];
  protectiveFactors: ProtectiveFactor[];
  values: ValueSignal[];
  goals: GoalSignal[];
  risks: RiskSignal[];

  // Persona-specific
  recoveryPatterns: RecoveryPattern[]; // Elias only
  caregiverPatterns: CaregiverPattern[]; // Kim only

  confidenceSummary: ConfidenceSummary;
  warnings: string[];
}

// ── Person & Relation Types ──────────────────────────────────────────

export interface PersonAnchor {
  name: string;
  relationToUser: string; // e.g. "zoon", "ex-partner", "vriendin", "moeder"
  currentRelevance: 'high' | 'medium' | 'low';
  emotionallyImportant: boolean;
  explicitInSource: boolean;
  confidence: number; // 0-1
  sourceSectionId: string;
  sourceType: 'backpack_section';
}

export interface RelationEdge {
  subjectPerson: string;
  relation: string; // e.g. "moeder van", "ex-partner van", "zoon van"
  objectPerson: string;
  explicitInSource: boolean;
  confidence: number;
  sourceSectionId: string;
}

export interface LifeEvent {
  description: string;
  type: 'loss' | 'trauma' | 'achievement' | 'transition' | 'relapse' | 'recovery' | 'conflict' | 'other';
  timePeriod: string | null;
  peopleInvolved: string[];
  emotionalImpact: 'positive' | 'negative' | 'mixed' | 'neutral';
  isTriggerSource: boolean;
  sourceSectionId: string;
}

export interface LifeStatusFact {
  person: string;
  status: 'alive' | 'deceased' | 'unknown';
  explicitInSource: boolean;
  confidence: number;
  sourceSectionId: string;
}

// ── Schema & Mode Types ──────────────────────────────────────────────

export type SchemaName =
  | 'abandonment'
  | 'mistrust_abuse'
  | 'emotional_deprivation'
  | 'defectiveness_shame'
  | 'dependence_incompetence'
  | 'vulnerability'
  | 'enmeshment'
  | 'subjugation'
  | 'self_sacrifice'
  | 'unrelenting_standards'
  | 'entitlement'
  | 'insufficient_self_control'
  | 'approval_seeking'
  | 'negativity_pessimism'
  | 'emotional_inhibition'
  | 'punitiveness';

export type ModeName =
  | 'vulnerable_child'
  | 'angry_child'
  | 'impulsive_child'
  | 'compliant_surrender'
  | 'detached_protector'
  | 'overcontroller'
  | 'punitive_parent'
  | 'demanding_parent'
  | 'healthy_adult';

export interface SchemaSignal {
  schema: SchemaName;
  evidenceType: 'explicit' | 'inferred';
  confidence: number;
  sourceSectionId: string;
  doNotDiagnose: true; // Always true — schemas are never presented as diagnoses
}

export interface ModeSignal {
  mode: ModeName;
  evidenceType: 'explicit' | 'inferred';
  confidence: number;
  sourceSectionId: string;
  doNotDiagnose: true; // Always true — modes are never presented as diagnoses
}

// ── Trigger, Protective, Values, Goals, Risks ────────────────────────

export interface TriggerSignal {
  trigger: string;
  context: string;
  severity: 'high' | 'medium' | 'low';
  confidence: number;
  sourceSectionId: string;
}

export interface ProtectiveFactor {
  factor: string;
  domain: 'social' | 'personal' | 'spiritual' | 'professional' | 'physical';
  strength: 'strong' | 'moderate' | 'fragile';
  confidence: number;
  sourceSectionId: string;
}

export interface ValueSignal {
  value: string;
  importance: 'core' | 'important' | 'emerging';
  confidence: number;
  sourceSectionId: string;
}

export interface GoalSignal {
  goal: string;
  timeframe: 'short_term' | 'medium_term' | 'long_term' | 'undefined';
  confidence: number;
  sourceSectionId: string;
}

export interface RiskSignal {
  risk: string;
  severity: 'high' | 'medium' | 'low';
  isActive: boolean;
  confidence: number;
  sourceSectionId: string;
}

// ── Persona-Specific Patterns ────────────────────────────────────────

export interface RecoveryPattern {
  type: 'addiction_trigger' | 'relapse_context' | 'craving_function' | 'shame_loop' | 'avoidance_loop' | 'agency_anchor' | 'sobriety_protector' | 'cold_turkey_risk';
  description: string;
  confidence: number;
  sourceSectionId: string;
}

export interface CaregiverPattern {
  type: 'self_loss' | 'boundary_fatigue' | 'rescue_role' | 'relational_harm' | 'child_trust_concern' | 'emotional_burden' | 'self_care_anchor' | 'responsibility_confusion';
  description: string;
  confidence: number;
  sourceSectionId: string;
}

// ── Confidence Summary ───────────────────────────────────────────────

export interface ConfidenceSummary {
  overallConfidence: number;
  explicitFactCount: number;
  inferredFactCount: number;
  unsupportedFactsDiscarded: number;
}

// ── Merge Rules (constants) ──────────────────────────────────────────

/**
 * MERGE RULES for user.dat integration:
 *
 * 1. Explicit facts beat inferred facts.
 * 2. Higher confidence beats lower confidence.
 * 3. New null may never overwrite known relation.
 * 4. Unknown lifeStatus may never overwrite deceased/alive.
 * 5. Later vague mention may not remove relation graph edge.
 * 6. User-confirmed Backpack facts beat GPT chat summaries.
 * 7. Persona separation is absolute.
 * 8. Elias recovery facts never enter Kim memory.
 * 9. Kim caregiver facts never enter Elias memory.
 * 10. Raw Backpack text is never stored in user.dat as raw memory.
 */
export const MERGE_RULES = {
  EXPLICIT_BEATS_INFERRED: true,
  HIGHER_CONFIDENCE_WINS: true,
  NULL_NEVER_OVERWRITES_KNOWN: true,
  UNKNOWN_NEVER_OVERWRITES_STATUS: true,
  VAGUE_NEVER_REMOVES_EDGE: true,
  BACKPACK_BEATS_CHAT_SUMMARY: true,
  PERSONA_SEPARATION_ABSOLUTE: true,
  NO_RAW_TEXT_IN_USERDAT: true,
} as const;

// ── Section Analysis Job Status ──────────────────────────────────────

export interface SectionAnalysisStatus {
  sectionId: string;
  status: 'pending' | 'analyzing' | 'success' | 'failed';
  provider: 'openai' | 'forge' | 'none';
  storeFalse: boolean;
  error?: string;
  analyzedAt?: string;
  anchorsExtracted?: number;
  edgesExtracted?: number;
  schemasDetected?: number;
  modesDetected?: number;
}

// ── Manual Refresh Report ────────────────────────────────────────────

export interface ManualRefreshReport {
  sectionsAnalyzed: number;
  sectionsSkipped: number;
  anchorsBuilt: number;
  relationEdgesBuilt: number;
  schemasDetected: number;
  modesDetected: number;
  failures: number;
  provider: 'openai' | 'forge' | 'none';
  storeFalse: boolean;
  totalDurationMs: number;
}
