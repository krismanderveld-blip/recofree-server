/**
 * KERP01 — AI-Powered Eigen Regie Plan Generation
 *
 * Server-side endpoint that uses the built-in LLM to generate zone proposals
 * based on the user's life story (backpack sections) and known patterns.
 */
import { z } from 'zod';
import { invokeLLM } from './_core/llm';

export const kerp01GenerateInputSchema = z.object({
  /** User's life story sections from backpack */
  lifeStorySections: z.array(z.object({
    title: z.string(),
    content: z.string(),
  })),
  /** Known trigger patterns (if any) */
  knownTriggers: z.array(z.string()).optional(),
  /** Known schema/mode tendencies (if any) */
  knownPatterns: z.array(z.string()).optional(),
  /** User's intake context (type of addiction, etc.) */
  intakeContext: z.string().optional(),
  /** User's name for personalization */
  userName: z.string().optional(),
  /** Language for output */
  language: z.enum(['nl', 'en', 'fr']).default('nl'),
}).passthrough();

export interface Kerp01GenerateResult {
  success: boolean;
  zones?: {
    donkergroen: ZoneProposal;
    lichtgroen: ZoneProposal;
    geel: ZoneProposal;
    oranje: ZoneProposal;
    rood: ZoneProposal;
  };
  triggers?: TriggerProposal[];
  mainAnchorSentence?: string;
  error?: string;
}

interface ZoneProposal {
  signals: string[];
  bodySignals: string[];
  thoughts: string[];
  behaviour: string[];
  whatHelps: string[];
  boundaryActions: string[];
  anchorSentence: string;
}

interface TriggerProposal {
  lossOfRegiePattern: string;
  healthyResponse: string;
  boundaryRule: string;
}

const SYSTEM_PROMPT_NL = `Je bent een ervaren verslavingstherapeut die helpt bij het opstellen van een Eigen Regie Plan.

Op basis van het levensverhaal en bekende patronen van de gebruiker, genereer je een volledig Eigen Regie Plan met 5 zones:

ZONES:
- donkergroen (Vrij van verslaving): Stabiel, geen drang. Signalen van gezondheid en balans.
- lichtgroen (Terug naar verslaving): Eerste subtiele signalen dat het minder goed gaat.
- geel (Wisselzone): Spanning tussen oud en nieuw gedrag. Ambivalentie.
- oranje (Rond de ander): Relaties en sociale situaties die triggeren.
- rood (Verlies van regie): Hoog risico, nabij terugval.

Per zone geef je:
- signals: Herkenbare signalen (3-5 items)
- bodySignals: Lichaamssignalen (2-4 items)
- thoughts: Typische gedachten in deze zone (2-4 items)
- behaviour: Gedragspatronen (2-4 items)
- whatHelps: Wat helpt om regie te houden (3-5 items)
- boundaryActions: Concrete grensacties (2-3 items)
- anchorSentence: Eén krachtige ankerzin

Daarnaast genereer je:
- triggers: 3-5 terugvalpatronen met gezonde alternatieven
- mainAnchorSentence: Eén overkoepelende ankerzin

BELANGRIJK:
- Baseer je op het levensverhaal, NIET op generieke adviezen
- Gebruik de taal en woorden van de gebruiker waar mogelijk
- Wees concreet en persoonlijk, niet abstract
- Houd het veilig en empathisch

Antwoord ALLEEN in valid JSON format.`;

