/**
 * Relational Anchor Detector — Engine Spec V2, Section 16
 *
 * Detects named persons and their exact relationship roles from the backpack text.
 * These are NOT normal context items — they are emotional anchors.
 *
 * Runs locally before every AI request.
 * GPT never decides relationship relevance.
 *
 * Scoring per anchor:
 *   - direct mention in current message → +4
 *   - implicit mention (role word without name) → +2
 *   - recent flag support → +2
 *   - emotional language around the relation → +2
 *   - stored emotional_weight (1-5) → +weight
 *
 * Selection:
 *   - max 1 relational anchor per message
 *   - only include if score >= 5
 */

import type { Backpack, UserDat } from '../ai/types';

// ─── Types ────────────────────────────────────────────────────────

export interface RelationalAnchor {
  /** The person's name as written by the user */
  name: string;
  /** The relationship role */
  role: string;
  /** Normalized English role for internal use */
  roleEN: string;
  /** Emotional weight (1-5), derived from context */
  emotionalWeight: number;
  /** Source section ID from backpack */
  sourceSection?: string;
}

export interface AnchorDetectionResult {
  /** All detected anchors from the backpack */
  allAnchors: RelationalAnchor[];
  /** The single most relevant anchor for this message (null if none scores >= 5) */
  selectedAnchor: RelationalAnchor | null;
  /** Score of the selected anchor */
  selectedScore: number;
}

// ─── Relationship Patterns ────────────────────────────────────────

interface RolePattern {
  /** Regex pattern to match in text */
  pattern: RegExp;
  /** Normalized English role */
  roleEN: string;
  /** Base emotional weight (1-5) */
  baseWeight: number;
}

/**
 * English relationship patterns.
 * Each pattern captures the NAME after the relationship word.
 * Order matters: more specific patterns first.
 */
const ROLE_PATTERNS: RolePattern[] = [
  // Patterns with name capture ("my [role] [Name]")
  { pattern: /\bmy\s+son\s+(\w+)/gi, roleEN: 'son', baseWeight: 5 },
  { pattern: /\bmy\s+daughter\s+(\w+)/gi, roleEN: 'daughter', baseWeight: 5 },
  { pattern: /\bmy\s+wife\s+(\w+)/gi, roleEN: 'wife', baseWeight: 5 },
  { pattern: /\bmy\s+husband\s+(\w+)/gi, roleEN: 'husband', baseWeight: 5 },
  { pattern: /\bmy\s+girlfriend\s+(\w+)/gi, roleEN: 'partner', baseWeight: 5 },
  { pattern: /\bmy\s+boyfriend\s+(\w+)/gi, roleEN: 'partner', baseWeight: 4 },
  { pattern: /\bmy\s+partner\s+(\w+)/gi, roleEN: 'partner', baseWeight: 5 },
  { pattern: /\bmy\s+ex(?:-wife|-husband|-girlfriend|-boyfriend|-partner)?\s+(\w+)/gi, roleEN: 'ex', baseWeight: 4 },
  { pattern: /\bmy\s+mother\s+(\w+)/gi, roleEN: 'mother', baseWeight: 4 },
  { pattern: /\bmy\s+father\s+(\w+)/gi, roleEN: 'father', baseWeight: 4 },
  { pattern: /\bmy\s+mom\s+(\w+)/gi, roleEN: 'mother', baseWeight: 4 },
  { pattern: /\bmy\s+dad\s+(\w+)/gi, roleEN: 'father', baseWeight: 4 },
  { pattern: /\bmy\s+sister\s+(\w+)/gi, roleEN: 'sister', baseWeight: 3 },
  { pattern: /\bmy\s+brother\s+(\w+)/gi, roleEN: 'brother', baseWeight: 3 },
  { pattern: /\bmy\s+grandmother\s+(\w+)/gi, roleEN: 'grandmother', baseWeight: 3 },
  { pattern: /\bmy\s+grandfather\s+(\w+)/gi, roleEN: 'grandfather', baseWeight: 3 },
  { pattern: /\bmy\s+grandma\s+(\w+)/gi, roleEN: 'grandmother', baseWeight: 3 },
  { pattern: /\bmy\s+grandpa\s+(\w+)/gi, roleEN: 'grandfather', baseWeight: 3 },
  { pattern: /\bmy\s+cousin\s+(\w+)/gi, roleEN: 'cousin', baseWeight: 2 },
  { pattern: /\bmy\s+colleague\s+(\w+)/gi, roleEN: 'colleague', baseWeight: 2 },
  { pattern: /\bmy\s+boss\s+(\w+)/gi, roleEN: 'boss', baseWeight: 3 },
  { pattern: /\bmy\s+therapist\s+(\w+)/gi, roleEN: 'therapist', baseWeight: 3 },
  { pattern: /\bmy\s+doctor\s+(\w+)/gi, roleEN: 'doctor', baseWeight: 2 },
  { pattern: /\bmy\s+neighbor\s+(\w+)/gi, roleEN: 'neighbor', baseWeight: 2 },
  { pattern: /\bmy\s+friend\s+(\w+)/gi, roleEN: 'friend', baseWeight: 2 },

  // Patterns without name (role only)
  { pattern: /\bmy\s+(son)\b/gi, roleEN: 'son', baseWeight: 5 },
  { pattern: /\bmy\s+(daughter)\b/gi, roleEN: 'daughter', baseWeight: 5 },
  { pattern: /\bmy\s+(wife)\b/gi, roleEN: 'wife', baseWeight: 5 },
  { pattern: /\bmy\s+(husband)\b/gi, roleEN: 'husband', baseWeight: 5 },
  { pattern: /\bmy\s+(girlfriend|boyfriend)\b/gi, roleEN: 'partner', baseWeight: 5 },
  { pattern: /\bmy\s+(partner)\b/gi, roleEN: 'partner', baseWeight: 5 },
  { pattern: /\bmy\s+(mother|mom)\b/gi, roleEN: 'mother', baseWeight: 4 },
  { pattern: /\bmy\s+(father|dad)\b/gi, roleEN: 'father', baseWeight: 4 },
  { pattern: /\bmy\s+(sister)\b/gi, roleEN: 'sister', baseWeight: 3 },
  { pattern: /\bmy\s+(brother)\b/gi, roleEN: 'brother', baseWeight: 3 },
  { pattern: /\bmy\s+(grandmother|grandma)\b/gi, roleEN: 'grandmother', baseWeight: 3 },
  { pattern: /\bmy\s+(grandfather|grandpa)\b/gi, roleEN: 'grandfather', baseWeight: 3 },
  { pattern: /\bmy\s+(ex)\b/gi, roleEN: 'ex', baseWeight: 4 },
];

