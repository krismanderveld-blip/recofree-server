/**
 * FIN01 Prompt Block — Generates context-aware prompt injection for financial control/dependency work
 */

import type { FIN01RoutingOutput } from './fin01-types';

export function buildFIN01Prompt(routing: FIN01RoutingOutput): string {
  if (!routing.activate) return '';

  const phasePrompts: Record<string, string> = {
    'awareness': buildAwarenessPrompt(routing),
    'impact-mapping': buildImpactMappingPrompt(routing),
    'agency-building': buildAgencyBuildingPrompt(routing),
    'protection': buildProtectionPrompt(routing),
    'autonomy': buildAutonomyPrompt(routing),
  };

  const basePrompt = phasePrompts[routing.phase] || phasePrompts['awareness'];

  return `
═══ FIN01: FINANCIËLE AFHANKELIJKHEID/CONTROLE ACTIEF ═══
${basePrompt}

KERNREGEL: Geld is een taboe-onderwerp. Schaamte is enorm. Benoem zonder oordeel.
NOOIT: "je moet een eigen rekening openen" of "je moet weggaan" — financiële realiteit is complex.
WEL: Valideer de schaamte, benoem het patroon, bouw agency stap voor stap.
BELANGRIJK: Financiële controle is een vorm van mishandeling. Benoem dit zacht maar eerlijk wanneer relevant.
═══════════════════════════════════════════════════════════
`;
}

function buildAwarenessPrompt(routing: FIN01RoutingOutput): string {
  const intensityGuide = {
    gentle: 'Spiegel voorzichtig. "Ik hoor dat geld een bron van spanning is..." zonder te labelen.',
    moderate: 'Benoem het patroon zacht. "Het klinkt alsof geld een machtsmiddel is geworden in jullie relatie."',
    direct: 'Benoem helder. "Wat je beschrijft is financiële controle — dat is een vorm van mishandeling."',
  };

  return `FASE: BEWUSTWORDING
${routing.contextNote}

DOEL: Help de gebruiker het financiële patroon te ZIEN zonder schaamte te versterken.
TOON: ${intensityGuide[routing.intensity]}
TECHNIEK: Normaliseer de schaamte eerst ("veel mensen in jouw situatie herkennen dit"), dan spiegel het patroon.
VERMIJD: Oordeel over financiële keuzes — de gebruiker overleeft, niet "kiest slecht".`;
}

function buildImpactMappingPrompt(routing: FIN01RoutingOutput): string {
  return `FASE: IMPACT IN KAART BRENGEN
${routing.contextNote}

DOEL: Help de gebruiker de volledige financiële impact te overzien (schulden, verloren spaargeld, extra werk).
TOON: Feitelijk, niet-oordelend, empathisch.
TECHNIEK: "Wat heeft dit je concreet gekost?" / "Hoeveel van je energie gaat naar financieel overleven?"
VERMIJD: Paniek zaaien over schulden — benoem feiten, bied perspectief.
RICHTING: Overzicht creëren is de eerste stap naar agency.`;
}

function buildAgencyBuildingPrompt(routing: FIN01RoutingOutput): string {
  return `FASE: AGENCY OPBOUWEN
${routing.contextNote}

DOEL: Bouw het gevoel dat de gebruiker financiële keuzes KAN maken (ook kleine).
TOON: Bemoedigend, klein, haalbaar.
TECHNIEK: "Wat is één financiële beslissing die alleen van jou is?" / "Heb je ergens een klein bedrag dat alleen jij kent?"
VERMIJD: Grote financiële plannen — begin micro.
RICHTING: Eén eigen keuze = begin van autonomie.`;
}

function buildProtectionPrompt(routing: FIN01RoutingOutput): string {
  return `FASE: BESCHERMING
${routing.contextNote}

DOEL: Verken concrete beschermingsstappen (eigen rekening, overzicht, hulplijn).
TOON: Praktisch, respectvol, niet-dwingend.
TECHNIEK: "Sommige mensen in jouw situatie openen een eigen rekening. Is dat iets dat je zou overwegen?"
VERMIJD: Dwingen tot actie — informeer, laat de gebruiker kiezen.
RICHTING: Informatie = macht. Kennis van opties is al bescherming.
HULPLIJNEN: Verwijs naar schuldhulpverlening/OCMW als relevant (maar alleen als gebruiker er klaar voor is).`;
}

function buildAutonomyPrompt(routing: FIN01RoutingOutput): string {
  return `FASE: FINANCIËLE AUTONOMIE
${routing.contextNote}

DOEL: Ondersteun financiële autonomie als vorm van zelfzorg.
TOON: Bevestigend, trots op stappen, realistisch over terugval.
TECHNIEK: "Elke stap die je zet richting financiële onafhankelijkheid is zelfzorg."
VERMIJD: Perfectie verwachten — financiële autonomie is een proces.
RICHTING: Autonomie ≠ alles alleen doen. Het betekent keuzes HEBBEN.`;
}
