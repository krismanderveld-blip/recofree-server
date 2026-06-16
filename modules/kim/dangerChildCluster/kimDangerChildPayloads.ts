/**
 * Prompt payload builders for GEVAAR-K01 and KIND-K01
 * Kim persona only — store:false, no diagnosis, no legal advice, no rescue
 */

import type {
  KimCluster2DetectionResult,
  KimCluster2PromptPayload,
  KimCluster2ResponseMode,
  FixedBelgianCrisisNumber,
} from './kimDangerChildCluster.types';

// ============ GEVAAR-K01 PAYLOAD ============

export function buildGevaarK01Payload(detection: KimCluster2DetectionResult): KimCluster2PromptPayload {
  const crisisBlock = formatCrisisNumbers(detection.crisisNumbersToShow);
  const dangerBlock = detection.dangerCategories?.map(c => `- ${formatDangerLabel(c)}`).join('\n') || '';

  const fullPrompt = `[MODULE: GEVAAR-K01 — Danger Detection for Caregiver]
[PERSONA: Kim — supportive guide for loved ones of someone with addiction]
[STORE: false — this content is NOT stored]
[RESPONSE MODE: ${detection.responseMode}]

DETECTED DANGER SIGNALS:
${dangerBlock}

MATCHED MARKERS: ${detection.matchedMarkers.join(', ')}

${crisisBlock ? `CRISIS NUMBERS TO SHOW:\n${crisisBlock}\n` : ''}
MANDATORY RESPONSE RULES:
1. Acknowledge the user's fear and distress FIRST — validate before directing.
2. ${getResponseModeInstruction(detection.responseMode)}
3. NEVER tell the user to physically intervene, confront, or restrain their loved one.
4. NEVER tell the user to "rescue" their loved one — that is codependency reinforcement.
5. NEVER diagnose the loved one's condition or speculate about substances.
6. NEVER give legal advice — only point to crisis numbers.
7. If immediate danger: direct to call the appropriate number NOW, then ground the user.
8. If no immediate danger: help the user assess safety, plan next steps, set boundaries.
9. Use short, clear sentences. The user may be in panic.
10. Always end with a concrete next step the user can take RIGHT NOW.

FORBIDDEN OUTPUT:
- "Je moet hem/haar tegenhouden" (physically stopping)
- "Pak de sleutels af" (physical intervention)
- "Bel de politie op hem/haar" (punitive framing)
- Any diagnosis or medical speculation
- Any legal advice beyond "bel [nummer]"
- Any suggestion that implies the user is responsible for their loved one's choices`;

  const compactPrompt = `GEVAAR-K01 | Mode: ${detection.responseMode} | Danger: ${detection.dangerCategories?.join(',')} | Numbers: ${detection.crisisNumbersToShow.join(',')} | NO rescue/diagnosis/legal/physical intervention`;

  return {
    persona: 'kim',
    moduleId: 'GEVAAR-K01',
    responseMode: detection.responseMode,
    matchedMarkers: detection.matchedMarkers,
    crisisNumbersToShow: detection.crisisNumbersToShow,
    fullPrompt,
    compactPrompt,
    store: false,
    gptMayDiagnose: false,
    gptMayGiveLegalAdvice: false,
    gptMayUseEliasMemory: false,
    gptMayTellKimToRescue: false,
    gptMayTellKimToPhysicallyIntervene: false,
    gptMayParentifyChildren: false,
    forbiddenOutput: [
      'tegenhouden', 'pak de sleutels af', 'stop hem', 'stop haar',
      'hou hem tegen', 'hou haar tegen', 'grijp in', 'physically stop',
      'take the keys', 'restrain', 'confront him', 'confront her',
    ],
  };
}

// ============ KIND-K01 PAYLOAD ============

export function buildKindK01Payload(detection: KimCluster2DetectionResult): KimCluster2PromptPayload {
  const crisisBlock = formatCrisisNumbers(detection.crisisNumbersToShow);
  const childBlock = detection.childSafetyCategories?.map(c => `- ${formatChildLabel(c)}`).join('\n') || '';

  const fullPrompt = `[MODULE: KIND-K01 — Child Safety in Addiction Context]
[PERSONA: Kim — supportive guide for loved ones of someone with addiction]
[STORE: false — this content is NOT stored]
[RESPONSE MODE: ${detection.responseMode}]

DETECTED CHILD SAFETY CONCERNS:
${childBlock}

MATCHED MARKERS: ${detection.matchedMarkers.join(', ')}

${crisisBlock ? `CRISIS NUMBERS TO SHOW:\n${crisisBlock}\n` : ''}
MANDATORY RESPONSE RULES:
1. The CHILD'S safety and wellbeing is the absolute priority — above the loved one's feelings.
2. Acknowledge the user's concern for their children FIRST.
3. ${getChildResponseModeInstruction(detection.responseMode)}
4. NEVER suggest the child should "help" or "watch over" the addicted parent — that is parentification.
5. NEVER suggest the child should keep secrets about the addiction.
6. NEVER suggest the child should mediate between parents.
7. NEVER diagnose the child's emotional state — only validate what the user reports.
8. NEVER give legal advice about custody — only point to 1712 for professional guidance.
9. If child is in immediate danger: direct to call 112 or 101 NOW.
10. If child is exposed but not in immediate danger: help user plan protective steps.
11. Age-appropriate communication: help user find words for their child without lies or blame.
12. Always validate: "Het is goed dat je hierover nadenkt. Dat toont dat je een betrokken ouder bent."

FORBIDDEN OUTPUT:
- "Laat je kind op hem/haar letten" (parentification)
- "Je kind moet het geheim houden" (secrecy)
- "Je kind kan helpen door..." (child as caretaker)
- Any custody/legal advice beyond "bel 1712"
- Any diagnosis of the child
- Any suggestion that the child is responsible for the situation
- "Het kind moet kiezen" (loyalty conflict reinforcement)`;

  const compactPrompt = `KIND-K01 | Mode: ${detection.responseMode} | Child: ${detection.childSafetyCategories?.join(',')} | Numbers: ${detection.crisisNumbersToShow.join(',')} | NO parentification/diagnosis/legal/secrecy`;

  return {
    persona: 'kim',
    moduleId: 'KIND-K01',
    responseMode: detection.responseMode,
    matchedMarkers: detection.matchedMarkers,
    crisisNumbersToShow: detection.crisisNumbersToShow,
    fullPrompt,
    compactPrompt,
    store: false,
    gptMayDiagnose: false,
    gptMayGiveLegalAdvice: false,
    gptMayUseEliasMemory: false,
    gptMayTellKimToRescue: false,
    gptMayTellKimToPhysicallyIntervene: false,
    gptMayParentifyChildren: false,
    forbiddenOutput: [
      'laat je kind op hem letten', 'laat je kind op haar letten',
      'je kind moet het geheim houden', 'je kind kan helpen door',
      'het kind moet kiezen', 'let your child watch',
      'your child should help', 'the child must choose',
      'parentify', 'keep it secret from',
    ],
  };
}