const SYSTEM_PROMPT_EN = `You are an experienced addiction therapist helping to create a Personal Autonomy Plan.

Based on the user's life story and known patterns, generate a complete Eigen Regie Plan with 5 zones:

ZONES:
- donkergroen (Free from addiction): Stable, no cravings. Signs of health and balance.
- lichtgroen (Returning to addiction): First subtle signals that things are getting worse.
- geel (Transition zone): Tension between old and new behavior. Ambivalence.
- oranje (Around others): Relationships and social situations that trigger.
- rood (Loss of control): High risk, near relapse.

Per zone provide:
- signals: Recognizable signals (3-5 items)
- bodySignals: Body signals (2-4 items)
- thoughts: Typical thoughts in this zone (2-4 items)
- behaviour: Behavioral patterns (2-4 items)
- whatHelps: What helps maintain control (3-5 items)
- boundaryActions: Concrete boundary actions (2-3 items)
- anchorSentence: One powerful anchor sentence

Additionally generate:
- triggers: 3-5 relapse patterns with healthy alternatives
- mainAnchorSentence: One overarching anchor sentence

IMPORTANT:
- Base on the life story, NOT generic advice
- Use the user's language and words where possible
- Be concrete and personal, not abstract
- Keep it safe and empathetic

Respond ONLY in valid JSON format.`;

export async function generateEigenRegiePlan(
  input: z.infer<typeof kerp01GenerateInputSchema>
): Promise<Kerp01GenerateResult> {
  const { lifeStorySections, knownTriggers, knownPatterns, intakeContext, userName, language } = input;

  // Build the user prompt from available data
  const sections = lifeStorySections
    .filter(s => s.content.trim().length > 0)
    .map(s => `### ${s.title}\n${s.content}`)
    .join('\n\n');

  if (!sections || sections.trim().length < 50) {
    return {
      success: false,
      error: 'Te weinig informatie in het levensverhaal om een plan te genereren. Vul eerst meer secties in.',
    };
  }

  let userPrompt = '';
  if (userName) {
    userPrompt += `Gebruiker: ${userName}\n\n`;
  }
  if (intakeContext) {
    userPrompt += `Context: ${intakeContext}\n\n`;
  }
  userPrompt += `## Levensverhaal\n\n${sections}\n\n`;

  if (knownTriggers && knownTriggers.length > 0) {
    userPrompt += `## Bekende triggers\n${knownTriggers.map(t => `- ${t}`).join('\n')}\n\n`;
  }
  if (knownPatterns && knownPatterns.length > 0) {
    userPrompt += `## Bekende patronen\n${knownPatterns.map(p => `- ${p}`).join('\n')}\n\n`;
  }

  userPrompt += `Genereer nu een volledig Eigen Regie Plan in JSON format met de structuur:
{
  "zones": {
    "donkergroen": { "signals": [...], "bodySignals": [...], "thoughts": [...], "behaviour": [...], "whatHelps": [...], "boundaryActions": [...], "anchorSentence": "..." },
    "lichtgroen": { ... },
    "geel": { ... },
    "oranje": { ... },
    "rood": { ... }
  },
  "triggers": [{ "lossOfRegiePattern": "...", "healthyResponse": "...", "boundaryRule": "..." }],
  "mainAnchorSentence": "..."
}`;

  const systemPrompt = language === 'en' ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_NL;

  try {
    console.log('[KERP01] Generating plan from', lifeStorySections.length, 'sections');

    const result = await invokeLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const responseText = typeof result.choices[0]?.message?.content === 'string'
      ? result.choices[0].message.content
      : '';

    // Parse JSON (strip potential markdown code blocks)
    const cleanJson = responseText
      .replace(/^```json?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const parsed = JSON.parse(cleanJson);

    // Validate the structure minimally
    if (!parsed.zones || !parsed.zones.donkergroen || !parsed.zones.rood) {
      return {
        success: false,
        error: 'AI genereerde een onvolledig plan. Probeer opnieuw.',
      };
    }

    console.log('[KERP01] Plan generated successfully');

    return {
      success: true,
      zones: parsed.zones,
      triggers: parsed.triggers || [],
      mainAnchorSentence: parsed.mainAnchorSentence || '',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[KERP01] Generation failed:', msg);
    return {
      success: false,
      error: `Plan generatie mislukt: ${msg}`,
    };
  }
}