/**
 * Emotional language patterns that boost anchor weight.
 */
const EMOTIONAL_PATTERNS = [
  /\b(miss|missing|lost|gone|died|death|grief|mourning)\b/i,
  /\b(love|care|caring)\b/i,
  /\b(angry|furious|rage|frustrated)\b/i,
  /\b(guilt|shame|sorry|regret)\b/i,
  /\b(afraid|scared|fear|worried|anxious)\b/i,
  /\b(hurt|pain|wounded|sad|sorrow)\b/i,
  /\b(proud|grateful|happy)\b/i,
  /\b(disappointed|betrayed)\b/i,
];

/**
 * Role words (without "my") for implicit mention detection.
 */
const IMPLICIT_ROLE_WORDS: Record<string, string> = {
  'son': 'son', 'daughter': 'daughter', 'wife': 'wife', 'husband': 'husband',
  'girlfriend': 'partner', 'boyfriend': 'partner', 'partner': 'partner', 'ex': 'ex',
  'mother': 'mother', 'mom': 'mother', 'father': 'father', 'dad': 'father',
  'sister': 'sister', 'brother': 'brother', 'grandmother': 'grandmother',
  'grandfather': 'grandfather', 'grandma': 'grandmother', 'grandpa': 'grandfather',
  'cousin': 'cousin', 'colleague': 'colleague', 'boss': 'boss',
  'therapist': 'therapist', 'doctor': 'doctor', 'neighbor': 'neighbor', 'friend': 'friend',
};

// ─── Extraction ───────────────────────────────────────────────────

/**
 * Extract all relational anchors from the backpack text.
 * Scans all life story sections + intake context.
 */
