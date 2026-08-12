/**
 * Model Price Configuration
 * FASE 9G: Central pricing constants
 * 
 * Pricing verified against OpenAI API model pricing docs, 2026-08-11.
 * All listed models have requiresVerificationBeforeProduction=false.
 */

import type { ModelPricing } from './token-cost-types';

export const MODEL_PRICING_CONFIG: ModelPricing[] = [
  {
    model: 'gpt-4o-mini',
    tier: 'mini',
    inputCostPer1MTokensUsd: 0.15,
    outputCostPer1MTokensUsd: 0.60,
    currency: 'USD',
    sourceLabel: 'OpenAI API model pricing docs, verified 2026-08-11',
    requiresVerificationBeforeProduction: false,
  },
  {
    model: 'gpt-4o-2024-08-06',
    tier: 'full',
    inputCostPer1MTokensUsd: 2.50,
    outputCostPer1MTokensUsd: 10.00,
    currency: 'USD',
    sourceLabel: 'OpenAI API model pricing docs, verified 2026-08-11',
    requiresVerificationBeforeProduction: false,
  },
  {
    model: 'gpt-4o',
    tier: 'full',
    inputCostPer1MTokensUsd: 2.50,
    outputCostPer1MTokensUsd: 10.00,
    currency: 'USD',
    sourceLabel: 'OpenAI API model pricing docs, verified 2026-08-11',
    requiresVerificationBeforeProduction: false,
  },
];

export function getModelPricing(model: string): ModelPricing | null {
  return MODEL_PRICING_CONFIG.find(p => p.model === model) ?? null;
}
