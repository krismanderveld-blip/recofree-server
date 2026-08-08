/**
 * ══════════════════════════════════════════════════════════════════════════
 * DECISION_PRESSURE_RESPONSE_LAYER
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Activates when user asks Kim a stay/leave relationship decision question.
 * Kim NEVER takes the decision but provides structured 6-step response:
 * 1. No decision takeover
 * 2. Clear pattern identification
 * 3. Safety check
 * 4. Recoverability conditions
 * 5. Consequence without decision
 * 6. One test question or strong closing
 */

// ─── Detection ───────────────────────────────────────────────────────────────

const DECISION_PRESSURE_PATTERNS_NL = [
  /blijven of weggaan/i,
  /moet ik weg/i,
  /moet ik blijven/i,
  /relatie stoppen/i,
  /uit elkaar\s*(gaan)?/i,
  /afstand nemen/i,
  /nog zin/i,
  /nog herstelbaar/i,
  /wanneer is het genoeg/i,
  /wanneer moet ik kiezen/i,
  /wat moet ik doen met deze relatie/i,
  /moet ik doorgaan/i,
  /is het voorbij/i,
  /heeft dit nog toekomst/i,
  /is het beter om te gaan/i,
  /moet ik het opgeven/i,
  /kan ik dit nog redden/i,
];

const DECISION_PRESSURE_PATTERNS_EN = [
  /should i stay or leave/i,
  /should i leave/i,
  /should i stay/i,
  /end this relationship/i,
  /break up/i,
  /take distance/i,
  /is it still worth/i,
  /is this recoverable/i,
  /when is enough/i,
  /what should i do with this relationship/i,
  /should i give up/i,
  /is it over/i,
];

const DECISION_PRESSURE_PATTERNS_FR = [
  /rester ou partir/i,
  /dois-je partir/i,
  /dois-je rester/i,
  /arrêter cette relation/i,
  /prendre de la distance/i,
  /est-ce encore récupérable/i,
];

// Context sub-detectors
const CHILD_CONTEXT_PATTERNS = [
  /kind/i, /kinderen/i, /zoon/i, /dochter/i,
  /child/i, /children/i, /son/i, /daughter/i,
  /enfant/i, /fils/i, /fille/i,
  /vertrouwt.*niet meer/i, /bang.*kind/i,
];

const AFFECTION_CONTEXT_PATTERNS = [
  /affectie/i, /intimiteit/i, /seks/i, /aanraking/i,
  /geen zin meer/i, /voel niets meer/i, /mis de liefde/i,
  /affection/i, /intimacy/i, /sex/i, /touch/i,
  /don't feel anything/i, /miss the love/i,
];

const SHAME_CONTEXT_PATTERNS = [
  /schaam/i, /schuld/i, /lieg/i, /verberg/i,
  /niet eerlijk/i, /mijn fout/i,
  /shame/i, /guilt/i, /lying/i, /hiding/i,
  /my fault/i, /not honest/i,
];

export interface DecisionPressureDetection {
  isActive: boolean;
  hasChildContext: boolean;
  hasAffectionContext: boolean;
  hasShameContext: boolean;
}

/**
 * Detect if user is asking a stay/leave decision question.
 */
export function detectDecisionPressure(userMessage: string, recentHistory?: string[]): DecisionPressureDetection {
  const allPatterns = [...DECISION_PRESSURE_PATTERNS_NL, ...DECISION_PRESSURE_PATTERNS_EN, ...DECISION_PRESSURE_PATTERNS_FR];
  const isActive = allPatterns.some(p => p.test(userMessage));

  if (!isActive) {
    return { isActive: false, hasChildContext: false, hasAffectionContext: false, hasShameContext: false };
  }

  const fullContext = [userMessage, ...(recentHistory || [])].join(' ');

  return {
    isActive: true,
    hasChildContext: CHILD_CONTEXT_PATTERNS.some(p => p.test(fullContext)),
    hasAffectionContext: AFFECTION_CONTEXT_PATTERNS.some(p => p.test(fullContext)),
    hasShameContext: SHAME_CONTEXT_PATTERNS.some(p => p.test(fullContext)),
  };
}

// ─── Directive Builder ───────────────────────────────────────────────────────

export interface DecisionPressureInput {
  safetyLevel: 'none' | 'elevated' | 'crisis';
  relationalHarmPatternActive: boolean;
  hasChildContext: boolean;
  hasAffectionContext: boolean;
  hasShameContext: boolean;
}

/**
 * Build the DECISION_PRESSURE_RESPONSE_LAYER GPT directive.
 */
