/**
 * Elias Stage of Change — Centralized stage-related content and defaults
 *
 * All Elias-specific stage-of-change descriptions and defaults live here.
 * No behavioral logic — pure content and configuration.
 *
 * Extracted from server/ai-chat.ts to achieve single source of truth.
 */

// ─── DEFAULT STAGE ─────────────────────────────────────────────

/**
 * Default stage of change when none is specified.
 * Used across pipeline, gpt-payload-builder, and user-context for fallback.
 */
export const ELIAS_DEFAULT_STAGE = 'contemplation' as const;

// ─── STAGE DESCRIPTIONS (Follow-up / Selective Injection) ──────

/**
 * Short stage descriptions used in the selective relevance block
 * for follow-up messages (conditional injection).
 *
 * Source: ai-chat.ts buildSelectiveRelevanceBlock() line 576
 */
export const ELIAS_STAGE_DESCRIPTIONS_SHORT: Record<string, string> = {
  precontemplation: 'Nog niet klaar voor verandering — niet pushen',
  contemplation: 'Overweegt verandering — ambivalentie verkennen',
  preparation: 'Bereidt zich voor — concrete stappen helpen',
  action: 'Actief bezig — successen bevestigen',
  maintenance: 'Houdt vol — terugvalpreventie',
};

// ─── STAGE DESCRIPTIONS (Session Start / Full Relevance) ───────

/**
 * Extended stage descriptions used in the full relevance block
 * for session-start messages.
 *
 * Source: ai-chat.ts buildFullRelevanceBlock() line 645
 */
export const ELIAS_STAGE_DESCRIPTIONS_FULL: Record<string, string> = {
  precontemplation: 'Nog niet klaar voor verandering — bewustwording stimuleren, niet pushen',
  contemplation: 'Overweegt verandering — ambivalentie verkennen, motivatie ondersteunen',
  preparation: 'Bereidt zich voor op verandering — concrete stappen helpen plannen',
  action: 'Actief bezig met verandering — successen bevestigen, obstakels bespreken',
  maintenance: 'Houdt verandering vol — terugvalpreventie, groei bevestigen',
};
