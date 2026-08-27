/**
 * Production architecture contract.
 *
 * RecoFree is client-first by design: deterministic decisions stay on-device
 * and GPT is reachable only through Railway's minimal, stateless proxy.
 * Production builds must not be able to disable these boundaries through a
 * missing or stale build environment variable.
 */
export const CLIENT_FIRST_ARCHITECTURE = Object.freeze({
  apiBaseUrl: 'https://railwayappdashboard-production.up.railway.app',
  minimalGptProxy: true,
  clinicalMemoryDistillation: true,
  coreEpistemicEngine: true,
  epistemicModelRouting: true,
  nanoInterpret: true,
  serverEngine: false,
} as const);

export type ClientFirstFeature =
  | 'clinicalMemoryDistillation'
  | 'coreEpistemicEngine'
  | 'epistemicModelRouting'
  | 'nanoInterpret';

const TEST_OVERRIDE_ENV: Readonly<Record<ClientFirstFeature, string>> = {
  clinicalMemoryDistillation: 'EXPO_PUBLIC_ENABLE_CLINICAL_MEMORY_DISTILLATION',
  coreEpistemicEngine: 'EXPO_PUBLIC_ENABLE_CORE_EPISTEMIC_ENGINE',
  epistemicModelRouting: 'EXPO_PUBLIC_ENABLE_EPISTEMIC_MODEL_ROUTING',
  nanoInterpret: 'EXPO_PUBLIC_ENABLE_NANO_INTERPRET',
};

/**
 * Production always returns the version-controlled value. Explicit overrides
 * are accepted only by the Vitest runtime so negative-path tests remain
 * possible without reopening a production feature switch.
 */
export function isClientFirstFeatureEnabled(feature: ClientFirstFeature): boolean {
  if (process.env.NODE_ENV === 'test') {
    const override = process.env[TEST_OVERRIDE_ENV[feature]];
    if (override === 'false') return false;
    if (override === 'true') return true;
  }
  return CLIENT_FIRST_ARCHITECTURE[feature];
}