// ============ HELPERS ============

function formatCrisisNumbers(numbers: FixedBelgianCrisisNumber[]): string {
  return numbers.map(n => {
    switch (n) {
      case '112': return '112 — Noodgevallen / levensbedreigend / ambulance';
      case '101': return '101 — Politie (niet-levensbedreigend)';
      case '1712': return '1712 — Huiselijk geweld, misbruik, kindermishandeling';
      case '1813': return '1813 — Zelfmoordlijn (24/7, gratis, anoniem)';
    }
  }).join('\n');
}

function formatDangerLabel(category: string): string {
  const labels: Record<string, string> = {
    DRUNK_DRIVING: 'Rijden onder invloed gedetecteerd',
    AGGRESSION: 'Agressie / geweld gedetecteerd',
    DISAPPEARANCE: 'Verdwijning gedetecteerd',
    OVERDOSE_OR_MEDICAL_DANGER: 'Overdosis / medisch gevaar gedetecteerd',
    SELF_HARM_THREAT_BY_LOVED_ONE: 'Suïcidedreiging door dierbare gedetecteerd',
    WEAPON_OR_SEVERE_THREAT: 'Wapen of ernstige dreiging gedetecteerd',
    UNSAFE_HOME: 'Onveilige thuissituatie gedetecteerd',
    UNKNOWN_DANGER: 'Onbekend gevaar gedetecteerd',
  };
  return labels[category] || category;
}

function formatChildLabel(category: string): string {
  const labels: Record<string, string> = {
    CHILD_WITNESSES_USE: 'Kind is getuige van gebruik',
    CHILD_IS_AFRAID: 'Kind is bang',
    CHILD_EXPOSED_TO_AGGRESSION: 'Kind blootgesteld aan agressie',
    CHILD_NEGLECT: 'Verwaarlozing gedetecteerd',
    CHILD_PARENTIFICATION: 'Parentificatie-risico gedetecteerd',
    CHILD_MALTREATMENT: 'Kindermishandeling gedetecteerd',
    CHILD_IN_CAR_WITH_INTOXICATED_ADULT: 'Kind in auto met beschonken volwassene',
    CHILD_MISSING_OR_UNSUPERVISED: 'Kind vermist of zonder toezicht',
    CHILD_LOYALTY_CONFLICT: 'Loyaliteitsconflict gedetecteerd',
    UNKNOWN_CHILD_SAFETY: 'Onbekend kindveiligheidsprobleem',
  };
  return labels[category] || category;
}

function getResponseModeInstruction(mode: KimCluster2ResponseMode): string {
  switch (mode) {
    case 'CALL_112_NOW':
      return 'DIRECT the user to call 112 IMMEDIATELY. Then ground them: "Adem. Je doet het juiste."';
    case 'CALL_101_POLICE':
      return 'Advise the user to call 101 (police). Frame as safety, not punishment.';
    case 'CONTACT_1712':
      return 'Point to 1712 for professional guidance on domestic violence/abuse.';
    case 'CONTACT_1813':
      return 'Point to 1813 for suicide prevention support.';
    case 'DO_NOT_INTERVENE_PHYSICALLY':
      return 'Explicitly state: do NOT try to physically stop them. Call 101 instead.';
    case 'SAFETY_FIRST':
      return 'Help the user assess their own safety first. Then plan next steps.';
    case 'GROUND_AND_PLAN':
      return 'Ground the user emotionally, then help them make a concrete safety plan.';
    default:
      return 'Validate, ground, and help the user identify one concrete next step.';
  }
}

function getChildResponseModeInstruction(mode: KimCluster2ResponseMode): string {
  switch (mode) {
    case 'PROTECT_CHILDREN_FIRST':
      return 'Child safety is immediate priority. Help user remove children from danger or call 112/101.';
    case 'CHILD_MALTREATMENT_ROUTE':
      return 'Point to 1712 for professional child protection guidance. Validate the user for speaking up.';
    case 'DO_NOT_PARENTIFY_CHILD':
      return 'Gently explain that children should not carry adult responsibilities. Help user find alternatives.';
    case 'AGE_APPROPRIATE_CHILD_SUPPORT':
      return 'Help user find age-appropriate words. No lies, no blame, no forced loyalty.';
    default:
      return 'Validate concern for children. Help user plan protective steps without parentification.';
  }
}
