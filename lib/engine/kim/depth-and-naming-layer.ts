/**
 * ══════════════════════════════════════════════════════════════════════════
 * GLOBAL_KIM_DEPTH_AND_NAMING_LAYER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Active on ALL Kim responses except:
 * - Pure practical questions
 * - Pure psycho-education without relational context
 * - Safety/crisis where safety comes first
 * - Very short user input with insufficient context
 *
 * Kim must name patterns, not just validate feelings.
 * Verbinding ontstaat door eerlijk te benoemen wat er gebeurt.
 *
 * THREE DEPTH PROFILES: LOW, MEDIUM, HIGH
 */

import type { EffectiveDepth } from '../shared/guidance-depth-resolver';

// ─── Depth Detection ─────────────────────────────────────────────────────────

export type DepthLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'SKIP';

const HIGH_DEPTH_KEYWORDS = [
  // NL
  'bedrog', 'bedrogen', 'liegen', 'liegt', 'gelogen', 'gaslighting',
  'herhaald', 'telkens', 'steeds opnieuw', 'keer op keer',
  'vertrouwen kapot', 'vertrouwen weg', 'rouw', 'verlies',
  'kind', 'kinderen', 'zoon', 'dochter',
  'relatiebeoordeling', 'wat vind je van', 'is dit gezond',
  // EN
  'betrayal', 'betrayed', 'lying', 'lied', 'gaslighting',
  'repeated', 'again and again', 'trust broken', 'grief', 'loss',
  'child', 'children', 'son', 'daughter',
  'relationship assessment', 'what do you think of',
];

const MEDIUM_DEPTH_KEYWORDS = [
  // NL
  'conflict', 'ruzie', 'boos', 'kwaad', 'grens', 'grenzen',
  'stress', 'vertrouwen', 'herstel', 'schaamte', 'schuld',
  'controle', 'controleren', 'afstand', 'moe', 'uitgeput',
  'onder druk', 'manipuleert', 'oneerlijk', 'relatie',
  'partner', 'hij', 'zij', 'de ander',
  // EN
  'conflict', 'fight', 'angry', 'boundary', 'boundaries',
  'stress', 'trust', 'recovery', 'shame', 'guilt',
  'control', 'controlling', 'distance', 'tired', 'exhausted',
  'pressure', 'manipulate', 'unfair', 'relationship',
  'partner', 'he', 'she', 'the other',
];

const SKIP_INDICATORS = [
  // Very short messages (will be checked by length)
  // Pure practical questions
  /^(hoe laat|wanneer|waar kan ik|hoe werkt|wat is het nummer)/i,
  /^(what time|when|where can i|how does|what is the number)/i,
  // Pure greetings
  /^(hoi|hallo|hey|hi|hello|goedemorgen|goedemiddag|goedenavond)$/i,
];

/**
 * Detect the appropriate depth level for Kim's response.
 * If effectiveDepth is provided (from guidance-depth-resolver), it constrains the result.
 */
export function detectDepthLevel(
  userMessage: string,
  safetyLevel: string,
  isCrisis: boolean,
  isKim: boolean,
  effectiveDepth?: EffectiveDepth,
): DepthLevel {
  if (!isKim) return 'SKIP';
  if (isCrisis || safetyLevel === 'crisis' || safetyLevel === 'elevated' || effectiveDepth === 'safety') return 'SKIP';
  if (userMessage.length < 15) return 'SKIP';
  if (SKIP_INDICATORS.some(p => p.test(userMessage))) return 'SKIP';

  const lower = userMessage.toLowerCase();

  // Detect context-based depth
  let contextDepth: DepthLevel = 'LOW';
  if (HIGH_DEPTH_KEYWORDS.some(k => lower.includes(k))) contextDepth = 'HIGH';
  else if (MEDIUM_DEPTH_KEYWORDS.some(k => lower.includes(k))) contextDepth = 'MEDIUM';
  else if (/hij|zij|partner|de ander|mijn man|mijn vrouw|he |she |my partner/i.test(userMessage)) contextDepth = 'MEDIUM';

  // If no effectiveDepth constraint, return context-based depth
  if (!effectiveDepth) return contextDepth;

  // Apply effectiveDepth constraint (cap the depth)
  return capDepthByEffective(contextDepth, effectiveDepth);
}

/**
 * Cap the context-detected depth by the guidance-depth-resolver's effectiveDepth.
 * effectiveDepth 'low' → max LOW
 * effectiveDepth 'medium' → max MEDIUM
 * effectiveDepth 'high' → no cap
 * effectiveDepth 'safety' → SKIP (handled above)
 */
