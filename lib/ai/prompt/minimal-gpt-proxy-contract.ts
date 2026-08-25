/**
 * MINIMAL GPT PROXY CONTRACT — Types and Validator
 *
 * Contract Version: minimal_gpt_proxy_v1
 * Status: Specification only — not yet implemented
 *
 * This file defines the future minimal GPT proxy request/response types
 * and a pure validation function. No side effects. No runtime changes.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type MinimalGptProxyContractVersion = 'minimal_gpt_proxy_v1';

export const MINIMAL_GPT_PROXY_ALLOWED_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4o-2024-08-06',
  'gpt-4.1',
  'gpt-4.1-mini',
] as const;

export type MinimalGptPersona = 'kim' | 'elias';

export type MinimalGptRole = 'user' | 'assistant';

export interface MinimalGptMessage {
  role: MinimalGptRole;
  content: string;
}

export interface MinimalGptProxyRequestMetadata {
  clientBuildVersion: string;
  promptBuildVersion: string;
  clinicalDebugId?: string;
}

export interface MinimalGptProxyRequest {
  contractVersion: MinimalGptProxyContractVersion;
  requestId: string;
  persona: MinimalGptPersona;
  model: string;
  systemPrompt: string;
  messages: MinimalGptMessage[];
  maxTokens: number;
  temperature: number;
  topP: number;
  store: false;
  metadata: MinimalGptProxyRequestMetadata;
}

export interface MinimalGptProxyUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface MinimalGptProxySuccessResponse {
  contractVersion: MinimalGptProxyContractVersion;
  requestId: string;
  ok: true;
  text: string;
  modelUsed: string;
  usage?: MinimalGptProxyUsage;
}

export interface MinimalGptProxyErrorResponse {
  contractVersion: MinimalGptProxyContractVersion;
  requestId: string;
  ok: false;
  errorCode: string;
  errorMessage: string;
}

export type MinimalGptProxyResponse =
  | MinimalGptProxySuccessResponse
  | MinimalGptProxyErrorResponse;

// ─── Validation ──────────────────────────────────────────────────────────────

export interface MinimalGptProxyValidationResult {
  valid: boolean;
  errors: string[];
}

export interface MinimalGptProxyValidationOptions {
  allowedModels: string[];
  maxAllowedTokens: number;
  minTemperature: number;
  maxTemperature: number;
  minTopP: number;
  maxTopP: number;
}

/**
 * Validates a minimal GPT proxy request.
 * Pure function — no side effects, no clinical interpretation, no mutation.
 */
export function validateMinimalGptProxyRequest(
  request: unknown,
  options: MinimalGptProxyValidationOptions
): MinimalGptProxyValidationResult {
  const errors: string[] = [];

  // Must be an object
  if (!request || typeof request !== 'object') {
    return { valid: false, errors: ['request must be a non-null object'] };
  }

  const req = request as Record<string, unknown>;

  // contractVersion
  if (req.contractVersion !== 'minimal_gpt_proxy_v1') {
    errors.push('contractVersion must be "minimal_gpt_proxy_v1"');
  }

  // requestId
  if (typeof req.requestId !== 'string' || req.requestId.length === 0) {
    errors.push('requestId must be a non-empty string');
  }

  // persona
  if (req.persona !== 'kim' && req.persona !== 'elias') {
    errors.push('persona must be "kim" or "elias"');
  }

  // model
  if (typeof req.model !== 'string' || req.model.length === 0) {
    errors.push('model must be a non-empty string');
  } else if (!options.allowedModels.includes(req.model as string)) {
    errors.push(`model "${req.model}" is not in the allowlist`);
  }

  // systemPrompt
  if (typeof req.systemPrompt !== 'string' || req.systemPrompt.length === 0) {
    errors.push('systemPrompt must be a non-empty string');
  }

  // messages
  if (!Array.isArray(req.messages) || req.messages.length === 0) {
    errors.push('messages must be a non-empty array');
  } else {
    for (let i = 0; i < (req.messages as unknown[]).length; i++) {
      const msg = (req.messages as unknown[])[i];
      if (!msg || typeof msg !== 'object') {
        errors.push(`messages[${i}] must be an object`);
        continue;
      }
      const m = msg as Record<string, unknown>;
      if (m.role !== 'user' && m.role !== 'assistant') {
        errors.push(`messages[${i}].role must be "user" or "assistant"`);
      }
      if (typeof m.content !== 'string' || m.content.length === 0) {
        errors.push(`messages[${i}].content must be a non-empty string`);
      }
    }
  }

  // maxTokens
  if (typeof req.maxTokens !== 'number' || req.maxTokens <= 0) {
    errors.push('maxTokens must be a positive number');
  } else if (req.maxTokens > options.maxAllowedTokens) {
    errors.push(`maxTokens (${req.maxTokens}) exceeds maximum allowed (${options.maxAllowedTokens})`);
  }

  // temperature
  if (typeof req.temperature !== 'number') {
    errors.push('temperature must be a number');
  } else if (req.temperature < options.minTemperature || req.temperature > options.maxTemperature) {
    errors.push(`temperature (${req.temperature}) outside allowed range [${options.minTemperature}, ${options.maxTemperature}]`);
  }

  // topP
  if (typeof req.topP !== 'number') {
    errors.push('topP must be a number');
  } else if (req.topP < options.minTopP || req.topP > options.maxTopP) {
    errors.push(`topP (${req.topP}) outside allowed range [${options.minTopP}, ${options.maxTopP}]`);
  }

  // store
  if (req.store !== false) {
    errors.push('store must be exactly false');
  }

  // metadata
  if (!req.metadata || typeof req.metadata !== 'object') {
    errors.push('metadata must be a non-null object');
  } else {
    const meta = req.metadata as Record<string, unknown>;
    if (typeof meta.clientBuildVersion !== 'string' || meta.clientBuildVersion.length === 0) {
      errors.push('metadata.clientBuildVersion must be a non-empty string');
    }
    if (typeof meta.promptBuildVersion !== 'string' || meta.promptBuildVersion.length === 0) {
      errors.push('metadata.promptBuildVersion must be a non-empty string');
    }
    if (meta.clinicalDebugId !== undefined && typeof meta.clinicalDebugId !== 'string') {
      errors.push('metadata.clinicalDebugId must be a string if provided');
    }
  }

  return { valid: errors.length === 0, errors };
}
