/**
 * MINIMAL GPT PROXY — POST /api/minimal-gpt-proxy
 *
 * Status: Active route, not yet used by client.
 * Contract: minimal_gpt_proxy_v1
 *
 * This route:
 * - Validates request against contract
 * - Enforces store:false
 * - Executes direct OpenAI chat completion call
 * - Returns contract-compliant response
 * - Logs only technical metadata (no content)
 *
 * This route does NOT:
 * - Use invokeLLM()
 * - Use forge.manus.im
 * - Use Gemini
 * - Use buildSystemPrompt()
 * - Use session cache
 * - Use model routing
 * - Use persona logic
 * - Use memory
 * - Log prompt/message content
 */

import type { Express, Request, Response } from "express";
import {
  MINIMAL_GPT_PROXY_ALLOWED_MODELS,
  validateMinimalGptProxyRequest,
  type MinimalGptProxyValidationOptions,
  type MinimalGptProxySuccessResponse,
  type MinimalGptProxyErrorResponse,
} from "../lib/ai/prompt/minimal-gpt-proxy-contract";

const CONTRACT_VERSION = "minimal_gpt_proxy_v1" as const;

const VALIDATION_OPTIONS: MinimalGptProxyValidationOptions = {
  allowedModels: [...MINIMAL_GPT_PROXY_ALLOWED_MODELS],
  maxAllowedTokens: 4000,
  minTemperature: 0,
  maxTemperature: 1,
  minTopP: 0,
  maxTopP: 1,
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export function registerMinimalGptProxyRoute(app: Express): void {
  app.post("/api/minimal-gpt-proxy", async (req: Request, res: Response) => {
    const requestId =
      (req.body && typeof req.body === "object" && typeof req.body.requestId === "string")
        ? req.body.requestId
        : "unknown";

    // ─── API Key Check ────────────────────────────────────────────────────────
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log(`[minimal-gpt-proxy] requestId=${requestId} status=500 error=OPENAI_API_KEY_MISSING`);
      const errorResponse: MinimalGptProxyErrorResponse = {
        contractVersion: CONTRACT_VERSION,
        requestId,
        ok: false,
        errorCode: "OPENAI_API_KEY_MISSING",
        errorMessage: "Technical error only",
      };
      res.status(500).json(errorResponse);
      return;
    }

    // ─── Request Validation ───────────────────────────────────────────────────
    const validation = validateMinimalGptProxyRequest(req.body, VALIDATION_OPTIONS);
    if (!validation.valid) {
      console.log(`[minimal-gpt-proxy] requestId=${requestId} status=400 error=VALIDATION_FAILED`);
      const errorResponse: MinimalGptProxyErrorResponse = {
        contractVersion: CONTRACT_VERSION,
        requestId,
        ok: false,
        errorCode: "VALIDATION_FAILED",
        errorMessage: "Invalid minimal GPT proxy request",
      };
      res.status(400).json(errorResponse);
      return;
    }

    // ─── Build OpenAI Payload ─────────────────────────────────────────────────
    const request = req.body as {
      requestId: string;
      model: string;
      systemPrompt: string;
      messages: Array<{ role: string; content: string }>;
      maxTokens: number;
      temperature: number;
      topP: number;
    };

    const openAiPayload = {
      model: request.model,
      messages: [
        { role: "system", content: request.systemPrompt },
        ...request.messages,
      ],
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      top_p: request.topP,
      store: false,
    };

    // ─── Execute OpenAI Call ──────────────────────────────────────────────────
    let openaiResponse: globalThis.Response;
    try {
      openaiResponse = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(openAiPayload),
      });
    } catch (error) {
      console.log(`[minimal-gpt-proxy] requestId=${requestId} status=500 error=OPENAI_REQUEST_FAILED`);
      const errorResponse: MinimalGptProxyErrorResponse = {
        contractVersion: CONTRACT_VERSION,
        requestId: request.requestId,
        ok: false,
        errorCode: "OPENAI_REQUEST_FAILED",
        errorMessage: "Technical error only",
      };
      res.status(500).json(errorResponse);
      return;
    }

    // ─── Handle OpenAI Error ─────────────────────────────────────────────────
    if (!openaiResponse.ok) {
      const statusCode = openaiResponse.status || 500;
      console.log(`[minimal-gpt-proxy] requestId=${requestId} status=${statusCode} error=OPENAI_REQUEST_FAILED`);
      const errorResponse: MinimalGptProxyErrorResponse = {
        contractVersion: CONTRACT_VERSION,
        requestId: request.requestId,
        ok: false,
        errorCode: "OPENAI_REQUEST_FAILED",
        errorMessage: "Technical error only",
      };
      res.status(statusCode).json(errorResponse);
      return;
    }

    // ─── Parse OpenAI Response ───────────────────────────────────────────────
    let openaiData: Record<string, unknown>;
    try {
      openaiData = (await openaiResponse.json()) as Record<string, unknown>;
    } catch {
      console.log(`[minimal-gpt-proxy] requestId=${requestId} status=502 error=OPENAI_RESPONSE_INVALID`);
      const errorResponse: MinimalGptProxyErrorResponse = {
        contractVersion: CONTRACT_VERSION,
        requestId: request.requestId,
        ok: false,
        errorCode: "OPENAI_RESPONSE_INVALID",
        errorMessage: "Technical error only",
      };
      res.status(502).json(errorResponse);
      return;
    }

    // ─── Extract Assistant Text ──────────────────────────────────────────────
    const choices = openaiData.choices as Array<{ message?: { content?: string } }> | undefined;
    const assistantText = choices?.[0]?.message?.content;

    if (!assistantText) {
      console.log(`[minimal-gpt-proxy] requestId=${requestId} status=502 error=OPENAI_RESPONSE_INVALID`);
      const errorResponse: MinimalGptProxyErrorResponse = {
        contractVersion: CONTRACT_VERSION,
        requestId: request.requestId,
        ok: false,
        errorCode: "OPENAI_RESPONSE_INVALID",
        errorMessage: "Technical error only",
      };
      res.status(502).json(errorResponse);
      return;
    }

    // ─── Build Success Response ──────────────────────────────────────────────
    const usage = openaiData.usage as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
    const modelUsed = (openaiData.model as string) || request.model;

    console.log(`[minimal-gpt-proxy] requestId=${requestId} status=200 model=${modelUsed} tokens=${usage?.total_tokens ?? "unknown"} responseLength=${assistantText.length}`);

    const successResponse: MinimalGptProxySuccessResponse = {
      contractVersion: CONTRACT_VERSION,
      requestId: request.requestId,
      ok: true,
      text: assistantText,
      modelUsed,
      usage: usage
        ? {
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
    };

    res.status(200).json(successResponse);
  });
}
