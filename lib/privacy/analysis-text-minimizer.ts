export const MAX_ANALYSIS_TEXT_CHARS = 24_000;

export interface MinimizedAnalysisText {
  text: string;
  truncated: boolean;
  redactions: number;
}

const REDACTION_RULES: ReadonlyArray<[RegExp, string]> = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email omitted]'],
  [/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,5}\d{2,4}/g, '[phone omitted]'],
  [/\b\d{1,2}[\/-]\d{1,2}[\/-](?:19|20)\d{2}\b/g, '[date omitted]'],
  [/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g, '[date omitted]'],
  [/\b(?:bearer|api[_ -]?key|token)\s*[:=]\s*[A-Za-z0-9._-]{16,}\b/gi, '[secret omitted]'],
];

/**
 * Produce a bounded analysis fragment instead of forwarding an unredacted
 * document or memory dump. Meaningful narrative remains available, while
 * direct contact data, exact dates and credentials are removed.
 */
export function minimizeAnalysisText(
  value: string,
  maxChars = MAX_ANALYSIS_TEXT_CHARS,
): MinimizedAnalysisText {
  let text = typeof value === 'string' ? value : '';
  let redactions = 0;

  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
  for (const [pattern, replacement] of REDACTION_RULES) {
    text = text.replace(pattern, () => {
      redactions += 1;
      return replacement;
    });
  }

  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const truncated = text.length > maxChars;
  if (truncated) text = text.slice(0, maxChars).trimEnd();
  return { text, truncated, redactions };
}
