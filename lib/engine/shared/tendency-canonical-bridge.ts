/**
 * TENDENCY-TO-CANONICAL PROMOTION BRIDGE
 * 
 * Promotes confirmed schemaTendencies/modeTendencies (detected from chat via
 * schema-detector/mode-detector) to canonical schemas/modes (used by
 * buildPersonalClinicalContext for GPT prompt injection).
 * 
 * This is the vice-versa path: Chat → user.dat canonical fields.
 * 
 * RULES:
 * - Only confirmed=true tendencies are promoted
 * - evidenceType = 'inferred' (chat-detected, not backpack-analyzed)
 * - sourceLayer = 'chat_tendency_promotion'
 * - doNotDiagnose = true (always)
 * - Higher confidence canonical wins over lower confidence promotion
 * - Pure function, no side effects, no storage writes
 * - Caller is responsible for persisting the merged result
 */

// ── Types ──────────────────────────────────────────────────────────────────
export interface PromotionInput {
  schemaTendencies: any[];
  modeTendencies: any[];
  existingSchemas: any[];
  existingModes: any[];
}

export interface PromotedSchema {
  schema: string;
  evidenceType: 'inferred';
  confidence: number;
  doNotDiagnose: true;
  sourceLayer: 'chat_tendency_promotion';
  promotedAt: string;
  isUpdate: boolean;
}

export interface PromotedMode {
  mode: string;
  evidenceType: 'inferred';
  confidence: number;
  doNotDiagnose: true;
  sourceLayer: 'chat_tendency_promotion';
  promotedAt: string;
  isUpdate: boolean;
}

export interface PromotionResult {
  promotedSchemas: PromotedSchema[];
  promotedModes: PromotedMode[];
  skippedSchemas: string[];
  skippedModes: string[];
  mergedSchemas: any[];
  mergedModes: any[];
  report: {
    schemasPromoted: number;
    modesPromoted: number;
    schemasSkipped: number;
    modesSkipped: number;
    totalCanonicalSchemas: number;
    totalCanonicalModes: number;
  };
}

// ── Valid enum sets (same as section-analysis-service) ──────────────────
const VALID_SCHEMA_IDS = new Set([
  'abandonment', 'mistrust_abuse', 'emotional_deprivation', 'defectiveness_shame',
  'dependence_incompetence', 'vulnerability', 'enmeshment', 'subjugation',
  'self_sacrifice', 'unrelenting_standards', 'entitlement', 'insufficient_self_control',
  'approval_seeking', 'negativity_pessimism', 'emotional_inhibition', 'punitiveness',
]);

const VALID_MODE_IDS = new Set([
  'vulnerable_child', 'angry_child', 'impulsive_child', 'compliant_surrender',
  'detached_protector', 'overcontroller', 'punitive_parent', 'demanding_parent', 'healthy_adult',
]);

// ── Main function ──────────────────────────────────────────────────────────
export function promoteTendenciesToCanonical(input: PromotionInput): PromotionResult {
  const tendencySchemas = Array.isArray(input.schemaTendencies) ? input.schemaTendencies : [];
  const tendencyModes = Array.isArray(input.modeTendencies) ? input.modeTendencies : [];
  const existingSchemas = Array.isArray(input.existingSchemas) ? [...input.existingSchemas] : [];
  const existingModes = Array.isArray(input.existingModes) ? [...input.existingModes] : [];

  const now = new Date().toISOString();
  const promotedSchemas: PromotedSchema[] = [];
  const promotedModes: PromotedMode[] = [];
  const skippedSchemas: string[] = [];
  const skippedModes: string[] = [];

  // ── Promote schemas ──────────────────────────────────────────────────
  for (const tendency of tendencySchemas) {
    if (!tendency || !tendency.confirmed) continue;
    
    const schemaId = tendency.schemaId || tendency.schema;
    if (!schemaId || !VALID_SCHEMA_IDS.has(schemaId)) continue;

    const confidence = typeof tendency.confidence === 'number' ? tendency.confidence : 0.5;
    const existingIdx = existingSchemas.findIndex((s: any) => (s.schema || s.schemaName) === schemaId);

    if (existingIdx >= 0) {
      const existingConfidence = existingSchemas[existingIdx].confidence || 0;
      if (confidence > existingConfidence) {
        // Update existing with higher confidence
        const promoted: PromotedSchema = {
          schema: schemaId,
          evidenceType: 'inferred',
          confidence,
          doNotDiagnose: true,
          sourceLayer: 'chat_tendency_promotion',
          promotedAt: now,
          isUpdate: true,
        };
        existingSchemas[existingIdx] = { ...existingSchemas[existingIdx], ...promoted };
        promotedSchemas.push(promoted);
      } else {
        skippedSchemas.push(schemaId);
      }
    } else {
      // New canonical schema
      const promoted: PromotedSchema = {
        schema: schemaId,
        evidenceType: 'inferred',
        confidence,
        doNotDiagnose: true,
        sourceLayer: 'chat_tendency_promotion',
        promotedAt: now,
        isUpdate: false,
      };
      existingSchemas.push(promoted);
      promotedSchemas.push(promoted);
    }
  }

  // ── Promote modes ────────────────────────────────────────────────────
  for (const tendency of tendencyModes) {
    if (!tendency || !tendency.confirmed) continue;

    const modeId = tendency.modeId || tendency.mode;
    if (!modeId || !VALID_MODE_IDS.has(modeId)) continue;

    const confidence = typeof tendency.confidence === 'number' ? tendency.confidence : 0.5;
    const existingIdx = existingModes.findIndex((m: any) => (m.mode || m.modeName) === modeId);

    if (existingIdx >= 0) {
      const existingConfidence = existingModes[existingIdx].confidence || 0;
      if (confidence > existingConfidence) {
        const promoted: PromotedMode = {
          mode: modeId,
          evidenceType: 'inferred',
          confidence,
          doNotDiagnose: true,
          sourceLayer: 'chat_tendency_promotion',
          promotedAt: now,
          isUpdate: true,
        };
        existingModes[existingIdx] = { ...existingModes[existingIdx], ...promoted };
        promotedModes.push(promoted);
      } else {
        skippedModes.push(modeId);
      }
    } else {
      const promoted: PromotedMode = {
        mode: modeId,
        evidenceType: 'inferred',
        confidence,
        doNotDiagnose: true,
        sourceLayer: 'chat_tendency_promotion',
        promotedAt: now,
        isUpdate: false,
      };
      existingModes.push(promoted);
      promotedModes.push(promoted);
    }
  }

  return {
    promotedSchemas,
    promotedModes,
    skippedSchemas,
    skippedModes,
    mergedSchemas: existingSchemas,
    mergedModes: existingModes,
    report: {
      schemasPromoted: promotedSchemas.length,
      modesPromoted: promotedModes.length,
      schemasSkipped: skippedSchemas.length,
      modesSkipped: skippedModes.length,
      totalCanonicalSchemas: existingSchemas.length,
      totalCanonicalModes: existingModes.length,
    },
  };
}
