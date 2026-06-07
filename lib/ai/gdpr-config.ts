/**
 * ═══════════════════════════════════════════════════════════════════════════
 * RECOFREE — OPENAI API GDPR CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * OpenAI Platform privacy configuration for the RecoFree API organization.
 *
 * Confirmed:
 * - OpenAI DPA signed through Ironclad
 * - API call logging: Disabled
 * - MCP tool usage: Disabled
 * - Web search tool usage: Disabled
 * - File search tool usage: Disabled
 * - Image generation tool usage: Disabled
 *
 * Architecture rule:
 * OpenAI API may ONLY be used as a language-rendering layer.
 * All therapeutic decision-making, relapse detection, craving analysis,
 * risk classification, crisis routing, module selection, trigger interpretation,
 * and safety gating MUST happen locally on-device.
 *
 * @module gdpr-config
 */

// ═══════════════════════════════════════════════════════════════════════════
// PRIVACY CONSTANTS — NEVER CHANGE THESE WITHOUT LEGAL REVIEW
// ═══════════════════════════════════════════════════════════════════════════

/** OpenAI must never store request/response data */
export const OPENAI_API_STORE = false;

/** OpenAI's role in RecoFree architecture */
export const OPENAI_API_ROLE = 'language_rendering_only' as const;

/** Therapeutic decision-making is LOCAL ONLY */
export const OPENAI_ALLOW_THERAPEUTIC_DECISIONING = false;

/** Risk classification is LOCAL ONLY */
export const OPENAI_ALLOW_RISK_CLASSIFICATION = false;

/** Module routing is LOCAL ONLY */
export const OPENAI_ALLOW_MODULE_ROUTING = false;

/** No long-term memory storage at OpenAI */
export const OPENAI_ALLOW_LONG_TERM_MEMORY = false;

/** No user profile storage at OpenAI */
export const OPENAI_ALLOW_USER_PROFILE_STORAGE = false;

/** Raw journal data must never be sent to OpenAI */
export const OPENAI_ALLOW_RAW_JOURNAL_UPLOAD = false;

/** Raw rugzak/life story must never be sent unminimized */
export const OPENAI_ALLOW_RAW_RUGZAK_UPLOAD = false;

/** No hosted tools (web search, file search, etc.) */
export const OPENAI_ALLOW_HOSTED_TOOLS = false;

/** No web search */
export const OPENAI_ALLOW_WEB_SEARCH = false;

/** No file search */
export const OPENAI_ALLOW_FILE_SEARCH = false;

/** No image generation */
export const OPENAI_ALLOW_IMAGE_GENERATION = false;

/** No MCP tools */
export const OPENAI_ALLOW_MCP_TOOLS = false;

// ═══════════════════════════════════════════════════════════════════════════
// FORBIDDEN DATA CATEGORIES — must never be sent to OpenAI
// ═══════════════════════════════════════════════════════════════════════════

export const FORBIDDEN_DATA_CATEGORIES = [
  'full_journal_history',
  'full_rugzak_life_story',
  'raw_crisis_history',
  'raw_relapse_history',
  'complete_user_profile',
  'third_party_sensitive_data',
  'medical_diagnosis_claims',
  'unfiltered_therapeutic_session_memory',
  'unminimized_personal_context',
] as const;

export type ForbiddenDataCategory = typeof FORBIDDEN_DATA_CATEGORIES[number];

// ═══════════════════════════════════════════════════════════════════════════
// REQUIRED SYSTEM PROMPT PREFIX — enforces language-rendering-only role
// ═══════════════════════════════════════════════════════════════════════════

export const LANGUAGE_RENDERING_SYSTEM_PREFIX = `You are a language rendering layer for RecoFree.
Do not make therapeutic decisions.
Do not diagnose.
Do not classify risk.
Do not choose modules.
Do not add new advice.
Do not change therapeutic meaning.
Do not escalate unless the approved local intervention already includes escalation.
Render only the approved local intervention in the requested language and tone.`;

// ═══════════════════════════════════════════════════════════════════════════
// POST-CHECK VIOLATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type PostCheckViolation =
  | 'added_diagnosis'
  | 'added_new_advice'
  | 'changed_therapeutic_meaning'
  | 'unauthorized_escalation'
  | 'minimized_risk'
  | 'invented_medical_claims'
  | 'contradicted_engine_output'
  | 'referenced_unprovided_data';

export interface PostCheckResult {
  passed: boolean;
  violations: PostCheckViolation[];
  reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// GDPR COMPLIANCE NOTE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GDPR COMPLIANCE NOTE — RecoFree x OpenAI
 *
 * Date: June 2026
 * DPA: Signed via Ironclad (OpenAI Data Processing Agreement)
 *
 * Data flow:
 * 1. All therapeutic decisions are made LOCALLY on-device
 * 2. OpenAI receives ONLY pre-approved intervention text for language rendering
 * 3. OpenAI is instructed to NOT store any data (store: false)
 * 4. No hosted tools, web search, file search, or MCP tools are enabled
 * 5. A local post-check validates every OpenAI response before display
 * 6. If post-check fails, local fallback text is shown instead
 *
 * Data minimization:
 * - No full journal history sent
 * - No full rugzak/life story sent
 * - No raw crisis or relapse history sent
 * - No complete user profiles sent
 * - Only locally-approved, minimized intervention text is sent
 *
 * Legal basis: Legitimate interest (Art. 6(1)(f) GDPR)
 * Data subject rights: All user data stored locally on device
 * Sub-processor: OpenAI (DPA in place, no data retention)
 */
export const GDPR_COMPLIANCE_VERSION = '1.0.0';
export const GDPR_DPA_SIGNED = true;
export const GDPR_DPA_PROVIDER = 'Ironclad';
export const GDPR_LEGAL_BASIS = 'Art. 6(1)(f) GDPR — Legitimate interest';
