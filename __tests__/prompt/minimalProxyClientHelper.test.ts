import { beforeEach, describe, expect, it, vi } from 'vitest';

const railwayFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/network/railway-client', () => ({ railwayFetch: railwayFetchMock }));

import { callMinimalProxy, callMinimalProxyJson } from '@/lib/ai/minimal-proxy-client';

describe('minimal proxy client helper', () => {
  beforeEach(() => railwayFetchMock.mockReset());

  it('always sends the versioned minimal contract with store:false', async () => {
    railwayFetchMock.mockResolvedValue(new Response(JSON.stringify({
      contractVersion: 'minimal_gpt_proxy_v1', requestId: 'response-id', ok: true,
      text: 'antwoord', modelUsed: 'gpt-4o-mini',
    }), { status: 200 }));

    const result = await callMinimalProxy({
      persona: 'elias',
      systemPrompt: 'Formuleer kort.',
      messages: [{ role: 'user', content: 'test' }],
      promptBuildVersion: 'unit-test-v1',
    });

    expect(result.text).toBe('antwoord');
    expect(railwayFetchMock).toHaveBeenCalledWith('/api/minimal-gpt-proxy', expect.any(Object));
    const request = JSON.parse(railwayFetchMock.mock.calls[0][1].body);
    expect(request.contractVersion).toBe('minimal_gpt_proxy_v1');
    expect(request.store).toBe(false);
    expect(request.metadata.promptBuildVersion).toBe('unit-test-v1');
    expect(request).not.toHaveProperty('backpack');
    expect(request).not.toHaveProperty('userDat');
  });

  it('parses fenced JSON and rejects proxy errors', async () => {
    railwayFetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      contractVersion: 'minimal_gpt_proxy_v1', requestId: 'response-id', ok: true,
      text: '```json\n{"ok":true}\n```', modelUsed: 'gpt-4o-mini',
    }), { status: 200 }));
    await expect(callMinimalProxyJson<{ ok: boolean }>({
      persona: 'kim', systemPrompt: 'JSON.', messages: [{ role: 'user', content: 'test' }],
      promptBuildVersion: 'unit-test-json-v1',
    })).resolves.toEqual({ ok: true });

    railwayFetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      contractVersion: 'minimal_gpt_proxy_v1', requestId: 'response-id', ok: false,
      errorCode: 'RATE_LIMITED', errorMessage: 'limited',
    }), { status: 429 }));
    await expect(callMinimalProxy({
      persona: 'kim', systemPrompt: 'JSON.', messages: [{ role: 'user', content: 'test' }],
      promptBuildVersion: 'unit-test-error-v1',
    })).rejects.toThrow('minimal_proxy_RATE_LIMITED');
  });
});
