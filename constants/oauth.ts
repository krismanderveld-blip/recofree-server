import * as Linking from "expo-linking";
import * as ReactNative from "react-native";

// Extract scheme from bundle ID (last segment timestamp, prefixed with "manus")
// e.g., "space.manus.my.app.t20240115103045" -> "manus20240115103045"
const bundleId = "space.manus.recofree.app.t20260405113127";
const timestamp = bundleId.split(".").pop()?.replace(/^t/, "") ?? "";
const schemeFromBundleId = `manus${timestamp}`;

// HARDCODED PRODUCTION URL — This is the deployed Railway server.
// This ensures the app ALWAYS reaches the correct server,
// even if EXPO_PUBLIC_API_BASE_URL is not properly baked into the APK.
export const PRODUCTION_API_URL = "https://railwayappdashboard-production.up.railway.app";

const env = {
  portal: process.env.EXPO_PUBLIC_OAUTH_PORTAL_URL ?? "",
  server: process.env.EXPO_PUBLIC_OAUTH_SERVER_URL ?? "",
  appId: process.env.EXPO_PUBLIC_APP_ID ?? "",
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
  deepLinkScheme: schemeFromBundleId,
};

export const OAUTH_PORTAL_URL = env.portal;
export const OAUTH_SERVER_URL = env.server;
export const APP_ID = env.appId;
export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;

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
  if (platform !== "web") {
    return PRODUCTION_API_URL;
  }

  if (webLocation) {
    const apiHostname = webLocation.hostname.replace(/^8081-/, "3000-");
    const isLocalWebHost =
      webLocation.hostname === "localhost" ||
      webLocation.hostname === "127.0.0.1";
    if (isLocalWebHost && apiHostname !== webLocation.hostname) {
      return `${webLocation.protocol}//${apiHostname}`;
    }
  }

  if (apiBaseUrl && apiBaseUrl.startsWith("http")) {
    try {
      const parsed = new URL(apiBaseUrl);
      const isWebDevelopmentHost =
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1";
      if (isWebDevelopmentHost) {
        return apiBaseUrl.replace(/\/$/, "");
      }
    } catch {
      // Invalid injected URL: fall through to Railway.
    }
  }

  return PRODUCTION_API_URL;
}

/**
 * Get the API base URL.
 *
 * Native production rule:
 * - Android/iOS ALWAYS use Railway. Build-time EXPO_PUBLIC_API_BASE_URL values
 *   are deliberately ignored because the WebDev build environment injects its
 *   own sandbox/deployment URL, which must never become the APK backend.
 *
 * Web development rule:
 * - Only localhost/127.0.0.1 may use a local development API.
 * - Every hosted web deployment also falls back to Railway.
 */
export function getApiBaseUrl(): string {
  const webLocation =
    ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location
      ? { protocol: window.location.protocol, hostname: window.location.hostname }
      : undefined;

  return resolveApiBaseUrl({
    platform: ReactNative.Platform.OS,
    apiBaseUrl: API_BASE_URL,
    webLocation,
  });
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "manus-runtime-user-info";

const encodeState = (value: string) => {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  const BufferImpl = (globalThis as Record<string, any>).Buffer;
  if (BufferImpl) {
    return BufferImpl.from(value, "utf-8").toString("base64");
  }
  return value;
};

/**
 * Get the redirect URI for OAuth callback.
 * - Web: uses API server callback endpoint
 * - Native: uses deep link scheme
 */
export const getRedirectUri = () => {
  if (ReactNative.Platform.OS === "web") {
    return `${getApiBaseUrl()}/api/oauth/callback`;
  } else {
    return Linking.createURL("/oauth/callback", {
      scheme: env.deepLinkScheme,
    });
  }
};

export const getLoginUrl = () => {
  const redirectUri = getRedirectUri();
  const state = encodeState(redirectUri);

  const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
  url.searchParams.set("appId", APP_ID);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};

/**
 * Start OAuth login flow.
 *
 * On native platforms (iOS/Android), open the system browser directly so
 * the OAuth callback returns via deep link to the app.
 *
 * On web, this simply redirects to the login URL.
 *
 * @returns Always null, the callback is handled via deep link.
 */
export async function startOAuthLogin(): Promise<string | null> {
  const loginUrl = getLoginUrl();

  if (ReactNative.Platform.OS === "web") {
    // On web, just redirect
    if (typeof window !== "undefined") {
      window.location.href = loginUrl;
    }
    return null;
  }

  const supported = await Linking.canOpenURL(loginUrl);
  if (!supported) {
    console.warn("[OAuth] Cannot open login URL: URL scheme not supported");
    return null;
  }

  try {
    await Linking.openURL(loginUrl);
  } catch (error) {
    console.error("[OAuth] Failed to open login URL:", error);
  }

  // The OAuth callback will reopen the app via deep link.
  return null;
}