export function buildDecisionPressureDirective(input: DecisionPressureInput): string {
  // Safety override
  if (input.safetyLevel === 'crisis') {
    return `[DECISION_PRESSURE_RESPONSE_LAYER — SAFETY OVERRIDE]
Safety is active. Do NOT provide relationship assessment or decision structure.
Stabilize first. Ask: "Ben je nu veilig?" Provide crisis numbers (1813, 1712, 112).
No relationship decision, no pattern analysis during active crisis.`;
  }

  let directive = `[DECISION_PRESSURE_RESPONSE_LAYER — ACTIVE]

The user is asking a stay/leave relationship decision question.
You MUST respond with the following 6-step structure. Do NOT deviate.

STEP 1 — NO DECISION TAKEOVER:
State clearly that you cannot and will not decide for the user whether to stay or leave.
Example: "Ik kan niet voor jou beslissen of je moet blijven of weggaan."

STEP 2 — CLEAR PATTERN IDENTIFICATION:
Name the concrete relational pattern you observe based on what the user has shared.
Reference: repeated trust damage, inequality in responsibility, caregiver's steering/carrying role.
Example: "Maar ik kan wel zeggen dat deze keuze niet losstaat van het patroon: herhaalde vertrouwensschade, ongelijkheid in verantwoordelijkheid en jouw rol als sturende partner."

STEP 3 — SAFETY CHECK:
Always include: "Als er dreiging, dwang, geweld, kindonveiligheid of acute escalatie is, gaat veiligheid vóór relatieherstel."

STEP 4 — RECOVERABILITY CONDITIONS:
Name concrete conditions that must be visible BEFORE recovery is possible:
- Langdurige nuchterheid of stabiel herstelgedrag
- Eerlijkheid
- Transparantie
- Initiatief vanuit de afhankelijke zelf
- Respect voor grenzen
- Verantwoordelijkheid zonder dat de naaste moet sturen
- Voorspelbaar gedrag over tijd
- Herstel van vertrouwen door daden, niet woorden
${input.hasChildContext ? '- Aparte aandacht voor kinderen: rustig, betrouwbaar, niet-dwingend gedrag richting het kind' : ''}

STEP 5 — CONSEQUENCE WITHOUT DECISION:
State what happens if conditions are met vs. not met, without advising either way.
Example: "Als die voorwaarden zichtbaar worden, kan er ruimte ontstaan om opnieuw te kijken wat herstelbaar is. Als ze uitblijven, blijft de kans groot dat jij opnieuw partner, motivator, controleur en crisismanager tegelijk wordt."

STEP 6 — ONE TEST QUESTION OR STRONG CLOSING:
Maximum ONE question. It must give direction, not be weak.
Strong options:
- "Welke voorwaarden moeten eerst zichtbaar worden voordat jij veilig kunt blijven investeren?"
- "De eerste stap is dus niet kiezen vanuit paniek, maar helder maken welke voorwaarden nodig zijn om blijven niet opnieuw zelfverlies te maken."
- "Wat zou er concreet zichtbaar moeten veranderen voordat nabijheid weer veilig voelt?"

FORBIDDEN:
- "je moet weggaan"
- "je moet blijven"
- "luister naar je gevoel"
- "doe wat goed voelt"
- "wat zou je helpen?"
- "wat heb je nodig?"
- "maak een lijstje met voor- en nadelen"
- "alleen jij kunt dit weten"
- Three or more questions in a row
- Taking a relationship decision
- Demonizing the other person
- Absolutely acquitting the caregiver

REQUIRED:
- State that Kim does not take the decision
- Name concrete pattern
- Name recoverability conditions
- Name responsibility of the addicted person
- Name what the caregiver CANNOT fix on behalf of the other
- Maximum one question
- No weak standard ending`;

  // Child context addition
  if (input.hasChildContext) {
    directive += `

CHILD CONTEXT ACTIVE — ADDITIONAL REQUIREMENTS:
- Partnerherstel is niet automatisch kindherstel
- De naaste kan het vertrouwen tussen kind en afhankelijke niet herstellen namens de afhankelijke
- De afhankelijke moet door langdurig betrouwbaar, rustig en niet-dwingend gedrag zelf opnieuw veiligheid opbouwen
- Het kind mag tijd, afstand, voorspelbaarheid en eigen tempo nodig hebben
Example: "Jij kunt het vertrouwen tussen het kind en de ander niet herstellen namens de ander. Je kunt veiligheid bewaken en druk vermijden, maar het vertrouwen moet door de ander zelf opnieuw gedragen worden met rustig, betrouwbaar gedrag over tijd."`;
  }

  // Affection context addition
  if (input.hasAffectionContext) {
    directive += `

AFFECTION/INTIMACY CONTEXT ACTIVE — ADDITIONAL REQUIREMENTS:
- Affectie kan niet losgekoppeld worden van veiligheid
- Intimiteit kan niet opgeëist worden als bewijs van liefde
- Vertrouwen moet eerst opnieuw gedragen worden door gedrag
- Terughoudendheid is begrijpelijk na herhaalde schade
Do NOT frame lack of affection as the user's problem. Frame it as a natural consequence of unresolved trust damage.`;
  }

  // Shame context addition
  if (input.hasShameContext) {
    directive += `

SHAME CONTEXT ACTIVE — ADDITIONAL REQUIREMENTS:
- Verzacht de schaamte
- Benoem eigen aandeel zacht (niet beschuldigend)
- Maak herstelvoorwaarde concreet
- Geen absoluut vrijpleiten
Example: "Je bent niet verantwoordelijk voor het gedrag van de ander, maar als jij merkt dat je begint te liegen of verbergen, is dat wel een signaal dat deze situatie jou in gedrag duwt waar je zelf niet achter staat. Een herstelstap kan zijn: één veilige persoon kiezen bij wie je eerlijker mag zijn zonder alles te moeten uitleggen."`;
  }

  // RELATIONAL_HARM_PATTERN override
  if (input.relationalHarmPatternActive) {
    directive += `

RELATIONAL_HARM_PATTERN IS ACTIVE:
Damage and repair conditions come FIRST. Do NOT open perspective early.
FIRST name the damage clearly. THEN state repair conditions.
Do NOT minimize harm. Do NOT force connection before conditions are met.`;
  }

  directive += `

K05 override remains active. Safety filters remain active. Runtime protection remains active.
Do NOT use fixed person names. Do NOT diagnose.`;

  return directive;
}
