export interface SafetyPresentationInput {
  persona: 'elias' | 'kim';
  module: string;
  zone: string;
  medicalUncertainty: boolean;
  safetyRelevant: boolean;
}

export interface SafetyPresentationOutput {
  module: string;
  zone: string;
  responseDriver: string;
  medicalSafetyActive: boolean;
}

/**
 * Presentation-only dominance for explicit medical safety questions.
 * The long-term VSP zone remains unchanged; only the current turn's prompt and
 * debug presentation are prevented from claiming an ordinary GREEN/E02 route.
 */
export function resolveSafetyPresentation(input: SafetyPresentationInput): SafetyPresentationOutput {
  const medicalSafetyActive = input.persona === 'elias'
    && input.medicalUncertainty
    && input.safetyRelevant;

  if (!medicalSafetyActive) {
    return {
      module: input.module,
      zone: input.zone,
      responseDriver: `module:${input.module}`,
      medicalSafetyActive: false,
    };
  }

  return {
    module: 'E05',
    zone: 'YELLOW',
    responseDriver: 'medical_safety:E05',
    medicalSafetyActive: true,
  };
}
