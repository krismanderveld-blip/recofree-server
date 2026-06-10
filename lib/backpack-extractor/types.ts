/**
 * BackpackEntityExtractor — Types
 *
 * Structured entities extracted from backpack free-text sections via LLM.
 * These are persisted in userDat.extractedEntities and used by the pipeline
 * instead of sending full backpack text on every session.
 */

// ─── Person Entity ─────────────────────────────────────────────

export interface ExtractedPerson {
  /** Name as mentioned by user (e.g., "Lisa", "mijn moeder") */
  name: string;
  /** Relationship to user (e.g., "daughter", "ex-partner", "mother") */
  relationship: string;
  /** Relationship in Dutch (e.g., "dochter", "ex-partner", "moeder") */
  relationshipNL: string;
  /** Age or age range if mentioned (e.g., "14", "40-50", null) */
  age: string | null;
  /** Living situation context (e.g., "lives with ex", "lives at home", null) */
  livingSituation: string | null;
  /** Emotional significance to user (positive/negative/ambivalent/neutral) */
  emotionalValence: 'positive' | 'negative' | 'ambivalent' | 'neutral';
  /** Brief context about this person's role in user's story */
  context: string;
  /** Which backpack section this was extracted from */
  sourceSection: string;
}

// ─── Event Entity ──────────────────────────────────────────────

export interface ExtractedEvent {
  /** Brief description of the event */
  description: string;
  /** Type classification */
  type: 'trauma' | 'loss' | 'turning_point' | 'relapse' | 'achievement' | 'conflict' | 'abuse' | 'neglect' | 'other';
  /** Approximate time period (e.g., "childhood", "2019", "age 14") */
  timePeriod: string | null;
  /** People involved (names as mentioned) */
  peopleInvolved: string[];
  /** Emotional impact described */
  emotionalImpact: string;
  /** Whether this event appears to be a recurring pattern trigger */
  isTriggerSource: boolean;
  /** Which backpack section this was extracted from */
  sourceSection: string;
}

// ─── Pattern Entity ────────────────────────────────────────────

export interface ExtractedPattern {
  /** Description of the pattern */
  description: string;
  /** Pattern type */
  type: 'relational' | 'behavioral' | 'emotional' | 'coping' | 'avoidance' | 'schema' | 'cycle';
  /** Schema hypothesis if applicable (e.g., "abandonment", "emotional deprivation") */
  schemaHypothesis: string | null;
  /** Frequency indicator */
  frequency: 'once' | 'recurring' | 'chronic';
  /** People involved in this pattern */
  peopleInvolved: string[];
  /** Which backpack section this was extracted from */
  sourceSection: string;
}

// ─── Location/Context Entity ───────────────────────────────────

export interface ExtractedContext {
  /** Description (e.g., "works as nurse", "lives in Antwerp") */
  description: string;
  /** Type */
  type: 'work' | 'living' | 'social' | 'health' | 'financial' | 'legal' | 'other';
  /** Relevance to therapeutic process */
  relevance: string;
  /** Which backpack section this was extracted from */
  sourceSection: string;
}

// ─── Full Extracted Entities Container ─────────────────────────

export interface ExtractedEntities {
  /** All persons mentioned in backpack */
  persons: ExtractedPerson[];
  /** All significant events */
  events: ExtractedEvent[];
  /** All detected patterns */
  patterns: ExtractedPattern[];
  /** Contextual information (work, living, health) */
  contexts: ExtractedContext[];
  /** ISO timestamp of last extraction */
  extractedAt: string;
  /** Hash of the backpack content that was extracted (for change detection) */
  sourceHash: string;
  /** Version of the extraction schema (for future migrations) */
  schemaVersion: number;
}

// ─── Section Hash for Change Detection ─────────────────────────

export interface BackpackSectionHash {
  /** Section ID or key */
  sectionId: string;
  /** SHA-256 hash of the section content */
  hash: string;
  /** ISO timestamp when this hash was computed */
  computedAt: string;
}

export interface BackpackHashState {
  /** Per-section hashes */
  sections: BackpackSectionHash[];
  /** Combined hash of all sections (quick equality check) */
  combinedHash: string;
  /** ISO timestamp */
  computedAt: string;
}

// ─── Extraction Request/Response ───────────────────────────────

export interface ExtractionRequest {
  /** User name for context */
  userName: string;
  /** User type (elias/kim) for context-aware extraction */
  userType: 'elias' | 'kim';
  /** All backpack text sections to extract from */
  sections: Array<{
    id: string;
    label: string;
    content: string;
  }>;
  /** Kim backpack sections if applicable */
  kimSections?: {
    my_story: string;
    the_relationship: string;
    the_impact: string;
    my_boundaries: string;
    my_strength: string;
  };
  /** Intake context */
  intakeContext: string;
}

export interface ExtractionResponse {
  entities: ExtractedEntities;
  /** Whether extraction was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

// ─── Constants ─────────────────────────────────────────────────

export const EXTRACTION_SCHEMA_VERSION = 1;
export const BACKPACK_HASH_KEY = '@recofree_backpack_hash';
