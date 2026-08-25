export interface MedicalSafetyFallbackInput {
  message?: string | null;
  locale?: 'nl' | 'en' | 'fr';
  medicalUncertainty?: boolean;
  safetyRelevant?: boolean;
}

const COLD_TURKEY_EXPLICIT = /\b(cold[ -]?turkey|detox|ontwenning|withdrawal|sevrage)\b/i;
const ABRUPT_STOP = /(?:\b(plots(?:eling)?|meteen|ineens|abrupt(?:ly)?|suddenly|d['’]un coup|brutalement)\b.{0,30}\b(stop(?:pen)?|quit|arr[eê]ter)\b|\b(stop(?:pen)?|quit|arr[eê]ter)\b.{0,30}\b(plots(?:eling)?|meteen|ineens|abrupt(?:ly)?|suddenly|d['’]un coup|brutalement)\b)/i;
const HEAVY_SUBSTANCE_CONTEXT = /\b(zwaar|veel|dagelijks|heavy|heavily|daily|alcool|alcohol|drinken|drink|benzodiazepin(?:e|es)?|benzo(?:'s|s)?|middelen|substances?)\b/i;
const MEDICAL_SUPERVISION_CONTEXT = /\b(dokter|arts|huisarts|doctor|physician|m[eé]decin|medisch|medical|m[eé]dical)\b/i;

/**
 * Detects only an explicit abrupt-stopping safety question. It never infers a
 * diagnosis, dependence or withdrawal state from symptoms alone.
 */
export function isExplicitColdTurkeySafetyQuestion(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (COLD_TURKEY_EXPLICIT.test(text)) return true;
  return ABRUPT_STOP.test(text) && (HEAVY_SUBSTANCE_CONTEXT.test(text) || MEDICAL_SUPERVISION_CONTEXT.test(text));
}

export function buildMedicalSafetyFailureResponse(input: MedicalSafetyFallbackInput): string | null {
  const message = input.message ?? '';
  const isSafetyQuestion = isExplicitColdTurkeySafetyQuestion(message);
  if (!isSafetyQuestion || (!input.medicalUncertainty && !input.safetyRelevant)) return null;

  switch (input.locale ?? 'nl') {
    case 'en':
      return 'Suddenly stopping heavy alcohol or benzodiazepine use can be dangerous. Do not do this alone. Contact a doctor or urgent medical service today for a safe stopping or detox plan. If you are currently shaking severely, confused, hallucinating, having a seizure, or becoming acutely unwell, call emergency services now.';
    case 'fr':
      return 'Arrêter brutalement une consommation importante d’alcool ou de benzodiazépines peut être dangereux. Ne le faites pas seul. Contactez aujourd’hui un médecin ou un service médical urgent pour un plan d’arrêt ou de sevrage sûr. En cas de tremblements importants, confusion, hallucinations, convulsion ou malaise aigu, appelez immédiatement les services d’urgence.';
    default:
      return 'Plots stoppen met zwaar alcohol- of benzodiazepinegebruik kan gevaarlijk zijn. Doe dit niet alleen. Neem vandaag contact op met een arts of dringende medische hulp voor een veilig stop- of detoxplan. Als je nu ernstig trilt, verward raakt, hallucineert, een aanval krijgt of acuut ziek wordt, bel dan onmiddellijk de hulpdiensten.';
  }
}
