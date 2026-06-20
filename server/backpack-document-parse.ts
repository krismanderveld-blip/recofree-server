/**
 * Backpack Document Parse Endpoint
 *
 * Accepts raw text from an uploaded life-story / bilan document and uses GPT
 * to extract all fields into a Backpack-compatible structure.
 * Gracefully handles incomplete documents — sections that GPT couldn't extract stay empty.
 *
 * Model: gpt-4o (always)
 * store: false (mandatory — personal life story data)
 * Temperature: 0 (deterministic extraction)
 * Max tokens: 8000 (life stories can be long)
 */
import type { Request, Response, Express } from 'express';

const BACKPACK_PARSE_SYSTEM_PROMPT = `You are a clinical extraction tool for RecoFree, an addiction recovery app. You receive the full text of a user's personal life story document (levensverhaal / bilan).

Your task: extract the content into a structured JSON format that maps to the app's Backpack sections. The document may be in Dutch, English, or French.

IMPORTANT RULES:
- Only extract what is explicitly written. Never invent or assume content.
- If a section has no relevant content in the document, leave it as an empty string.
- Preserve the user's own words as much as possible. Do not rephrase or summarize.
- Content can be multiple paragraphs. Include all relevant text for each section.
- The user's name should be extracted if mentioned (e.g., "Mijn naam is..." or signature).
- If the document mentions whether the user is the person with addiction ("afhankelijkheid") or a loved one ("naaste"), detect this for userType.

=== APP BACKPACK FIELD MAPPING ===

The app has two user types:
- "elias" = person with addiction (default if unclear)
- "kim" = loved one / family member of someone with addiction

FOR ELIAS USERS, extract into these life-phase sections:

1. "childhood" (Childhood, 6-12 years)
   → Where they grew up, atmosphere at home, school years, friendships, events that made an impression.
   → Look for: early memories, family situation, school experiences, childhood trauma.

2. "adolescence" (Adolescence, 12-18 years)
   → Teenage years, home situation, school, peers, struggles or growth.
   → Look for: puberty, first substance use, social dynamics, identity formation.

3. "adulthood" (Adulthood, 18-50 years)
   → Important choices, work, relationships, children, addiction, loss, growth, meaning.
   → Look for: career, marriage, parenthood, addiction development, treatment history.

4. "family" (Family, throughout life)
   → Relationship with parents/family, patterns, loyalties, tensions.
   → Look for: family dynamics, intergenerational patterns, family conflicts.

5. "themes" (Recurring Themes, across all phases)
   → Recurring themes, beliefs, inner struggles across life phases.
   → Look for: repeated patterns, core beliefs, coping mechanisms, shame/guilt.

FOR KIM USERS, extract into these sections:

1. "my_story" (My Story)
   → Who they are outside of the relationship with the person with addiction.
   → Look for: personal identity, own interests, own life before/outside addiction.

2. "the_relationship" (The Relationship)
   → How the relationship evolved, when it changed.
   → Look for: relationship history, turning points, impact of addiction on the relationship.

3. "the_impact" (The Impact)
   → What addiction has done to their life, family, work.
   → Look for: consequences, losses, emotional toll, practical impact.

4. "my_boundaries" (My Boundaries)
   → What they can carry, what they've already tried.
   → Look for: limits, previous attempts to help, burnout, self-protection.

5. "my_strength" (My Strength)
   → Where they find strength, what they want for themselves.
   → Look for: resilience, support network, personal goals, hope.

ADDITIONALLY, extract if present:

- "naam": The user's first name (if mentioned anywhere in the document)
- "userType": "elias" or "kim" based on document content (default: "elias")
- "startEmotion": The user's current emotional state if mentioned
- "urgency": "laag" | "midden" | "hoog" — perceived urgency level if mentioned (default: "midden")
- "initialContext": A brief summary of why the user is seeking help (1-2 sentences, in their own words)
- "stageOfChange": One of "precontemplation" | "contemplation" | "preparation" | "action" | "maintenance" — if detectable from the text (default: "contemplation")

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "naam": "...",
  "userType": "elias" | "kim",
  "sections": {
    "childhood": "...",
    "adolescence": "...",
    "adulthood": "...",
    "family": "...",
    "themes": "..."
  },
  "kimSections": {
    "my_story": "...",
    "the_relationship": "...",
    "the_impact": "...",
    "my_boundaries": "...",
    "my_strength": "..."
  },
  "intakeContext": {
    "startEmotion": "...",
    "urgency": "laag" | "midden" | "hoog",
    "initialContext": "...",
    "stageOfChange": "..."
  }
}

If a section has no content, use an empty string "".
If kimSections are not applicable (elias user), still include them with empty strings.
If elias sections are not applicable (kim user), still include them with empty strings.`;

