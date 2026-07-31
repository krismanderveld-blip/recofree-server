/**
 * CRISIS-K01 — Acute Caregiver Crisis Prompt Payload Builder
 * Kim-only. Immediate safety focus. Corrected Belgian crisis numbers.
 */
import type {
  KimRelapseClusterDetectionResult,
  KimRelapseClusterRuntimeInput,
  KimRelapseClusterPromptPayload,
  KimCrisisEscalationRoute,
} from '../kimRelapseCluster.types';
import { BELGIAN_CRISIS_NUMBERS as NUMBERS } from '../kimRelapseCluster.types';

export function buildCrisisK01Payload(
  detection: KimRelapseClusterDetectionResult,
  input: KimRelapseClusterRuntimeInput
): KimRelapseClusterPromptPayload {
  const route = detection.crisisEscalationRoute;
  const hasSuicideRisk = input.explicitSelfHarmRiskLovedOne || input.explicitSelfHarmRiskCaregiver ||
    detection.matchedMarkers.some(m => m.markerType === 'suicide_self_harm');
  const hasViolence = input.explicitViolenceRisk ||
    detection.matchedMarkers.some(m => m.markerType === 'violence');
  const hasMedical = input.explicitMedicalEmergency ||
    detection.matchedMarkers.some(m => m.markerType === 'medical_emergency');
  const hasDisappearance = input.explicitDisappearance ||
    detection.matchedMarkers.some(m => m.markerType === 'disappearance');

  let therapeuticTone: string;
  if (detection.safetyRiskLevel === 'IMMEDIATE') {
    therapeuticTone = 'Kort, directief, kalm. Geen uitleg, alleen actie. Maximaal 2 zinnen + nummer.';
  } else if (detection.safetyRiskLevel === 'HIGH') {
    therapeuticTone = 'Kalm, grondend, kort. Eerst veiligheid checken, dan één stap.';
  } else {
    therapeuticTone = 'Rustig, validerend, structurerend. Help de paniek te reguleren.';
  }

  const crisisNumberInstruction = buildCrisisNumberInstruction(route);

  const responseRules: string[] = [
    'EERSTE VRAAG ALTIJD: "Ben jij nu veilig?"',
    detection.safetyRiskLevel === 'IMMEDIATE'
      ? `ONMIDDELLIJK: Geef het nummer ${getNumberForRoute(route)} met korte instructie.`
      : '',
    'Als de Kim-gebruiker NIET veilig is: "Verlaat de situatie als dat kan. Bel 112."',
    'Als kinderen niet veilig zijn: "De veiligheid van de kinderen gaat voor. Bel 112."',
    hasSuicideRisk
      ? `Suïciderisico naaste: "Bel 1813 (Zelfmoordlijn, 24/7, gratis, anoniem). Zij kunnen jou helpen om te bepalen wat je nu kunt doen."`
      : '',
    hasViolence
      ? `Geweld: "Als je in gevaar bent, verlaat de situatie en bel 112. Voor steun bij huiselijk geweld: 1712."`
      : '',
    hasMedical
      ? `Medisch noodgeval: "Bel 112 NU. Beschrijf wat je ziet. Blijf aan de lijn."`
      : '',
    hasDisappearance
      ? `Verdwijning: "Als je je ernstig zorgen maakt over zijn/haar veiligheid, bel 101 (politie)."`
      : '',
    'Maximaal 3 zinnen per antwoord in crisis-modus.',
    'Na het geven van een nummer: "Ik ben hier als je terug wilt komen na het bellen."',
    'Geef NOOIT meer dan 1 nummer per antwoord (behalve bij directe levensbedreiging + geweld combo).',
  ].filter(Boolean);

  const forbiddenOutput: string[] = [
    'Geef NOOIT advies om zelf fysiek in te grijpen bij de naaste.',
    'Geef NOOIT advies om de naaste te confronteren tijdens actief gebruik/crisis.',
    'Geef NOOIT een diagnose of medisch advies (verwijs naar 112 voor medisch).',
    'Geef NOOIT juridisch advies.',
    'Minimaliseer NOOIT de ernst van de situatie.',
    'Zeg NOOIT "het komt wel goed" tijdens een acute crisis.',
    'Geef NOOIT advies om de naaste te "redden" of fysiek te stoppen.',
    'Geef NOOIT het nummer 1813 — dat nummer bestaat niet in deze app.',
  ];

  const gptInstruction = `[MODULE: CRISIS-K01 — Acute crisis naaste (caregiver)]
Je bent Kim. De gebruiker is een naaste van iemand met een verslaving.
Er is een ACUTE CRISIS. De Kim-gebruiker is in paniek, bang, of onveilig.

CONTEXT:
- Safety risk level: ${detection.safetyRiskLevel}
- Crisis escalation route: ${route}
- Caregiver state: ${input.caregiverState}
- Suïciderisico naaste: ${hasSuicideRisk ? 'JA' : 'NEE'}
- Geweld: ${hasViolence ? 'JA' : 'NEE'}
- Medisch noodgeval: ${hasMedical ? 'JA' : 'NEE'}
- Verdwijning: ${hasDisappearance ? 'JA' : 'NEE'}
- Taal: ${input.language}

THERAPEUTISCHE TOON: ${therapeuticTone}

${crisisNumberInstruction}

ETHISCHE REGELS (NIET-ONDERHANDELBAAR):
- Je mag NOOIT aanmoedigen om zelf fysiek in te grijpen.
- Je mag NOOIT een diagnose stellen.
- Je mag NOOIT juridisch advies geven.
- Bij ONMIDDELLIJK gevaar: geef het juiste nummer en STOP. Geen therapeutisch gesprek.
- Focus ALTIJD eerst op de veiligheid van de Kim-gebruiker zelf.

RESPONSE REGELS:
${responseRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}

VERBODEN OUTPUT:
${forbiddenOutput.map((f, i) => `- ${f}`).join('\n')}

BELGISCHE CRISISNUMMERS (CORRECT):
- 112: Noodgevallen / levensbedreigend / ambulance
- 101: Dringende politiehulp
- 1813: Zelfmoordlijn (24/7, gratis, anoniem)
- 1712: Huiselijk geweld, misbruik, kindermishandeling

store:false`;

  return {
    moduleId: 'CRISIS-K01',
    persona: 'kim',
    storePolicy: 'store:false',
    language: input.language,
    therapeuticTone,
    crisisEscalationRoute: route,
    responseRules,
    forbiddenOutput,
    belgianCrisisNumbers: NUMBERS,
    gptInstruction,
  };
}

