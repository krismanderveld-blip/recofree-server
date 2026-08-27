import "@/global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Component, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform, Text, View, ScrollView, TouchableOpacity } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { UserProvider } from "@/lib/user-context";
import { I18nProvider, tStatic } from "@/lib/i18n";
import { migrateAllToEncrypted } from '@/lib/crypto/storage-encryption';
import { initNotificationHandler, useDayStructureObserver } from '@/lib/features/dayStructure';
import { TimeProvider } from '@/lib/core/time';

import type { ReactNode } from "react";

// Initialize notification handler at module level (before component renders)
initNotificationHandler();

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
  // Warmup ping to Railway — wake up the container so greeting/chat calls are fast
  useEffect(() => {
    if (Platform.OS === "web") return; // Only on native device
    const RAILWAY_URL = "https://railwayappdashboard-production.up.railway.app";
    fetch(`${RAILWAY_URL}/api/health`, { method: "GET" }).catch(() => {});
  }, []);

  // Day structure: timezone observer + notification rescheduling
  useDayStructureObserver();

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

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TimeProvider>
      <I18nProvider>
      <UserProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="intake" options={{ gestureEnabled: false }} />
              <Stack.Screen name="gdpr-consent" options={{ gestureEnabled: false }} />
              <Stack.Screen name="dev/debug-log" options={{ presentation: 'modal' }} />
              <Stack.Screen name="day-structure/wizard" options={{ presentation: 'modal', gestureEnabled: false }} />
              <Stack.Screen name="day-structure/editor" options={{ presentation: 'modal', headerShown: false }} />
              <Stack.Screen name="eigen-regie-plan/index" options={{ headerShown: false }} />
              <Stack.Screen name="eigen-regie-plan/zone" options={{ headerShown: false }} />
              <Stack.Screen name="eigen-regie-plan/triggers" options={{ headerShown: false }} />
              <Stack.Screen name="eigen-regie-plan/wizard" options={{ presentation: 'modal', gestureEnabled: false, headerShown: false }} />
              <Stack.Screen name="eigen-regie-plan/export" options={{ presentation: 'modal', headerShown: false }} />
            </Stack>
            <StatusBar style="auto" />
      </UserProvider>
      </I18nProvider>
      </TimeProvider>
    </GestureHandlerRootView>
  );

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>{content}</SafeAreaProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
