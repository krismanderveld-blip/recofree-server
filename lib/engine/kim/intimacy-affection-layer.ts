/**
 * ══════════════════════════════════════════════════════════════════════════
 * INTIMACY_AFFECTION_EXPLANATION_LAYER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Activates when user asks about loss of affection, intimacy, or desire.
 * Kim explains WHY affection may be blocked without demonizing or pressuring.
 */

// ─── Detection ───────────────────────────────────────────────────────────────

const INTIMACY_PATTERNS_NL = [
  /ik voel geen affectie/i,
  /geen zin in seks/i,
  /wil niet knuffelen/i,
  /voel afstand/i,
  /kan (hem|haar|de ander) niet aanraken/i,
  /intimiteit voelt moeilijk/i,
  /samen in bad/i,
  /nabijheid voelt als druk/i,
  /mis verlangen/i,
  /geen aantrekkingskracht meer/i,
  /wil geen aanraking/i,
  /ik ben koud/i,
  /zegt dat ik koud ben/i,
  /meer mijn best doen/i,
  /waarom voel ik niets/i,
  /geen warmte meer/i,
  /affectie verdwenen/i,
];

const INTIMACY_PATTERNS_EN = [
  /i feel no affection/i,
  /don't want sex/i,
  /don't want to cuddle/i,
  /feel distant/i,
  /can't touch (him|her)/i,
  /intimacy feels difficult/i,
  /closeness feels like pressure/i,
  /miss desire/i,
  /no attraction anymore/i,
  /don't want to be touched/i,
  /says i'm cold/i,
  /should i try harder/i,
];

const INTIMACY_PATTERNS_FR = [
  /je ne ressens plus d'affection/i,
  /pas envie de sexe/i,
  /intimité.*difficile/i,
  /proximité.*pression/i,
  /plus d'attirance/i,
];

/**
 * Detect if user is asking about loss of affection/intimacy.
 */
export function detectIntimacyAffectionQuestion(userMessage: string): boolean {
  const allPatterns = [...INTIMACY_PATTERNS_NL, ...INTIMACY_PATTERNS_EN, ...INTIMACY_PATTERNS_FR];
  return allPatterns.some(p => p.test(userMessage));
}

// ─── Directive Builder ───────────────────────────────────────────────────────

export interface IntimacyLayerInput {
  safetyLevel: 'none' | 'elevated' | 'crisis';
  relationalHarmPatternActive: boolean;
}

/**
 * Build the INTIMACY_AFFECTION_EXPLANATION_LAYER GPT directive.
 */
export function buildIntimacyAffectionDirective(input: IntimacyLayerInput): string {
  if (input.safetyLevel === 'crisis') {
    return `[INTIMACY_AFFECTION_EXPLANATION_LAYER — SAFETY OVERRIDE]
Safety is active. Do NOT provide intimacy/affection analysis.
Stabilize first. Provide crisis numbers (1813, 1712, 112).`;
  }

  let directive = `[INTIMACY_AFFECTION_EXPLANATION_LAYER — ACTIVE]

The user is asking about loss of affection, intimacy, or desire.
You MUST respond with the following 6-step structure. Be CONCRETE, not vague.

STEP 1 — DO NOT REDUCE TO "NO LOVE":
State that loss of affection does not automatically mean loss of love.
Example: "Geen affectie voelen betekent niet automatisch dat er geen liefde meer is."

STEP 2 — NAME TRUST DAMAGE AS INHIBITOR:
Explain how repeated trust damage (lying, betrayal, secrecy, alcohol-related disruption) makes closeness feel unsafe.
Example: "Als vertrouwen herhaald beschadigd is door liegen, bedrog, geheimhouding of alcoholgerelateerde ontregeling, kan nabijheid minder veilig voelen."

STEP 3 — NAME PARTNER DYNAMIC SHIFT:
Explain how inequality (one pulling/steering, other being carried) kills desire.
Example: "Wanneer jij veel moet trekken, sturen of organiseren, kan de verhouding verschuiven van partner-partner naar drager-degene die gedragen wordt. Dat maakt verlangen vaak moeilijker."

STEP 4 — NAME PRESSURE AROUND INTIMACY:
Explain how expectation/pressure around touch or sex causes the body to withdraw.
Example: "Als aanraking of seks voelt alsof er verwachting achter zit, kan je lichaam juist afstand nemen."

STEP 5 — NAME DEEPER NEED:
Explain that it's not just about physical touch but about trust, admiration, equality, safety, emotional connection.
Example: "Het gaat dan vaak niet alleen over knuffelen of seks, maar over vertrouwen, bewondering, gelijkwaardigheid, veiligheid en emotionele verbinding."

STEP 6 — CONCRETE RECOVERY CONDITIONS:
Name what must become visible over time for affection to become possible again.
Example: "Affectie kan pas opnieuw ruimte krijgen wanneer er over tijd eerlijkheid, betrouwbaarheid, respect voor jouw nee, eigen initiatief, verantwoordelijkheid en rustiger contact zichtbaar worden."

CLOSING RULE:
End with a strong statement, NOT a weak question.
Strong closing: "De kern is niet dat jij jezelf moet forceren tot nabijheid. De kern is dat nabijheid opnieuw veilig, vrij en gelijkwaardig moet kunnen voelen."
Maximum ONE question if needed, and it must give direction.

REQUIRED:
- Name at least THREE concrete inhibitors of affection
- Link affection to safety and trust
- State that intimacy cannot be demanded
- State that recovery cannot come only from the caregiver
- Name concrete behavior needed to make affection possible again
- Maximum one question
- Do NOT end with "wat zou je helpen?" or "wat heb je nodig?"

FORBIDDEN:
- "je houdt niet meer van de ander"
- "je moet jezelf openstellen"
- "probeer toch wat warmer te zijn"
- "seks hoort bij een relatie"
- "als je liefhebt komt affectie vanzelf terug"
- "geef het gewoon tijd"
- "wat zou jou helpen?"
- "wat heb je nodig?"
- "de ander heeft dit kapotgemaakt"
- "de ander is het probleem"
- "je moet afstand nemen"
- Two or more questions
- Pressuring the caregiver to be warmer
- Demonizing the addicted person

ALLOWED PHRASES:
- "Affectie kan verdwijnen onder lagen van schade, druk en ongelijkheid."
- "Je lichaam kan nabijheid vermijden wanneer nabijheid niet meer veilig of vrijblijvend voelt."
- "Terughoudendheid is niet automatisch afwijzing; het kan ook bescherming zijn."
- "Herstel vraagt niet dat jij jezelf forceert om warmer te zijn."
- "Affectie groeit meestal niet uit druk, maar uit veiligheid, vertrouwen, respect en herhaald betrouwbaar gedrag."
- "Nuchterheid is belangrijk, maar vertrouwen en aantrekkingskracht vragen ook zichtbaar partnergedrag over tijd."`;

  if (input.relationalHarmPatternActive) {
    directive += `

RELATIONAL_HARM_PATTERN IS ACTIVE:
Damage comes FIRST. Do NOT open perspective early.
FIRST name the damage clearly. THEN state recovery conditions.
Do NOT minimize harm. Do NOT suggest the caregiver should try harder.`;
  }

  directive += `

K05 override remains active. Safety filters remain active. Runtime protection remains active.
Do NOT use fixed person names. Do NOT diagnose.`;

  return directive;
}
