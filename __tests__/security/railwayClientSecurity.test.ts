import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureStoreMock = vi.hoisted(() => ({
  getItemAsync: vi.fn(async () => null as string | null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

vi.mock('expo-secure-store', () => secureStoreMock);

import {
  issueRailwayClientSession,
  requireRailwayClientSession,
  resetRailwayClientSecurityForTests,
  verifyRailwayClientSession,
} from '@/server/security/railway-client-security';
import { railwayFetch, resetRailwayClientSessionForTests } from '@/lib/network/railway-client';

function responseRecorder() {
  const state: { status: number; body: unknown } = { status: 200, body: null };
  const res: any = {
    status: vi.fn((status: number) => {
      state.status = status;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      state.body = body;
      return res;
    }),
  };
  return { state, res };
}

describe('Railway client session security', () => {
  beforeEach(() => {
    process.env.RAILWAY_CLIENT_SESSION_SECRET = 'test-only-secret-with-sufficient-entropy';
    resetRailwayClientSecurityForTests();
    resetRailwayClientSessionForTests();
    secureStoreMock.getItemAsync.mockResolvedValue(null);
    secureStoreMock.setItemAsync.mockClear();
    secureStoreMock.deleteItemAsync.mockClear();
    vi.restoreAllMocks();
  });

  it('issues a verifiable expiring token and rejects tampering/expiry', () => {
    const issued = issueRailwayClientSession(1_000);
    expect(issued).not.toBeNull();
    expect(verifyRailwayClientSession(issued!.token, 1_001)?.sid).toBeTruthy();
    expect(verifyRailwayClientSession(`${issued!.token}x`, 1_001)).toBeNull();
    expect(verifyRailwayClientSession(issued!.token, issued!.expiresAt + 1)).toBeNull();
  });

  it('rejects missing auth and blocks a replayed request id', () => {
    const now = Date.now();
    const issued = issueRailwayClientSession(now)!;
    const missing = responseRecorder();
    const missingNext = vi.fn();
    requireRailwayClientSession({ header: () => undefined } as any, missing.res, missingNext);
    expect(missing.state.status).toBe(401);
    expect(missingNext).not.toHaveBeenCalled();

    const headers: Record<string, string> = {
      authorization: `Bearer ${issued.token}`,
      'x-recofree-request-id': 'request-1',
      'x-recofree-client-time': String(now),
    };
    const req = { header: (name: string) => headers[name.toLowerCase()] } as any;
    const first = responseRecorder();
    const firstNext = vi.fn();
    requireRailwayClientSession(req, first.res, firstNext);
    expect(firstNext).toHaveBeenCalledTimes(1);

    const replay = responseRecorder();
    const replayNext = vi.fn();
    requireRailwayClientSession(req, replay.res, replayNext);
    expect(replay.state.status).toBe(409);
    expect(replayNext).not.toHaveBeenCalled();
  });

  it('bootstraps once and adds bearer, nonce and timestamp headers', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, token: 'session-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const response = await railwayFetch('/api/nano-interpret', {
      method: 'POST',
      body: '{}',
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const protectedInit = fetchMock.mock.calls[1][1]!;
    const headers = new Headers(protectedInit.headers);
    expect(headers.get('authorization')).toBe('Bearer session-1');
    expect(headers.get('x-recofree-request-id')).toBeTruthy();
    expect(Number(headers.get('x-recofree-client-time'))).toBeGreaterThan(0);
  });

  it('refreshes the session once after a 401 without reusing the request id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, token: 'session-old' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, token: 'session-new' }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));

    const response = await railwayFetch('/api/minimal-gpt-proxy', { method: 'POST', body: '{}' });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const firstHeaders = new Headers(fetchMock.mock.calls[1][1]!.headers);
    const retryHeaders = new Headers(fetchMock.mock.calls[3][1]!.headers);
    expect(firstHeaders.get('authorization')).toBe('Bearer session-old');
    expect(retryHeaders.get('authorization')).toBe('Bearer session-new');
    expect(retryHeaders.get('x-recofree-request-id')).not.toBe(firstHeaders.get('x-recofree-request-id'));
  });
});
