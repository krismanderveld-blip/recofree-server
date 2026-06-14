/**
 * Backpack Deep Analysis Endpoint
 *
 * Analyzes the full backpack text to extract schemas, modes, triggers,
 * core beliefs, and coping patterns. Uses GPT-4o for high-quality extraction.
 *
 * Model: gpt-4o (always)
 * store: false (mandatory)
 * Temperature: 0 (deterministic)
 * Max tokens: 2000
 */
import type { Request, Response, Express } from 'express';

const SYSTEM_PROMPT = `You are a clinical analysis tool for RecoFree. You receive the full contents of a user backpack in JSON format.

Analyze the complete text and extract ALL present schemas, modes, triggers, core beliefs and coping patterns. Be exhaustive — name everything present, including implicit patterns.

Return ONLY valid JSON, no markdown, no explanation.

Schemas to detect (not exhaustive):
verlating/instabiliteit, minderwaardigheid/schaamte, emotionele deprivatie, wantrouwen/misbruik, onvoldoende zelfcontrole, zelfopoffering, sociale isolatie, mislukking, afhankelijkheid/incompetentie, verhoogde normen/meedogenloosheid, aanspraakmakendheid/grootsheid, bestraffing, negativiteit/pessimisme

Modes to detect:
onthechte beschermer, kwetsbare kind, straffende ouder, impulsieve kind, gezonde volwassene, boze kind, gehoorzame overgave

Return this exact format:
{
  "schemas": [
    { "name": "verlating/instabiliteit", "confidence": 0.9, "evidence": "short text quote or paraphrase" }
  ],
  "modi": [
    { "name": "onthechte beschermer", "confidence": 0.8, "evidence": "..." }
  ],
  "triggers": ["trigger1", "trigger2"],
  "coreBeliefs": ["belief1", "belief2"],
  "copingPatterns": ["pattern1", "pattern2"],
  "analysisVersion": 1,
  "analyzedAt": "<ISO timestamp>"
}`;

export interface BackpackAnalysisResult {
  schemas: Array<{ name: string; confidence: number; evidence: string }>;
  modi: Array<{ name: string; confidence: number; evidence: string }>;
  triggers: string[];
  coreBeliefs: string[];
  copingPatterns: string[];
  analysisVersion: number;
  analyzedAt: string;
}

export function registerBackpackAnalysisRoute(app: Express): void {
  app.post('/api/backpack/analyze', async (req: Request, res: Response) => {
    try {
      const { userId, backpackText } = req.body;
      if (!backpackText || typeof backpackText !== 'string') {
        res.status(400).json({ error: 'backpackText is required and must be a string' });
        return;
      }
      if (!userId || typeof userId !== 'string') {
        res.status(400).json({ error: 'userId is required and must be a string' });
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
        return;
      }

      console.log(`[BackpackAnalysis] Starting analysis for userId=${userId}, textLength=${backpackText.length}`);

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
          max_tokens: 2000,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Analyze this backpack:\n\n${backpackText}` },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BackpackAnalysis] OpenAI error:', response.status, errorText);
        res.status(502).json({ error: `OpenAI error: ${response.status}` });
        return;
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.error('[BackpackAnalysis] No content in response');
        res.status(502).json({ error: 'No content in GPT response' });
        return;
      }

      // Parse JSON response — handle potential markdown wrapping
      let analysisResult: BackpackAnalysisResult;
      try {
        const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        analysisResult = JSON.parse(cleaned);
        // Ensure analyzedAt is set
        if (!analysisResult.analyzedAt) {
          analysisResult.analyzedAt = new Date().toISOString();
        }
        if (!analysisResult.analysisVersion) {
          analysisResult.analysisVersion = 1;
        }
      } catch (parseErr) {
        console.error('[BackpackAnalysis] Failed to parse GPT response:', content.slice(0, 200));
        res.status(502).json({ error: 'Failed to parse analysis result', raw: content.slice(0, 500) });
        return;
      }

      console.log(`[BackpackAnalysis] Success: ${analysisResult.schemas.length} schemas, ${analysisResult.modi.length} modes, ${analysisResult.triggers.length} triggers, ${analysisResult.coreBeliefs.length} beliefs`);

      res.json({
        success: true,
        analysis: analysisResult,
      });
    } catch (error) {
      console.error('[BackpackAnalysis] Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