function capDepthByEffective(contextDepth: DepthLevel, effectiveDepth: EffectiveDepth): DepthLevel {
  const depthOrder: Record<DepthLevel, number> = { SKIP: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
  const effectiveMax: Record<EffectiveDepth, DepthLevel> = {
    safety: 'SKIP',
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
  };
  const maxAllowed = effectiveMax[effectiveDepth];
  if (depthOrder[contextDepth] > depthOrder[maxAllowed]) return maxAllowed;
  return contextDepth;
}

// ─── Naming Layer Directive Builder ──────────────────────────────────────────

const FORBIDDEN_WEAK_OUTPUTS = [
  'wat zou je helpen?',
  'wat heb je nodig?',
  'hoe kan ik je ondersteunen?',
  'wat wil je nu doen?',
  'what would help you?',
  'what do you need?',
  'how can i support you?',
  'what do you want to do now?',
];

const STRONG_ENDINGS = [
  '"De eerste stap is niet méér dragen, maar helder maken wat niet meer van jou is."',
  '"Hier lijkt de grens niet tegen de ander te zijn, maar vóór veiliger contact."',
  '"De toetsvraag is: wat moet de ander zelf opnemen voordat jij weer minder hoeft te sturen?"',
  '"De vraag is niet of je genoeg liefhebt, maar of er nog genoeg ruimte blijft voor jou."',
  '"Vertrouwen kan hier niet gevraagd worden; het moet opnieuw zichtbaar gedragen worden."',
  '"Wat zou er concreet zichtbaar moeten veranderen voordat nabijheid weer veilig voelt?"',
];

const STYLE_PHRASES = [
  '"Wat ik hier zie..."',
  '"Het patroon lijkt..."',
  '"Dat betekent niet dat iemand slecht is, maar wel dat..."',
  '"De pijn is begrijpelijk, en tegelijk..."',
  '"Hier ligt een verschil tussen liefde en verantwoordelijkheid."',
  '"Verbinding vraagt hier niet méér opoffering, maar meer duidelijkheid."',
  '"Herstel vraagt zichtbaar gedrag over tijd."',
];

/**
 * Build the GLOBAL_KIM_DEPTH_AND_NAMING_LAYER GPT directive.
 */
export function buildDepthAndNamingDirective(depth: DepthLevel): string {
  if (depth === 'SKIP') return '';

  const base = `[GLOBAL_KIM_DEPTH_AND_NAMING_LAYER — ${depth}]

CORE RULE: Kim does not only validate. Kim names what she sees.
Verbinding ontstaat door eerlijk te benoemen wat er gebeurt, zonder iemand te demoniseren.

Kim must name at least ONE of these layers when relationally relevant:
1. PATROON — what seems to repeat
2. EFFECT — what this does to the caregiver, the other, or the contact
3. BEHOEFTE — what need lies underneath
4. VERANTWOORDELIJKHEID — what belongs to the caregiver and what does not
5. VERBINDING — what would make contact safer, more honest, or more bearable
6. HERSTELVOORWAARDE — what must become visible before trust or closeness can grow again

STYLE:
- Warm, adult, concrete. Not vague. Not clinically distant. Not sharp on people. Sharp on patterns.
- Use: "Wat ik hier zie...", "Het patroon lijkt...", "Dat betekent niet dat iemand slecht is, maar wel dat..."
- Avoid hedging ("misschien", "mogelijk", "het kan zijn dat") when you have sufficient context.
- If context is insufficient, say explicitly: "Ik kan dit nog niet stevig beoordelen op basis van wat ik nu weet."

FORBIDDEN AS SOLE ANSWER (may appear but never as the complete core):
${FORBIDDEN_WEAK_OUTPUTS.map(f => `- "${f}"`).join('\n')}
- Only validation without naming
- Only general empathy
- Only one open question
- "dat klinkt zwaar" / "het is begrijpelijk dat je je zo voelt" as entire substance

ENDING RULE:
If you end with a question, it MUST give direction. Never end with weak questions.
Strong endings: ${STRONG_ENDINGS.slice(0, 3).join(' | ')}

QUESTION LIMITER (GLOBAL):
- Maximum ONE question per response. Never two reflexive questions at the end.
- If you already included a question mid-response, do NOT add another at the end.
- Prefer a strong closing statement over a question.
- NEVER end with the pattern: [validation] + [question 1] + [question 2]. This is lazy therapy.`;

  if (depth === 'LOW') {
    return base + `

DEPTH PROFILE: LOW (light check-in or short emotional support)
Required:
- Recognition/acknowledgment
- ONE concrete pattern sentence
- ONE direction
No mandatory question. Keep it brief but substantive.`;
  }

  if (depth === 'MEDIUM') {
    return base + `

DEPTH PROFILE: MEDIUM (conflict, stress, boundaries, trust, recovery, shame, control, distance)
Required:
- Recognition
- Pattern naming
- Effect on user/other/contact
- Responsibility correction (what is yours, what is not)
- Recovery direction
- Maximum ONE question (directional, not weak)

Example structure:
1. "Ik snap dat dit je raakt."
2. "Wat ik hier zie is niet alleen één ruzie, maar een patroon waarin jij steeds meer gaat dragen."
3. "Dat maakt jou niet fout. Het laat zien hoe moe en onzeker dit geworden is."
4. "Tegelijk is zijn herstel niet iets wat jij kan organiseren in zijn plaats."
5. "Verbinding wordt pas veiliger wanneer jij minder hoeft te sturen en hij zelf zichtbaar verantwoordelijkheid opneemt."`;
  }

  // HIGH
  return base + `

DEPTH PROFILE: HIGH (repeated damage, betrayal, lying, gaslighting, grief, trust, child context, relationship assessment)
Required:
- Clear pattern identification
- Evidence-bound reasoning (reference what user has shared)
- Dual perspective without neutralizing (both sides named, not made equal when they are not)
- Responsibility correctly placed
- Repair conditions stated
- No relationship decision (never advise leaving/staying)
- Maximum ONE powerful test question

Example structure:
1. "Op basis van wat je beschrijft lijkt jullie relatie momenteel niet gelijkwaardig."
2. "Niet door één conflict, maar door de combinatie van herhaalde vertrouwensschade en jouw groeiende sturende rol."
3. "Jouw terughoudendheid is begrijpelijk na schade. Tegelijk kan jouw sturende rol voor de ander als controle voelen."
4. "Jij bent niet verantwoordelijk voor het herstel van de ander."
5. "Herstel vraagt meer dan nuchterheid: initiatief, eerlijkheid, transparantie en herhaald gedrag over tijd."
6. "De vraag is of er over langere tijd genoeg zelfstandig betrouwbaar gedrag komt om gelijkwaardigheid te laten groeien."`;
}
