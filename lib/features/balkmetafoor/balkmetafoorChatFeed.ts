/**
 * Balkmetafoor Chat Feed Parser
 * Extracts draaglast (burden) and draagkracht (capacity/support) items
 * from AI responses when PAAL01 is active in reflection mode.
 *
 * Uses pattern matching on the AI response to detect items the AI
 * has identified or reflected back to the user.
 */

export interface BalkmetafoorExtractedItems {
  draaglast: string[];
  draagkracht: string[];
}

/**
 * Draaglast markers — things that weigh someone down.
 * The AI typically reflects these back in structured format.
 */
const DRAAGLAST_MARKERS_NL = [
  /(?:draaglast|belasting|last|druk|stress|zorgen|moeilijk).*?[:：]\s*(.+)/gi,
  /(?:wat.*(?:zwaar|moeilijk|lastig).*(?:valt|is|maakt)).*?[:：]\s*(.+)/gi,
  /(?:je draagt|je hebt.*last van|je worstelt met)\s+(.+)/gi,
];

const DRAAGLAST_MARKERS_EN = [
  /(?:burden|stress|pressure|weight|struggle|difficulty).*?[:：]\s*(.+)/gi,
  /(?:what.*(?:weighs|heavy|difficult|hard)).*?[:：]\s*(.+)/gi,
  /(?:you carry|you struggle with|you deal with)\s+(.+)/gi,
];

/**
 * Draagkracht markers — things that give strength/support.
 */
const DRAAGKRACHT_MARKERS_NL = [
  /(?:draagkracht|steun|kracht|hulpbron|houvast|pilaar).*?[:：]\s*(.+)/gi,
  /(?:wat.*(?:helpt|steunt|kracht geeft|houvast biedt)).*?[:：]\s*(.+)/gi,
  /(?:je hebt|je kunt rekenen op|je vindt steun bij)\s+(.+)/gi,
];

const DRAAGKRACHT_MARKERS_EN = [
  /(?:support|strength|resource|pillar|capacity|resilience).*?[:：]\s*(.+)/gi,
  /(?:what.*(?:helps|supports|gives.*strength)).*?[:：]\s*(.+)/gi,
  /(?:you have|you can rely on|you find support in)\s+(.+)/gi,
];

/**
 * Structured list detection — AI often uses bullet points or numbered lists
 * within draaglast/draagkracht sections.
 */
function extractListItems(text: string, sectionStart: number, sectionEnd: number): string[] {
  const section = text.slice(sectionStart, sectionEnd);
  const items: string[] = [];
  // Match bullet points: - item, • item, * item, or numbered: 1. item, 1) item
  const listRegex = /(?:^|\n)\s*(?:[-•*]|\d+[.)]\s)\s*(.+)/g;
  let match: RegExpExecArray | null;
  while ((match = listRegex.exec(section)) !== null) {
    const item = match[1].trim();
    if (item.length > 3 && item.length < 120) {
      items.push(item);
    }
  }
  return items;
}

/**
 * Detect structured sections in AI response.
 * The AI often writes:
 * "Draaglast: ..." or "**Draaglast:**" followed by items
 * "Draagkracht: ..." or "**Draagkracht:**" followed by items
 */
function extractStructuredSections(text: string): BalkmetafoorExtractedItems {
  const draaglast: string[] = [];
  const draagkracht: string[] = [];

  // Find draaglast section headers
  const draaglastHeaders = [
    /(?:\*\*)?(?:draaglast|belasting|wat weegt|wat drukt)(?:\*\*)?[\s:：]/gi,
    /(?:\*\*)?(?:burdens?|stressors?|what weighs)(?:\*\*)?[\s:：]/gi,
  ];

  // Find draagkracht section headers
  const draagkrachtHeaders = [
    /(?:\*\*)?(?:draagkracht|steunpilaren|wat helpt|wat kracht geeft|houvast)(?:\*\*)?[\s:：]/gi,
    /(?:\*\*)?(?:supports?|strengths?|resources?|what helps)(?:\*\*)?[\s:：]/gi,
  ];

  for (const regex of draaglastHeaders) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const sectionStart = match.index + match[0].length;
      // Section ends at next header or end of text (max 500 chars)
      const sectionEnd = Math.min(sectionStart + 500, text.length);
      const items = extractListItems(text, sectionStart, sectionEnd);
      draaglast.push(...items);
    }
  }

  for (const regex of draagkrachtHeaders) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const sectionStart = match.index + match[0].length;
      const sectionEnd = Math.min(sectionStart + 500, text.length);
      const items = extractListItems(text, sectionStart, sectionEnd);
      draagkracht.push(...items);
    }
  }

  return { draaglast, draagkracht };
}

/**
 * Extract balkmetafoor items from an AI response.
 * Called when PAAL01 is active in STABLE_REFLECTION or PERIODIC_UPDATE_INVITATION mode.
 *
 * Strategy:
 * 1. First try structured section detection (most reliable)
 * 2. Fall back to inline marker detection
 * 3. Deduplicate and limit to max 5 items per category
 */
export function extractBalkmetafoorItemsFromResponse(aiResponse: string): BalkmetafoorExtractedItems {
  // Strip clinical/engine_signals blocks
  const cleanText = aiResponse
    .replace(/<clinical>[\s\S]*?<\/clinical>/g, '')
    .replace(/<engine_signals>[\s\S]*?<\/engine_signals>/g, '')
    .trim();

  if (!cleanText) return { draaglast: [], draagkracht: [] };

  // Strategy 1: Structured sections
  const structured = extractStructuredSections(cleanText);

  // Strategy 2: Inline markers (only if structured found nothing)
  if (structured.draaglast.length === 0 && structured.draagkracht.length === 0) {
    const allMarkers = [...DRAAGLAST_MARKERS_NL, ...DRAAGLAST_MARKERS_EN];
    for (const regex of allMarkers) {
      let match: RegExpExecArray | null;
      const r = new RegExp(regex.source, regex.flags);
      while ((match = r.exec(cleanText)) !== null) {
        const item = match[1]?.trim();
        if (item && item.length > 3 && item.length < 120) {
          structured.draaglast.push(item);
        }
      }
    }

    const allDkMarkers = [...DRAAGKRACHT_MARKERS_NL, ...DRAAGKRACHT_MARKERS_EN];
    for (const regex of allDkMarkers) {
      let match: RegExpExecArray | null;
      const r = new RegExp(regex.source, regex.flags);
      while ((match = r.exec(cleanText)) !== null) {
        const item = match[1]?.trim();
        if (item && item.length > 3 && item.length < 120) {
          structured.draagkracht.push(item);
        }
      }
    }
  }

  // Deduplicate and limit
  const uniqueDraaglast = [...new Set(structured.draaglast)].slice(0, 5);
  const uniqueDraagkracht = [...new Set(structured.draagkracht)].slice(0, 5);

  return {
    draaglast: uniqueDraaglast,
    draagkracht: uniqueDraagkracht,
  };
}
