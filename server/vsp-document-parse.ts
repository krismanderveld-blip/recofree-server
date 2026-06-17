/**
 * VSP Document Parse Endpoint
 *
 * Accepts raw text from an uploaded VSP document and uses GPT to extract
 * all fields into a VspStructuredPlan. Gracefully handles incomplete documents —
 * zones that are not present remain empty, triggers and recovery rules are optional.
 *
 * Model: gpt-4o (always)
 * store: false (mandatory — personal safety plan data)
 * Temperature: 0 (deterministic extraction)
 * Max tokens: 4000
 */
import type { Request, Response, Express } from 'express';

const VSP_PARSE_SYSTEM_PROMPT = `You are a clinical extraction tool for RecoFree. You receive the full text of a user's personal safety plan (Vroegsignaleringsplan / VSP).

Your task: extract the content into a structured JSON format that maps to the app's UI fields. The document may be in Dutch or English.

IMPORTANT RULES:
- Only extract what is explicitly written. Never invent or assume content.
- If a zone is not present in the document, leave its fields as empty strings.
- If triggers are not present, return an empty array.
- If recovery rules are not present, return an empty array.
- If the main anchor sentence is not present, return an empty string.
- Preserve the user's own words as much as possible. Do not rephrase or summarize.
- Signals and whatHelps should be the full text the user wrote for that section (can be multiple paragraphs with bullet points).
- The anchorSentence is typically a single sentence the user identifies as their key phrase for that zone.
- Not every document has all 5 zones filled in. That is normal. Leave missing zones empty.

=== APP UI FIELD MAPPING ===

The app shows 5 zone cards (GROEN, GEEL, ORANJE, ROOD, PAARS). Each zone has 3 fields in the UI:

1. "Hoe herken ik mezelf?" (signals)
   → The user's personal recognition signals for this zone: thoughts, feelings, behaviors, physical signs.
   → In the document: look for "Hoe ik mezelf herken in [zone]" or lists of signals/signs.

2. "Wat helpt?" (whatHelps)
   → Concrete actions, strategies, and things the user does (or must happen) in this zone.
   → In the document: look for "Wat ik doe in [zone]" / "Wat moet gebeuren in [zone]".

3. "Mijn ankerzin" (anchorSentence)
   → One personal sentence that captures the essence of this zone for the user.
   → In the document: look for "Mijn zin voor [zone]" or a clearly marked personal sentence.

Additionally, the app has:

4. "Triggers" section — personal core triggers with counter-thoughts:
   → Each trigger has a name/description and a "tegenzin" (counter-thought).
   → In the document: look for "KERNTRIGGERS" / "TRIGGERS" section.

5. "Herstelregels" section — personal recovery rules:
   → Numbered or listed rules the user lives by.
   → In the document: look for "HERSTELREGELS" / "RECOVERY RULES".

6. "Mijn belangrijkste zin" — one overarching anchor sentence:
   → In the document: look for "MIJN BELANGRIJKSTE ZIN".

=== ZONE MAPPING (Dutch → JSON key) ===
- GROEN / GREEN → "green"
- GEEL / YELLOW → "yellow"
- ORANJE / ORANGE → "orange"
- ROOD / RED → "red"
- PAARS / PURPLE → "purple"

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "zones": {
    "green": { "signals": "...", "whatHelps": "...", "anchorSentence": "..." },
    "yellow": { "signals": "...", "whatHelps": "...", "anchorSentence": "..." },
    "orange": { "signals": "...", "whatHelps": "...", "anchorSentence": "..." },
    "red": { "signals": "...", "whatHelps": "...", "anchorSentence": "..." },
    "purple": { "signals": "...", "whatHelps": "...", "anchorSentence": "..." }
  },
  "triggers": [
    { "trigger": "...", "counterThought": "..." }
  ],
  "recoveryRules": ["rule 1", "rule 2"],
  "mainAnchorSentence": "..."
}

If a zone has no content at all, use: { "signals": "", "whatHelps": "", "anchorSentence": "" }
If there are no triggers, use: []
If there are no recovery rules, use: []`;

export function registerVspDocumentParseRoute(app: Express): void {
  app.post('/api/vsp/parse-document', async (req: Request, res: Response) => {
    try {
      const { documentText } = req.body;
      if (!documentText || typeof documentText !== 'string') {
        res.status(400).json({ error: 'documentText is required and must be a string' });
        return;
      }

      if (documentText.trim().length < 20) {
        res.status(400).json({ error: 'Document text is too short to parse' });
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
        return;
      }

      console.log(`[VspDocumentParse] Starting parse, textLength=${documentText.length}`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          store: false,
          temperature: 0,
          max_tokens: 4000,
          messages: [
            { role: 'system', content: VSP_PARSE_SYSTEM_PROMPT },
            { role: 'user', content: `Parse this VSP document into structured format:\n\n${documentText}` },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VspDocumentParse] OpenAI error:', response.status, errorText);
        res.status(502).json({ error: `OpenAI error: ${response.status}` });
        return;
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        res.status(502).json({ error: 'No content in GPT response' });
        return;
      }

      let parsed: any;
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.error('[VspDocumentParse] Failed to parse GPT output:', content.slice(0, 300));
        res.status(502).json({ error: 'Failed to parse extraction result' });
        return;
      }

      // Normalize: ensure all expected fields exist with safe defaults
      const emptyZone = { signals: '', whatHelps: '', anchorSentence: '' };
      const result = {
        zones: {
          green: { ...emptyZone, ...(parsed.zones?.green || {}) },
          yellow: { ...emptyZone, ...(parsed.zones?.yellow || {}) },
          orange: { ...emptyZone, ...(parsed.zones?.orange || {}) },
          red: { ...emptyZone, ...(parsed.zones?.red || {}) },
          purple: { ...emptyZone, ...(parsed.zones?.purple || {}) },
        },
        triggers: Array.isArray(parsed.triggers)
          ? parsed.triggers
              .filter((t: any) => t && (t.trigger || t.counterThought))
              .map((t: any) => ({
                trigger: String(t.trigger || ''),
                counterThought: String(t.counterThought || ''),
              }))
          : [],
        recoveryRules: Array.isArray(parsed.recoveryRules)
          ? parsed.recoveryRules.filter((r: any) => typeof r === 'string' && r.trim().length > 0)
          : [],
        mainAnchorSentence: typeof parsed.mainAnchorSentence === 'string'
          ? parsed.mainAnchorSentence
          : '',
      };

      // Ensure all zone fields are strings
      for (const zone of Object.values(result.zones) as any[]) {
        zone.signals = typeof zone.signals === 'string' ? zone.signals : '';
        zone.whatHelps = typeof zone.whatHelps === 'string' ? zone.whatHelps : '';
        zone.anchorSentence = typeof zone.anchorSentence === 'string' ? zone.anchorSentence : '';
      }

      const filledZones = Object.values(result.zones).filter(
        (z: any) => z.signals || z.whatHelps || z.anchorSentence
      ).length;
      console.log(`[VspDocumentParse] Success: ${filledZones}/5 zones filled, ${result.triggers.length} triggers, ${result.recoveryRules.length} rules`);

      res.json({ success: true, vspPlan: result });
    } catch (error) {
      console.error('[VspDocumentParse] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
