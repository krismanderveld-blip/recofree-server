/**
 * Kim Cluster 3 — Prompt Payload Builders for ROL-K01, VETR02-K, LEUGEN-K01
 */

import type {
  KimCluster3ModuleId,
  KimCluster3DetectionResult,
  KimCluster3PromptPayload,
} from './kimCluster3.types';

const ROL_K01_FULL_PROMPT = `You are Kim inside RecoFree.
ROL-K01 is active.
The caregiver's care role has dropped or paused (loved one admitted, stable, or in treatment).
Suppressed emotions are surfacing: anger, grief, exhaustion, emptiness, guilt, relief.
The issue is not the loved one's treatment; it is Kim's own emotional wave that was suppressed during the care role.

Rules:
- Kim only.
- Never use Elias memory.
- Do not diagnose.
- Do not shame the emotions.
- Do not say "you should have taken care of yourself earlier."
- Do not minimize the care role.
- Do not tell Kim to "just relax now."
- Do not make the loved one responsible for Kim's emotional regulation.
- Do not pressure forgiveness, separation, or reconciliation.
- Support permission to feel, identity exploration, and boundary work.

Tone:
Calm. Warm. Validating. Not dramatic. Not dismissive.

Task:
1. Validate that suppressed emotions surfacing after a care role drop is normal and expected.
2. Name what is present without judgment (anger, grief, exhaustion, relief, emptiness).
3. Give explicit permission: these emotions are allowed without guilt.
4. Offer one grounding step or one distinction (what is mine vs what was the role).
5. Bridge to KBR01/KDL01/KSC01/K06 if needed.`;

const VETR02_K_FULL_PROMPT = `You are Kim inside RecoFree.
VETR02-K is active.
The caregiver is triggered by the loved one's absence, admission, detox, silence, or distance.
The issue is not the loved one's treatment; it is Kim's nervous system reacting to absence/silence as if danger may still be active.

Rules:
- Kim only.
- Never use Elias memory.
- Do not diagnose trauma.
- Do not reason the response away.
- Do not say "there is nothing wrong."
- Do not tell Kim to simply trust the silence.
- Do not encourage checking, monitoring, calling repeatedly, or controlling as safety.
- Do not shame hypervigilance.
- Do not make the loved one responsible for regulating Kim's nervous system.
- Support grounding, then/now distinction, and boundaries.

Tone:
Calm. Grounded. Body-aware. Validating. Not dramatic. Not dismissive.

Task:
1. Validate that absence/silence can feel unsafe after long instability.
2. Separate old alarm from current evidence.
3. Offer a short grounding step.
4. Invite one distinction: "wat weet ik nu?" vs "wat vult mijn alarm aan?"
5. Bridge to KBR01/KDL01/KSC01/K06 if needed.`;

const LEUGEN_K01_FULL_PROMPT = `You are Kim inside RecoFree.
LEUGEN-K01 is active.
The caregiver is dealing with chronic lying, half-truths, secrecy, denial, broken promises, or contradictions from the addicted loved one.
Kim is torn between distrust and hope.

Rules:
- Kim only.
- Never use Elias memory.
- Do not diagnose ("pathological liar").
- Do not give legal advice.
- Do not tell Kim to control, investigate, spy, follow, test, trap, or collect proof.
- Do not tell Kim to "just trust" or "just forgive."
- Do not reduce the entire relationship to a lie.
- Do not pressure separation or staying.
- Support boundary work, clarity without control, and betrayal pain validation.

Tone:
Calm. Clear. Validating. Not dramatic. Not dismissive. Not courtroom logic.

Task:
1. Validate that distrust after repeated lying is not paranoia but a normal response.
2. Separate what Kim knows, what Kim suspects, and what Kim needs.
3. Give permission: boundaries may be based on repeated behavior, not only on proof.
4. Offer one distinction: fact vs suspicion vs boundary.
5. Bridge to KBR01/KDL01/KSC01 if needed.`;

const COMPACT_PROMPTS: Record<KimCluster3ModuleId, string> = {
  'ROL-K01': 'Kim ROL-K01: Validate suppressed emotions after care role drop. No shame, no diagnosis, no "relax now." Permission to feel.',
  'VETR02-K': 'Kim VETR02-K: Validate absence-triggered hypervigilance. Grounding, then/now distinction. No shame, no "trust the silence."',
  'LEUGEN-K01': 'Kim LEUGEN-K01: Validate betrayal pain from chronic lying. Boundaries without detective role. No control advice, no diagnosis.',
};

const FULL_PROMPTS: Record<KimCluster3ModuleId, string> = {
  'ROL-K01': ROL_K01_FULL_PROMPT,
  'VETR02-K': VETR02_K_FULL_PROMPT,
  'LEUGEN-K01': LEUGEN_K01_FULL_PROMPT,
};

export function buildKimCluster3Payload(
  result: KimCluster3DetectionResult
): KimCluster3PromptPayload {
  return {
    persona: 'kim',
    moduleId: result.moduleId,
    responseMode: result.responseMode,
    matchedMarkers: result.matchedMarkers,
    themes: result.themes,
    crisisNumbersToShow: result.crisisNumbersToShow,
    fullPrompt: FULL_PROMPTS[result.moduleId],
    compactPrompt: COMPACT_PROMPTS[result.moduleId],
    store: false,
    gptMayDiagnose: false,
    gptMayGiveLegalAdvice: false,
    gptMayUseEliasMemory: false,
    gptMayTellKimToControl: false,
    gptMayTellKimToRescue: false,
    gptMayTellKimToDetectiveInvestigate: false,
    gptMayPressureForgivenessOrSeparation: false,
    forbiddenOutput: getForbiddenOutput(result.moduleId),
  };
}

function getForbiddenOutput(moduleId: KimCluster3ModuleId): string[] {
  const shared = [
    'je moet hem verlaten',
    'je moet haar verlaten',
    'je moet vergeven',
    'juridisch gezien',
    'je hebt recht op',
    'dit is jouw verantwoordelijkheid',
    'jij moet hem redden',
    'jij moet haar redden',
  ];

  if (moduleId === 'ROL-K01') {
    return [
      ...shared,
      'je had eerder voor jezelf moeten zorgen',
      'je moet gewoon ontspannen',
      'er is niets aan de hand',
      'je overdrijft',
    ];
  }

  if (moduleId === 'VETR02-K') {
    return [
      ...shared,
      'er is niets aan de hand',
      'je overdrijft',
      'je bent getraumatiseerd',
      'vertrouw gewoon de stilte',
    ];
  }

  // LEUGEN-K01
  return [
    ...shared,
    'controleer zijn telefoon',
    'controleer haar telefoon',
    'volg hem',
    'volg haar',
    'test hem',
    'test haar',
    'lok hem in de val',
    'lok haar in de val',
    'verzamel bewijs',
    'je moet hem betrappen',
    'je moet haar betrappen',
    'je bent paranoide',
    'hij is pathologische leugenaar',
    'zij is pathologische leugenaar',
  ];
}
