import type {
  MinimalGptMessage,
  MinimalGptPersona,
  MinimalGptProxyRequest,
  MinimalGptProxyResponse,
  MinimalGptProxyUsage,
} from '@/lib/ai/prompt/minimal-gpt-proxy-contract';
import { railwayFetch } from '@/lib/network/railway-client';

export interface MinimalProxyClientInput {
  persona: MinimalGptPersona;
  systemPrompt: string;
  messages: MinimalGptMessage[];
  model?: 'gpt-4o-mini' | 'gpt-4o-2024-08-06';
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  promptBuildVersion: string;
  signal?: AbortSignal;
}

export interface MinimalProxyClientResult {
  text: string;
  modelUsed: string;
  requestId: string;
  usage?: MinimalGptProxyUsage;
}

function requestId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return `mp-${cryptoApi.randomUUID()}`;
  return `mp-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function callMinimalProxy(input: MinimalProxyClientInput): Promise<MinimalProxyClientResult> {
  const id = requestId();
  const request: MinimalGptProxyRequest = {
    contractVersion: 'minimal_gpt_proxy_v1',
    requestId: id,
    persona: input.persona,
    model: input.model ?? 'gpt-4o-mini',
    systemPrompt: input.systemPrompt,
    messages: input.messages,
    maxTokens: input.maxTokens ?? 900,
    temperature: input.temperature ?? 0.2,
    topP: input.topP ?? 1,
    store: false,
    metadata: {
      clientBuildVersion: '1.2.89',
      promptBuildVersion: input.promptBuildVersion,
    },
  };

  const response = await railwayFetch('/api/minimal-gpt-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: input.signal,
  });
  const payload = await response.json().catch(() => null) as MinimalGptProxyResponse | null;
  if (!response.ok || !payload || payload.ok !== true) {
    const errorCode = payload && payload.ok === false ? payload.errorCode : `HTTP_${response.status}`;
    throw new Error(`minimal_proxy_${errorCode}`);
  }
  return {
    text: payload.text,
    modelUsed: payload.modelUsed,
    requestId: payload.requestId,
    usage: payload.usage,
  };
}

export async function callMinimalProxyJson<T>(input: MinimalProxyClientInput): Promise<T> {
  const result = await callMinimalProxy(input);
  const cleaned = result.text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  return JSON.parse(cleaned) as T;
}
