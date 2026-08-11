/**
 * Model Price Configuration
 * FASE 9G: Central pricing constants
 * 
 * VERIFY_OPENAI_PRICING_BEFORE_PRODUCTION
 * These prices are estimates based on publicly available OpenAI pricing.
 * Verify before production deployment.
 */

import type { ModelPricing } from './token-cost-types';

export const MODEL_PRICING_CONFIG: ModelPricing[] = [
  {
    model: 'gpt-4o-mini',
    tier: 'mini',
    inputCostPer1MTokensUsd: 0.15,
    outputCostPer1MTokensUsd: 0.60,
    currency: 'USD',
    sourceLabel: 'VERIFY_OPENAI_PRICING_BEFORE_PRODUCTION',
    requiresVerificationBeforeProduction: true,
  },
  {
    model: 'gpt-4o-2024-08-06',
    tier: 'full',
    inputCostPer1MTokensUsd: 2.50,
    outputCostPer1MTokensUsd: 10.00,
    currency: 'USD',
    sourceLabel: 'VERIFY_OPENAI_PRICING_BEFORE_PRODUCTION',
    requiresVerificationBeforeProduction: true,
  },
  {
    model: 'gpt-4o',
    tier: 'full',
    inputCostPer1MTokensUsd: 2.50,
    outputCostPer1MTokensUsd: 10.00,
    currency: 'USD',
    sourceLabel: 'VERIFY_OPENAI_PRICING_BEFORE_PRODUCTION',
    requiresVerificationBeforeProduction: true,
  },
];

export function getModelPricing(model: string): ModelPricing | null {
  return MODEL_PRICING_CONFIG.find(p => p.model === model) ?? null;
}