export function extractRelationalAnchors(backpack: Backpack): RelationalAnchor[] {
  const anchors: RelationalAnchor[] = [];
  const seen = new Set<string>(); // Deduplicate by name (lowercase)

  const sections = backpack.sections || [];
  const allTexts: Array<{ text: string; sectionId?: string }> = [
    ...sections.map(s => ({ text: s.content || '', sectionId: s.id })),
    { text: backpack.intakeContext?.initialContext || '' },
  ];

  for (const { text, sectionId } of allTexts) {
    if (!text || text.trim().length < 5) continue;

    for (const rp of ROLE_PATTERNS) {
      // Reset regex lastIndex for global patterns
      rp.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = rp.pattern.exec(text)) !== null) {
        const captured = match[1]?.trim();
        if (!captured || captured.length < 2) continue;

        // Check if captured is a name (starts with uppercase) or a role word
        const isName = /^[A-Z]/.test(captured);
        const name = isName ? captured : '';
        const role = isName ? '' : captured;

        if (!name && !role) continue;

        const key = (name || role).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        // Check for emotional language nearby (within 100 chars)
        const matchIdx = match.index;
        const nearby = text.slice(Math.max(0, matchIdx - 100), matchIdx + match[0].length + 100);
        const hasEmotionalContext = EMOTIONAL_PATTERNS.some(ep => ep.test(nearby));

        const anchor: RelationalAnchor = {
          name: name || `[${role}]`,
          role: role || rp.roleEN,
          roleEN: rp.roleEN,
          emotionalWeight: Math.min(5, rp.baseWeight + (hasEmotionalContext ? 1 : 0)),
          sourceSection: sectionId,
        };

        anchors.push(anchor);
      }
    }
  }

  return anchors;
}

// ─── Selection (per message) ──────────────────────────────────────

/**
 * Select the single most relevant relational anchor for the current message.
 *
 * Scoring:
 *   - direct mention (name appears in message) → +4
 *   - implicit mention (role word in message) → +2
 *   - recent flag support → +2
 *   - emotional language in message → +2
 *   - stored emotional_weight → +weight
 *
 * Only include if score >= 5.
 */
export function selectRelationalAnchor(
  message: string,
  anchors: RelationalAnchor[],
  recentFlags: string[] = [],
): AnchorDetectionResult {
  if (anchors.length === 0 || !message || message.trim().length === 0) {
    return { allAnchors: anchors, selectedAnchor: null, selectedScore: 0 };
  }

  const lowerMsg = message.toLowerCase();
  const hasEmotionalMsg = EMOTIONAL_PATTERNS.some(ep => ep.test(message));

  let bestAnchor: RelationalAnchor | null = null;
  let bestScore = 0;

  for (const anchor of anchors) {
    let score = 0;

    // Direct mention: name appears in message
    if (anchor.name && anchor.name !== `[${anchor.role}]`) {
      if (lowerMsg.includes(anchor.name.toLowerCase())) {
        score += 4;
      }
    }

    // Implicit mention: role word appears in message
    const roleWords = Object.entries(IMPLICIT_ROLE_WORDS)
      .filter(([_, en]) => en === anchor.roleEN)
      .map(([word]) => word);
    for (const rw of roleWords) {
      if (new RegExp(`\\b${rw}\\b`, 'i').test(message)) {
        score += 2;
        break;
      }
    }

    // Recent flag support
    if (recentFlags.some(f => f.toLowerCase().includes(anchor.roleEN) || f.toLowerCase().includes(anchor.name.toLowerCase()))) {
      score += 2;
    }

    // Emotional language in message
    if (hasEmotionalMsg) {
      score += 2;
    }

    // Stored emotional weight
    score += anchor.emotionalWeight;

    if (score > bestScore) {
      bestScore = score;
      bestAnchor = anchor;
    }
  }

  // Only include if score >= 5
  if (bestScore < 5) {
    return { allAnchors: anchors, selectedAnchor: null, selectedScore: 0 };
  }

  return { allAnchors: anchors, selectedAnchor: bestAnchor, selectedScore: bestScore };
}

/**
 * Full detection pipeline: extract from backpack + select for message.
 */
export function detectRelationalAnchor(
  message: string,
  backpack: Backpack,
  recentFlags: string[] = [],
): AnchorDetectionResult {
  const anchors = extractRelationalAnchors(backpack);
  return selectRelationalAnchor(message, anchors, recentFlags);
}
