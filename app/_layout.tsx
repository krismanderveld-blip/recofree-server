import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Component, useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, Text, View, ScrollView, TouchableOpacity } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { UserProvider } from "@/lib/user-context";
import { I18nProvider, tStatic } from "@/lib/i18n";
import { migrateAllToEncrypted } from "@/lib/crypto/storage-encryption";

import type { ReactNode } from "react";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

// Error boundary to catch and display crashes instead of silently closing
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[AppErrorBoundary]", error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message ?? tStatic('_layout.error_boundary.unknown_error');
      const errorStack = this.state.error?.stack ?? "";
      return (
        <View style={{ flex: 1, backgroundColor: "#1a1a2e", justifyContent: "center", padding: 24 }}>
          <Text style={{ color: "#e94560", fontSize: 22, fontWeight: "bold", marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text style={{ color: "#ffffff", fontSize: 15, marginBottom: 16, lineHeight: 22 }}>
            {errorMessage}
          </Text>
          <ScrollView style={{ maxHeight: 200, backgroundColor: "#0f0f1a", borderRadius: 8, padding: 12, marginBottom: 20 }}>
            <Text style={{ color: "#9ba1a6", fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }}>
              {errorStack}
            </Text>
          </ScrollView>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{ backgroundColor: "#e94560", paddingVertical: 14, borderRadius: 10, alignItems: "center" }}
          >
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>{tStatic('_layout.error_boundary.try_again')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  // Migrate legacy plain-text sensitive data to AES-256-GCM encrypted storage
  useEffect(() => {
    migrateAllToEncrypted().then((res) => {
      if (res.migrated.length > 0) {
        console.log('[StorageEncryption] Migrated keys:', res.migrated);
      }
    }).catch((err) => {
      console.warn('[StorageEncryption] Migration error (non-blocking):', err);
    });
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
      <UserProvider>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="intake" options={{ gestureEnabled: false }} />
              <Stack.Screen name="gdpr-consent" options={{ gestureEnabled: false }} />
              <Stack.Screen name="oauth/callback" />
              <Stack.Screen name="dev/debug-log" options={{ presentation: 'modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </QueryClientProvider>
        </trpc.Provider>
      </UserProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <AppErrorBoundary>
        <ThemeProvider>
          <SafeAreaProvider initialMetrics={providerInitialMetrics}>
            <SafeAreaFrameContext.Provider value={frame}>
              <SafeAreaInsetsContext.Provider value={insets}>
                {content}
              </SafeAreaInsetsContext.Provider>
            </SafeAreaFrameContext.Provider>
          </SafeAreaProvider>
        </ThemeProvider>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
