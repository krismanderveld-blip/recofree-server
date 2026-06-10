/**
 * ISO01 Router — Response mode routing for Isolatie en Sociale Terugtrekking (Kim only)
 * Maps detection signals to appropriate response modes.
 */
import type { ISO01RuntimeInput, ISO01DetectionResult } from './types';
import { detectISO01 } from './detector';

/**
 * NL marker patterns for ISO01 signal detection.
 */
const NL_SOCIAL_WITHDRAWAL = [
  /ik zie niemand meer/i,
  /ik spreek niemand meer/i,
  /ik kom nergens meer/i,
  /ik ben.*(geïsoleerd|geisoleerd)/i,
  /ik trek me terug/i,
  /ik sluit me af/i,
  /ik vermijd iedereen/i,
  /ik wil niemand (zien|spreken)/i,
  /ik heb geen sociaal leven meer/i,
  /mijn wereld is klein geworden/i,
];

const NL_SHAME = [
  /ik schaam me.*(praten|vertellen|zeggen)/i,
  /ik schaam me voor wat er thuis gebeurt/i,
  /ik schaam me voor (zijn|haar) gebruik/i,
  /ze zouden mij.*(niet begrijpen|oordelen)/i,
  /ze gaan (oordelen|zeggen dat ik)/i,
  /ik wil niet dat mensen slecht over/i,
  /ik bescherm (hem|haar|ons gezin) door te zwijgen/i,
  /ik kan dit niet uitleggen/i,
  /ik ben het beu om.*(uitleggen|uit te leggen)/i,
];

const NL_BURDEN = [
  /ik wil niemand belasten/i,
  /ik wil.*(vrienden|familie).*(niet|hier niet).*(lastig|belasten)/i,
  /ik wil geen last zijn/i,
  /iedereen heeft al genoeg/i,
  /ik wil anderen niet meetrekken/i,
  /ik wil niet altijd negatief zijn/i,
  /ik ben bang dat.*(mensen|ze).*(beu|moe|te veel)/i,
  /ik voel me een last/i,
  /ik draag dit alleen/i,
  /niemand weet hoe erg het is/i,
];

const NL_EXHAUSTION = [
  /ik heb geen energie.*(voor mensen|voor contact|meer)/i,
  /contact kost te veel/i,
  /ik kan geen vragen meer aan/i,
  /ik kan geen sociaal.*(gedoe|dingen) meer/i,
  /ik wil gewoon alleen zijn/i,
  /alleen zijn voelt veiliger/i,
  /als ik met mensen praat.*(stort|breek)/i,
  /ik heb geen ruimte voor anderen/i,
  /ik wil rust/i,
  /ik trek me terug om mezelf te beschermen/i,
  /ik hou afstand omdat ik anders breek/i,
];

const NL_PROTECTIVE = [
  /ik hou alles verborgen/i,
  /ik doe alsof alles normaal is/i,
  /ik wil geen advies meer/i,
  /iedereen heeft een mening/i,
];

const NL_CONNECTION_SCARED = [
  /ik wil wel.*(iemand|contact|praten).*(maar|bang)/i,
];

/**
 * Analyze user message for ISO01 signals and produce runtime input signals.
 */
export function analyzeISO01Signals(
  message: string,
  recentMessages: string[],
  options: {
    intakeCompleted: boolean;
    crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
    K06StabilizationStatus: 'NOT_RUN' | 'STABILIZING' | 'STABILIZED';
    safetyRisk: number;
    acuteOverload: boolean;
  }
): ISO01RuntimeInput {
  const text = message.toLowerCase();
  const allText = [message, ...recentMessages].join(' ').toLowerCase();
  const detectedMarkers: string[] = [];

  // Detect signals
  let socialWithdrawal = false;
  let shameAboutTalking = false;
  let burdenFear = false;
  let protectiveIsolation = false;
  let exhaustionIsolation = false;
  let noSocialContact = false;
  let privacyNeed = false;
  let fearOfJudgment = false;
  let adviceFatigue = false;
  let painfulLoneliness = false;
  let wantsConnectionButScared = false;

  for (const pat of NL_SOCIAL_WITHDRAWAL) {
    if (pat.test(text) || pat.test(allText)) {
      socialWithdrawal = true;
      noSocialContact = true;
      detectedMarkers.push(pat.source);
      break;
    }
  }

  for (const pat of NL_SHAME) {
    if (pat.test(text) || pat.test(allText)) {
      shameAboutTalking = true;
      detectedMarkers.push(pat.source);
      break;
    }
  }

  for (const pat of NL_BURDEN) {
    if (pat.test(text) || pat.test(allText)) {
      burdenFear = true;
      detectedMarkers.push(pat.source);
      break;
    }
  }

  for (const pat of NL_EXHAUSTION) {
    if (pat.test(text) || pat.test(allText)) {
      exhaustionIsolation = true;
      detectedMarkers.push(pat.source);
      break;
    }
  }

  for (const pat of NL_PROTECTIVE) {
    if (pat.test(text) || pat.test(allText)) {
      protectiveIsolation = true;
      privacyNeed = true;
      detectedMarkers.push(pat.source);
      break;
    }
  }

  for (const pat of NL_CONNECTION_SCARED) {
    if (pat.test(text) || pat.test(allText)) {
      wantsConnectionButScared = true;
      detectedMarkers.push(pat.source);
      break;
    }
  }

  // Fear of judgment / advice fatigue
  if (/ze gaan (oordelen|zeggen)/i.test(text) || /angst voor oordeel/i.test(text)) {
    fearOfJudgment = true;
  }
  if (/ik wil geen advies meer/i.test(text) || /iedereen heeft een mening/i.test(text)) {
    adviceFatigue = true;
  }

  // Painful loneliness
  if (/eenzaam/i.test(text) || /alleen.*pijn/i.test(text) || /onzichtbaar/i.test(text)) {
    painfulLoneliness = true;
  }

  return {
    intakeCompleted: options.intakeCompleted,
    persona: 'kim',
    latestUserMessage: message,
    recentMessages,
    language: 'nl',
    detectedMarkers,
    crisisProtocolStatus: options.crisisProtocolStatus,
    K06StabilizationStatus: options.K06StabilizationStatus,
    socialWithdrawal,
    shameAboutTalking,
    burdenFear,
    protectiveIsolation,
    exhaustionIsolation,
    noSocialContact,
    privacyNeed,
    fearOfJudgment,
    adviceFatigue,
    painfulLoneliness,
    wantsConnectionButScared,
    acuteOverload: options.acuteOverload,
    safetyRisk: options.safetyRisk,
    timestampIso: new Date().toISOString(),
  };
}

/**
 * Full ISO01 routing: analyze signals → detect → return result.
 */
export function routeISO01(
  message: string,
  recentMessages: string[],
  options: {
    intakeCompleted: boolean;
    crisisProtocolStatus: 'CLEAR' | 'MONITOR' | 'ACTIVE';
    K06StabilizationStatus: 'NOT_RUN' | 'STABILIZING' | 'STABILIZED';
    safetyRisk: number;
    acuteOverload: boolean;
  }
): ISO01DetectionResult {
  const input = analyzeISO01Signals(message, recentMessages, options);
  return detectISO01(input);
}
