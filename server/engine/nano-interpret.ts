/**
 * nano-interpret.ts — Pre-call interpretation layer (gpt-4.1-nano)
 *
 * Runs AFTER crisis/safety check, BEFORE module selection.
 * Replaces keyword-matching (getTriggerModule, detectShortModuleKeyword)
 * with semantic understanding via a fast nano model.
 *
 * Persona-parametric: one implementation, persona determines module list.
 */

// ─── Types ────────────────────────────────────────────────────────

export interface NanoInterpretInput {
  userMessage: string;
  persona: 'elias' | 'kim';
}

export interface NanoInterpretResult {
  translatedNL: string;
  intent: 'seeking_action' | 'exploring' | 'venting' | 'crisis_signal' | 'informational' | 'greeting';
  themes: string[];
  suggestedModule: string;
}

// ─── Module Lists (static, for prompt caching) ────────────────────

const ELIAS_MODULES_FOR_PROMPT = `
- E01: Craving Management — Acute craving episodes, urges, substance desire
- E02: Emotional Regulation — Overwhelming emotions, can't handle feelings, falling apart
- E03: Relapse Prevention — Relapse triggers, used again, slipped, prevention strategies
- E04: Self-Compassion — Self-hatred, worthlessness, shame, guilt, self-criticism
- E05: Mindfulness & Grounding — Anxiety, panic, racing thoughts, grounding
- E06: Values & Meaning — Purpose, motivation, goals, hope, meaning in recovery
- E07: Focus & Clarity — Concentration problems, foggy mind, scattered thinking
- E08: ACT - Acceptance — Acceptance, struggle with control, resistance
- WILSKRACHT01: Wilskracht & Zelfverwijt — Willpower blame, feeling weak, discipline failure
- AUTOPILOT01: Automatische Piloot — Automatic triggers, conditioned responses, habit loops
- M05: Structurele eenzaamheid — Loneliness, isolation, feeling alone, no connections
- M06: Vertrouwensbreuk — Broken trust, betrayal, can't trust anyone
- M07: Paniek bij nabijheid — Fear of closeness, intimacy panic, pushing people away
- M08: Slaapstoornis — Sleep problems, insomnia, can't sleep, nightmares
- M09: Interne druk/perfectionisme — Perfectionism, internal pressure, fear of failure
- M13: Verlies van ouder — Loss, death, grief, mourning a parent
- M16: Overbelasting/ontploffing — Overwhelm, exhaustion, burnout, explosion
- M17: Traumatische kindervaring — Childhood trauma, abuse, traumatic memories
- M19: Schaamte door afwijzing — Shame from rejection, being rejected
- M20: Verinnerlijkte verwerping — Internalized rejection, feeling worthless, unlovable
`.trim();

const KIM_MODULES_FOR_PROMPT = `
- K01: Boundary Setting — Setting boundaries, saying no, protecting own space, limits
- K02: Enabling Awareness — Stress, burden, enabling behavior, taking too much responsibility
- K03: Self-Care — Own wellbeing, neglecting yourself, caregiver fatigue
- K04: Emotional Regulation — Emotional overload, betrayal feelings, trust issues, hope
- K05: Communication Skills — Talking to someone in addiction, difficult conversations
- K06: Self-Care & Sustainable Support — Sustainable caregiving, long-term self-preservation
- KST01: Stoicism for Caregivers — Stoic acceptance, control separation, steadiness
- KDL01: Detachment with Love — Loving detachment, letting go without abandoning
- KBR01: Boundary Restoration — Rebuilding broken boundaries, enforcement
- KSC01: Self-Compassion for Caregivers — Self-compassion, guilt about own needs
- CDP01: Codependency — Codependent patterns, enmeshment, losing self in other
- RNW01: Grief & Renewal — Grief, mourning the relationship/person, loss
- ISO01: Isolation — Isolation, withdrawal, cutting off from support
- HOOP-K01: Hope — Hope, hopelessness, situational despair, future orientation
- SCHAAM-K01: Shame — Shame about situation, stigma, hiding from others
`.trim();

// ─── System Prompt (static prefix for prompt caching) ─────────────

const SYSTEM_PROMPT_PREFIX = `You are a message interpreter for a therapeutic AI app. Your task is to analyze a user message and determine:
1. The Dutch translation (if not already Dutch)
2. The user's intent
3. Semantic themes present in the message
4. The most appropriate therapeutic module

Rules:
- Output ONLY valid JSON, no explanation
- translatedNL: if the message is already Dutch, return it unchanged. If another language, translate to Dutch.
- intent: one of "seeking_action", "exploring", "venting", "crisis_signal", "informational", "greeting"
- themes: 1-4 semantic themes (Dutch or English, short labels)
- suggestedModule: exactly one module ID from the provided list that best matches the message content

If the message is ambiguous or doesn't clearly match any module, choose the closest thematic match.
If the message is a simple greeting or small talk, use the default module.

Output format:
{"translatedNL":"...","intent":"...","themes":["..."],"suggestedModule":"..."}`;

// ─── Main Function ────────────────────────────────────────────────

export async function runNanoInterpret(
  input: NanoInterpretInput
): Promise<NanoInterpretResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[NanoInterpret] OPENAI_API_KEY is not configured');
  }

  const moduleList = input.persona === 'elias' ? ELIAS_MODULES_FOR_PROMPT : KIM_MODULES_FOR_PROMPT;
  const defaultModule = input.persona === 'elias' ? 'E02' : 'K01';

  const systemPrompt = `${SYSTEM_PROMPT_PREFIX}\n\nPersona: ${input.persona}\nDefault module (if no clear match): ${defaultModule}\n\nAvailable modules:\n${moduleList}`;

  const userPrompt = input.userMessage;

  // Attempt with 1 retry
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4.1-nano',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 300,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[NanoInterpret] API error (attempt ${attempt + 1}):`, response.status, errorText);
        if (attempt === 0) continue; // retry once
        throw new Error(`[NanoInterpret] API failed after retry: ${response.status}`);
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.error(`[NanoInterpret] Empty response (attempt ${attempt + 1})`);
        if (attempt === 0) continue;
        throw new Error('[NanoInterpret] Empty response after retry');
      }

      const parsed = JSON.parse(content) as NanoInterpretResult;

      // Validate required fields
      if (!parsed.translatedNL || !parsed.intent || !parsed.suggestedModule) {
        console.error(`[NanoInterpret] Invalid response structure (attempt ${attempt + 1}):`, content);
        if (attempt === 0) continue;
        throw new Error('[NanoInterpret] Invalid response structure after retry');
      }

      // Ensure themes is always an array
      if (!Array.isArray(parsed.themes)) {
        parsed.themes = [];
      }

      return parsed;
    } catch (error: any) {
      if (attempt === 0 && !error.message?.includes('after retry')) {
        console.error(`[NanoInterpret] Error (attempt ${attempt + 1}), retrying:`, error.message);
        continue;
      }
      throw error;
    }
  }

  // Should never reach here due to throw in loop, but TypeScript needs it
  throw new Error('[NanoInterpret] Unexpected: exhausted retries');
}
