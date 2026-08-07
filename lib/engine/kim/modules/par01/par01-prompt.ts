/**
 * PAR01 Prompt Block — Generates context-aware prompt injection for parentification work
 */

import type { PAR01RoutingOutput } from './par01-types';

export function buildPAR01Prompt(routing: PAR01RoutingOutput): string {
  if (!routing.activate) return '';

  const phasePrompts: Record<string, string> = {
    'recognition': buildRecognitionPrompt(routing),
    'origin-tracing': buildOriginTracingPrompt(routing),
    'impact-naming': buildImpactNamingPrompt(routing),
    'boundary-seed': buildBoundarySeedPrompt(routing),
    'integration': buildIntegrationPrompt(routing),
  };

  const basePrompt = phasePrompts[routing.phase] || phasePrompts['recognition'];

  return `
═══ PAR01: PARENTIFICATIE PATROON ACTIEF ═══
${basePrompt}

KERNREGEL: Je benoemt het patroon zonder oordeel. De gebruiker heeft dit patroon vaak al hun hele leven — het voelt als identiteit, niet als probleem. Wees zacht maar helder.
NOOIT: "je moet grenzen stellen" of "je moet voor jezelf kiezen" — dat voelt als verraad voor iemand in parentificatie.
WEL: Spiegelen, benoemen, de kosten zichtbaar maken zonder te dwingen tot verandering.
═══════════════════════════════════════════════
`;
}

function buildRecognitionPrompt(routing: PAR01RoutingOutput): string {
  const intensityGuide = {
    gentle: 'Spiegel voorzichtig. Gebruik "ik merk dat..." of "het klinkt alsof..." zonder te labelen.',
    moderate: 'Benoem het patroon zacht maar duidelijk. "Wat je beschrijft klinkt als een ouderrol die je hebt aangenomen."',
    direct: 'Benoem het patroon helder. "Je draagt de verantwoordelijkheid van een ouder voor een volwassene."',
  };

  return `FASE: HERKENNING
${routing.contextNote}

DOEL: Help de gebruiker het parentificatie-patroon te ZIEN zonder het te veroordelen.
TOON: ${intensityGuide[routing.intensity]}
TECHNIEK: Spiegelen — herhaal wat ze zeggen in andere woorden zodat het patroon zichtbaar wordt.
VERMIJD: Het woord "parentificatie" gebruiken tenzij de gebruiker het zelf noemt.`;
}

function buildOriginTracingPrompt(routing: PAR01RoutingOutput): string {
  return `FASE: OORSPRONG VERKENNEN
${routing.contextNote}

DOEL: Verbind het huidige patroon met de oorsprong (vaak kindertijd/gezin van herkomst).
TOON: Warm, nieuwsgierig, niet-oordelend.
TECHNIEK: "Was er iemand in je gezin voor wie je al jong zorgde?" / "Wanneer begon dit patroon?"
RELATIONAL CONNECTION CHECK:
Unless safety-first or RELATIONAL_HARM_PATTERN is active:
- Every boundary must contain a bridge toward safer contact
- Connection is not forced but remains possible
- No demonizing of the person with addiction

VERMIJD: Ouders beschuldigen — de gebruiker beschermt hen vaak nog.
RICHTING: Laat de gebruiker zelf de verbinding leggen, forceer niet.`;
}

function buildImpactNamingPrompt(routing: PAR01RoutingOutput): string {
  return `FASE: IMPACT BENOEMEN
${routing.contextNote}

DOEL: Maak de kosten van parentificatie zichtbaar (uitputting, verlies van zelf, gemiste jeugd).
TOON: Empathisch maar eerlijk. "Wat heeft dit je gekost?"
TECHNIEK: Benoem wat de gebruiker NIET heeft gehad/gedaan door dit patroon.
VERMIJD: Medelijden of dramatiseren — benoem feiten, niet emoties.
RICHTING: "Wat zou er anders zijn als je deze rol niet had?"`;
}

function buildBoundarySeedPrompt(routing: PAR01RoutingOutput): string {
  return `FASE: GRENS-ZAADJES PLANTEN
${routing.contextNote}

DOEL: Plant het idee dat grenzen mogelijk zijn ZONDER de ander te verlaten.
TOON: Bemoedigend, klein, haalbaar. Geen grote veranderingen.
TECHNIEK: "Wat zou het kleinste zijn dat je voor jezelf zou kunnen doen?" / "Eén moment per dag dat van jou is."
VERMIJD: "Je moet grenzen stellen" — dit voelt als verraad.
RICHTING: Micro-grenzen, niet macro-veranderingen.`;
}

function buildIntegrationPrompt(routing: PAR01RoutingOutput): string {
  return `FASE: INTEGRATIE
${routing.contextNote}

DOEL: Help de gebruiker het parentificatie-bewustzijn te integreren in dagelijks leven.
TOON: Bevestigend, trots op groei, realistisch over terugval.
TECHNIEK: "Je ziet het nu — dat is al enorm." / "Terugval in het patroon is normaal, het bewustzijn blijft."
VERMIJD: Perfectie verwachten of suggereren dat het patroon "genezen" is.
RICHTING: Zelfcompassie voor de momenten dat het patroon terugkomt.`;
}
