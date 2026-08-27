import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { Express, NextFunction, Request, Response } from 'express';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const REQUEST_CLOCK_SKEW_MS = 2 * 60 * 1000;
const REPLAY_TTL_MS = 5 * 60 * 1000;

interface SessionPayload {
  v: 1;
  sid: string;
  exp: number;
}

interface WindowCounter {
  count: number;
  resetAt: number;
}

const rateWindows = new Map<string, WindowCounter>();
const seenRequests = new Map<string, number>();

function getSigningSecret(): string | null {
  const explicit = process.env.RAILWAY_CLIENT_SESSION_SECRET?.trim();
  if (explicit) return explicit;
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  return openAiKey ? `recofree-client-session-v1:${openAiKey}` : null;
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function issueRailwayClientSession(now = Date.now()): { token: string; expiresAt: number } | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const payload: SessionPayload = {
    v: 1,
    sid: randomBytes(18).toString('base64url'),
    exp: now + SESSION_TTL_MS,
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return { token: `${encodedPayload}.${sign(encodedPayload, secret)}`, expiresAt: payload.exp };
}

export function verifyRailwayClientSession(token: string, now = Date.now()): SessionPayload | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const [encodedPayload, signature, extra] = token.split('.');
  if (!encodedPayload || !signature || extra) return null;
  const expected = sign(encodedPayload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.v !== 1 || typeof payload.sid !== 'string' || !payload.sid || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

function consumeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const current = rateWindows.get(key);
  if (!current || current.resetAt <= now) {
    rateWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function isFreshUniqueRequest(sessionId: string, requestId: string, clientTime: string, now = Date.now()): boolean {
  const timestamp = Number(clientTime);
  if (!requestId || requestId.length > 120 || !Number.isFinite(timestamp)) return false;
  if (Math.abs(now - timestamp) > REQUEST_CLOCK_SKEW_MS) return false;
  for (const [key, expiresAt] of seenRequests) {
    if (expiresAt <= now) seenRequests.delete(key);
  }
  const replayKey = `${sessionId}:${requestId}`;
  if (seenRequests.has(replayKey)) return false;
  seenRequests.set(replayKey, now + REPLAY_TTL_MS);
  return true;
}

export function registerRailwayClientSessionRoute(app: Express): void {
  app.post('/api/client/session', (req: Request, res: Response) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!consumeRateLimit(`bootstrap:${ip}`, 12, 60_000)) {
      res.status(429).json({ ok: false, errorCode: 'RATE_LIMITED' });
      return;
    }
    const session = issueRailwayClientSession();
    if (!session) {
      res.status(503).json({ ok: false, errorCode: 'CLIENT_SESSION_UNAVAILABLE' });
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, ...session });
  });
}

export function requireRailwayClientSession(req: Request, res: Response, next: NextFunction): void {
  const authorization = req.header('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const session = verifyRailwayClientSession(token);
  if (!session) {
    res.status(401).json({ ok: false, errorCode: 'CLIENT_SESSION_REQUIRED' });
    return;
  }
  const requestId = req.header('x-recofree-request-id') || '';
  const clientTime = req.header('x-recofree-client-time') || '';
  if (!isFreshUniqueRequest(session.sid, requestId, clientTime)) {
    res.status(409).json({ ok: false, errorCode: 'STALE_OR_REPLAYED_REQUEST' });
    return;
  }
  if (!consumeRateLimit(`session:${session.sid}`, 90, 60_000)) {
    res.status(429).json({ ok: false, errorCode: 'RATE_LIMITED' });
    return;
  }
  next();
}

export function resetRailwayClientSecurityForTests(): void {
  rateWindows.clear();
  seenRequests.clear();
}