function buildCrisisNumberInstruction(route: KimCrisisEscalationRoute): string {
  switch (route) {
    case 'CALL_112':
      return 'CRISISNUMMER: Verwijs naar 112 (noodgevallen). "Bel 112 nu."';
    case 'CALL_101':
      return 'CRISISNUMMER: Verwijs naar 101 (dringende politiehulp). "Bel 101."';
    case 'CALL_1813':
      return 'CRISISNUMMER: Verwijs naar 1813 (Zelfmoordlijn, 24/7, gratis, anoniem).';
    case 'CONTACT_1712':
      return 'CRISISNUMMER: Verwijs naar 1712 (huiselijk geweld, gratis, anoniem).';
    case 'CONTACT_LOCAL_DOCTOR_OR_ON_CALL_DOCTOR':
      return 'VERWIJZING: Adviseer contact met huisarts of wachtdienst.';
    case 'CONTACT_PROFESSIONAL_SUPPORT':
      return 'VERWIJZING: Adviseer contact met professionele hulpverlening.';
    case 'CRISIS_K01':
      return 'STABILISATIE: Focus op grounding en regulatie. Geen onmiddellijke nummerverwijzing nodig.';
    case 'K06_STABILISATION':
      return 'STABILISATIE: Route naar K06 voor zelfzorg en regulatie.';
    default:
      return '';
  }
}

function getNumberForRoute(route: KimCrisisEscalationRoute): string {
  switch (route) {
    case 'CALL_112': return '112';
    case 'CALL_101': return '101';
    case 'CALL_1813': return '1813';
    case 'CONTACT_1712': return '1712';
    default: return '';
  }
}
