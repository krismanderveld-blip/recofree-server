/**
 * Session Greeting Engine — Server Endpoint
 * POST /api/session-greeting
 * 
 * Accepts a system prompt from the client-side engine and generates a greeting via GPT-4o.
 * When clinicalModeActive is true, also generates a clinical annotation via a second GPT call.
 * Model: gpt-4o-mini, store: false, max_tokens: 1590, temperature: 0.7
 */

import type { Express, Request, Response } from 'express';

export function registerSessionGreetingRoute(app: Express): void {
  app.post('/api/session-greeting', async (req: Request, res: Response) => {
    try {
      const { systemPrompt, userName, clinicalModeActive, vspInsightContext } = req.body;

      if (!systemPrompt || typeof systemPrompt !== 'string') {
        res.status(400).json({ error: 'systemPrompt is required and must be a string' });
        return;
      }
      if (!userName || typeof userName !== 'string') {
        res.status(400).json({ error: 'userName is required and must be a string' });
        return;
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
        return;
      }

      const isClinical = clinicalModeActive === true;
      console.log(`[SessionGreeting] Generating greeting for userName="${userName}", promptLength=${systemPrompt.length}, clinical=${isClinical}`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          store: false,
          temperature: 0.7,
          max_tokens: 1590,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Generate a personal greeting for ${userName}. Follow the language instruction in the system prompt exactly.` },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SessionGreeting] OpenAI error:', response.status, errorText);
        res.status(502).json({ error: `OpenAI error: ${response.status}` });
        return;
      }

      const data = await response.json() as any;
      let greeting = data.choices?.[0]?.message?.content?.trim();

      if (!greeting) {
        console.error('[SessionGreeting] No content in response');
        res.status(502).json({ error: 'No greeting in GPT response' });
        return;
      }

      console.log(`[SessionGreeting] Success: "${greeting.slice(0, 60)}..."`);

      // ─── CLINICAL ANNOTATION (separate GPT-4o call when clinical mode is active) ───
      if (isClinical) {
        try {
          const clinicalAnnotation = await generateGreetingClinicalAnnotation(
            apiKey,
            greeting,
            systemPrompt,
            userName,
          );
          if (clinicalAnnotation) {
            // Deterministic VSP-Framework injection
            const vspLine = vspInsightContext
              ? `\nVSP-Framework: ${(vspInsightContext as string).match(/Framework: (\w+)/)?.[1] ?? 'MI'}`
              : '';
            greeting = `${greeting}\n<clinical>${vspLine}\n${clinicalAnnotation}</clinical>`;
            console.log(`[SessionGreeting] Clinical annotation appended (${clinicalAnnotation.length} chars) vsp=${vspLine ? 'yes' : 'no'}`);
          } else if (vspInsightContext) {
            // No annotation from GPT but VSP is active — inject minimal clinical tag
            const fw = (vspInsightContext as string).match(/Framework: (\w+)/)?.[1] ?? 'MI';
            greeting = `${greeting}\n<clinical>\nVSP-Framework: ${fw}\nMethod: Therapeutic greeting\nObservation: Session start\nIntervention: Warm opening + open question</clinical>`;
            console.log(`[SessionGreeting] Minimal clinical tag with VSP-Framework: ${fw}`);
          }
        } catch (clinicalErr) {
          console.warn('[SessionGreeting] Clinical annotation failed, sending greeting without it:', clinicalErr);
          // Still return the greeting without annotation rather than failing
        }
      }

      res.json({
        success: true,
        greeting,
      });
    } catch (error) {
      console.error('[SessionGreeting] Unexpected error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

// ─── CLINICAL ANNOTATION GENERATOR ─────────────────────────────────────────

async function generateGreetingClinicalAnnotation(
  apiKey: string,
  greeting: string,
  systemPrompt: string,
  userName: string,
): Promise<string | null> {
  const annotationPrompt = `You are a clinical annotation engine for a therapeutic AI companion called Elias.
A greeting was just generated for the user "${userName}".

GREETING SYSTEM PROMPT (what the engine decided):
---
${systemPrompt.slice(0, 800)}
---

GENERATED GREETING:
---
${greeting}
---

Produce a concise clinical annotation (max 100 words) covering:
1. Greeting strategy: what data sources informed this greeting
2. Tone assessment: appropriate warmth/safety level
3. Risk flags: any concerns (none if clean)
4. Compliance: did the greeting follow the engine instructions

Format: plain text, no markdown, no headers. Write in English for clinical readability.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      store: false,
      temperature: 0.3,
      max_tokens: 150,
      messages: [
        { role: 'system', content: annotationPrompt },
        { role: 'user', content: 'Generate the clinical annotation for this greeting.' },
      ],
    }),
  });

  if (!response.ok) {
    console.warn('[SessionGreeting] Clinical annotation GPT error:', response.status);
    return null;
  }

  const data = await response.json() as any;
  const annotation = data.choices?.[0]?.message?.content?.trim();
  return annotation || null;
}
