/**
 * VSP Backpack Analysis Endpoint
 *
 * Analyzes recurringThemes section to extract VSP zone signals.
 * Triggered only on backpack change (client-side hash detection).
 *
 * Model: gpt-4o (always)
 * store: false (mandatory)
 * Temperature: 0 (deterministic)
 * Max tokens: 1500
 */
import type { Request, Response, Express } from 'express';

const VSP_SYSTEM_PROMPT = `You are a clinical extraction tool for RecoFree. You receive the "recurring themes" section of a user's backpack (personal safety plan / VSP).

Extract the user's personal signals per VSP zone. The zones are:
- GREEN (GROEN): signals that indicate stability, no tension, everything manageable
- YELLOW (GEEL): early warning signs, mild tension, some stress but manageable
- ORANGE (ORANJE): higher tension, time to intervene, things getting harder
- RED (ROOD): relapse near, action needed, needs support now
- PURPLE (PAARS): relapse happened, external intervention needed

Look for labels like GROEN/GREEN, GEEL/YELLOW, ORANJE/ORANGE, ROOD/RED, PAARS/PURPLE in the text.
Also detect implicit zone content based on severity/context even without explicit labels.

Extract short key phrases (max 10 words each) that describe what the user experiences per zone.

Return ONLY valid JSON, no markdown, no explanation:
{
  "green": ["phrase1", "phrase2"],
  "yellow": ["phrase1", "phrase2"],
  "orange": ["phrase1", "phrase2"],
  "red": ["phrase1", "phrase2"],
  "purple": ["phrase1", "phrase2"]
}

If a zone has no content, return an empty array for that zone.
Never diagnose. Only extract what the user wrote.`;

export function registerVspBackpackAnalysisRoute(app: Express): void {
  app.post('/api/backpack/vsp-analyze', async (req: Request, res: Response) => {
    try {
      const { themesContent } = req.body;
      if (!themesContent || typeof themesContent !== 'string') {
        res.status(400).json({ error: 'themesContent is required and must be a string' });
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
        return;
      }

      console.log(`[VspBackpackAnalysis] Starting analysis, textLength=${themesContent.length}`);

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
          max_tokens: 1500,
          messages: [
            { role: 'system', content: VSP_SYSTEM_PROMPT },
            { role: 'user', content: `Extract VSP zones from this recurring themes section:\n\n${themesContent}` },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[VspBackpackAnalysis] OpenAI error:', response.status, errorText);
        res.status(502).json({ error: `OpenAI error: ${response.status}` });
        return;
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        res.status(502).json({ error: 'No content in GPT response' });
        return;
      }

      let profile: { green: string[]; yellow: string[]; orange: string[]; red: string[]; purple: string[] };
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        profile = JSON.parse(cleaned);
        // Ensure all arrays exist
        profile.green = profile.green || [];
        profile.yellow = profile.yellow || [];
        profile.orange = profile.orange || [];
        profile.red = profile.red || [];
        profile.purple = profile.purple || [];
      } catch (parseErr) {
        console.error('[VspBackpackAnalysis] Failed to parse:', content.slice(0, 200));
        res.status(502).json({ error: 'Failed to parse analysis result' });
        return;
      }

      const totalSignals = profile.green.length + profile.yellow.length + profile.orange.length + profile.red.length + profile.purple.length;
      console.log(`[VspBackpackAnalysis] Success: ${totalSignals} signals extracted across zones`);

      res.json({ success: true, profile });
    } catch (error) {
      console.error('[VspBackpackAnalysis] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