export function registerBackpackDocumentParseRoute(app: Express): void {
  app.post('/api/backpack/parse-document', async (req: Request, res: Response) => {
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

      console.log(`[BackpackDocumentParse] Starting parse, textLength=${documentText.length}`);

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
          max_tokens: 8000,
          messages: [
            { role: 'system', content: BACKPACK_PARSE_SYSTEM_PROMPT },
            { role: 'user', content: `Extract the life story / bilan into structured backpack format:\n\n${documentText}` },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BackpackDocumentParse] OpenAI error:', response.status, errorText);
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
        console.error('[BackpackDocumentParse] Failed to parse GPT output:', content.slice(0, 300));
        res.status(502).json({ error: 'Failed to parse extraction result' });
        return;
      }

      // Normalize: ensure all expected fields exist with safe defaults
      const result = {
        naam: typeof parsed.naam === 'string' ? parsed.naam : '',
        userType: parsed.userType === 'kim' ? 'kim' : 'elias',
        sections: {
          childhood: typeof parsed.sections?.childhood === 'string' ? parsed.sections.childhood : '',
          adolescence: typeof parsed.sections?.adolescence === 'string' ? parsed.sections.adolescence : '',
          adulthood: typeof parsed.sections?.adulthood === 'string' ? parsed.sections.adulthood : '',
          family: typeof parsed.sections?.family === 'string' ? parsed.sections.family : '',
          themes: typeof parsed.sections?.themes === 'string' ? parsed.sections.themes : '',
        },
        kimSections: {
          my_story: typeof parsed.kimSections?.my_story === 'string' ? parsed.kimSections.my_story : '',
          the_relationship: typeof parsed.kimSections?.the_relationship === 'string' ? parsed.kimSections.the_relationship : '',
          the_impact: typeof parsed.kimSections?.the_impact === 'string' ? parsed.kimSections.the_impact : '',
          my_boundaries: typeof parsed.kimSections?.my_boundaries === 'string' ? parsed.kimSections.my_boundaries : '',
          my_strength: typeof parsed.kimSections?.my_strength === 'string' ? parsed.kimSections.my_strength : '',
        },
        intakeContext: {
          startEmotion: typeof parsed.intakeContext?.startEmotion === 'string' ? parsed.intakeContext.startEmotion : '',
          urgency: ['laag', 'midden', 'hoog'].includes(parsed.intakeContext?.urgency)
            ? parsed.intakeContext.urgency
            : 'midden',
          initialContext: typeof parsed.intakeContext?.initialContext === 'string' ? parsed.intakeContext.initialContext : '',
          stageOfChange: ['precontemplation', 'contemplation', 'preparation', 'action', 'maintenance'].includes(parsed.intakeContext?.stageOfChange)
            ? parsed.intakeContext.stageOfChange
            : 'contemplation',
        },
      };

      // Count filled sections
      const filledElias = Object.values(result.sections).filter((v) => v.length > 0).length;
      const filledKim = Object.values(result.kimSections).filter((v) => v.length > 0).length;
      console.log(`[BackpackDocumentParse] Success: userType=${result.userType}, naam="${result.naam}", eliasSections=${filledElias}/5, kimSections=${filledKim}/5`);

      res.json({ success: true, backpackData: result });
    } catch (error) {
      console.error('[BackpackDocumentParse] Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}
