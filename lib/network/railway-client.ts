import { getApiBaseUrl } from '@/constants/oauth';

const SESSION_STORAGE_KEY = 'recofree_railway_client_session_v1';
let memoryToken: string | null = null;
let sessionPromise: Promise<string> | null = null;

function createRequestId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `rf-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function readStoredToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  try {
    const SecureStore = await import('expo-secure-store');
    memoryToken = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

async function writeStoredToken(token: string | null): Promise<void> {
  memoryToken = token;
  try {
    const SecureStore = await import('expo-secure-store');
    if (token) await SecureStore.setItemAsync(SESSION_STORAGE_KEY, token);
    else await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  } catch {
    // In-memory session remains available on platforms without SecureStore.
  }
}

async function bootstrapSession(): Promise<string> {
  const response = await fetch(`${getApiBaseUrl()}/api/client/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client: 'recofree-native', version: 1 }),
  });
  if (!response.ok) throw new Error(`railway_client_session_${response.status}`);
  const data = await response.json() as { ok?: boolean; token?: string };
  if (!data.ok || !data.token) throw new Error('railway_client_session_invalid');
  await writeStoredToken(data.token);
  return data.token;
}

async function getSessionToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const stored = await readStoredToken();
    if (stored) return stored;
  } else {
    await writeStoredToken(null);
  }
  if (!sessionPromise) sessionPromise = bootstrapSession().finally(() => { sessionPromise = null; });
  return sessionPromise;
}

async function authenticatedFetch(url: string, init: RequestInit, forceRefresh = false): Promise<Response> {
  const token = await getSessionToken(forceRefresh);
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-RecoFree-Request-Id', createRequestId());
  headers.set('X-RecoFree-Client-Time', String(Date.now()));
  return fetch(url, { ...init, headers });
}

export async function railwayFetch(pathOrUrl: string, init: RequestInit = {}): Promise<Response> {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : `${getApiBaseUrl()}${pathOrUrl}`;
  const response = await authenticatedFetch(url, init);
  if (response.status !== 401) return response;
  return authenticatedFetch(url, init, true);
}

export function resetRailwayClientSessionForTests(): void {
  memoryToken = null;
  sessionPromise = null;
}
