import * as ReactNative from "react-native";

// Canonical production backend. Native builds never accept injected hosted URLs.
export const PRODUCTION_API_URL = "https://railwayappdashboard-production.up.railway.app";
export const API_BASE_URL = PRODUCTION_API_URL;

// Legacy auth modules remain source-compatible but are not mounted or imported by
// the standalone RecoFree root. The keys are product-owned, not platform-owned.
export const SESSION_TOKEN_KEY = "recofree_legacy_session_token";
export const USER_INFO_KEY = "recofree_legacy_user_info";

type ApiPlatform = "web" | "android" | "ios" | string;
type WebLocationLike = { protocol: string; hostname: string };

export function resolveApiBaseUrl({
  platform,
  apiBaseUrl,
  webLocation,
}: {
  platform: ApiPlatform;
  apiBaseUrl?: string;
  webLocation?: WebLocationLike;
}): string {
  if (platform !== "web") return PRODUCTION_API_URL;

  if (webLocation) {
    const isLocalWebHost = webLocation.hostname === "localhost" || webLocation.hostname === "127.0.0.1";
    if (isLocalWebHost) {
      const apiHostname = webLocation.hostname.replace(/^8081-/, "3000-");
      return `${webLocation.protocol}//${apiHostname}`;
    }
  }

  if (apiBaseUrl?.startsWith("http")) {
    try {
      const parsed = new URL(apiBaseUrl);
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
        return apiBaseUrl.replace(/\/$/, "");
      }
    } catch {
      // Invalid development URL: fail closed to Railway.
    }
  }
  return PRODUCTION_API_URL;
}

export function getApiBaseUrl(): string {
  const webLocation = ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location
    ? { protocol: window.location.protocol, hostname: window.location.hostname }
    : undefined;
  return resolveApiBaseUrl({
    platform: ReactNative.Platform.OS,
    apiBaseUrl: PRODUCTION_API_URL,
    webLocation,
  });
}

/** Frozen compatibility exports. Standalone RecoFree has no account login. */
export const getRedirectUri = () => "recofree:/oauth/callback";
export const getLoginUrl = () => "";
export async function startOAuthLogin(): Promise<string | null> {
  console.warn("[Auth] External OAuth is disabled in standalone RecoFree builds.");
  return null;
}
