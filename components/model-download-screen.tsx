/**
 * ModelDownloadScreen — shown at first app start when model is not present.
 * Full-screen overlay with progress bar, download controls, and skip option.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Animated } from 'react-native';
import { useModelDownload } from '@/lib/engine/local-llm/model-download-context';
import { useColors } from '@/hooks/use-colors';

function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

export function ModelDownloadScreen() {
  const {
    status,
    progress,
    bytesDownloaded,
    totalBytes,
    error,
    startModelDownload,
    pauseModelDownload,
    resumeModelDownload,
    retryModelDownload,
    skipDownload,
  } = useModelDownload();
  const colors = useColors();

  const percentage = Math.round(progress * 100);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
          <Text style={styles.icon}>🧠</Text>
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.foreground }]}>
          Setting up AI
        </Text>

        {/* Description */}
        <Text style={[styles.description, { color: colors.muted }]}>
          {status === 'idle' && 'Download the AI model to enable on-device intelligence. This only happens once.'}
          {status === 'checking' && 'Checking model status...'}
          {status === 'downloading' && `Downloading AI model (${formatBytes(totalBytes)}). This only happens once.`}
          {status === 'paused' && 'Download paused. Resume when ready.'}
          {status === 'no-wifi' && 'WiFi connection required for download. Connect to WiFi and try again.'}
          {status === 'error' && `Download failed: ${error || 'Unknown error'}`}
          {status === 'completed' && 'AI model ready! Loading engine...'}
        </Text>

        {/* Progress bar (only during download) */}
        {(status === 'downloading' || status === 'paused') && (
          <View style={styles.progressSection}>
            <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressBarFill,
                  { backgroundColor: colors.primary, width: `${percentage}%` },
                ]}
              />
            </View>
            <View style={styles.progressInfo}>
              <Text style={[styles.progressText, { color: colors.muted }]}>
                {formatBytes(bytesDownloaded)} / {formatBytes(totalBytes)}
              </Text>
              <Text style={[styles.progressPercent, { color: colors.foreground }]}>
                {percentage}%
              </Text>
            </View>
          </View>
        )}

        {/* Loading spinner */}
        {status === 'checking' && (
          <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {status === 'idle' && (
            <Pressable
              onPress={startModelDownload}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.primaryButtonText}>Download Model (2.5 GB)</Text>
            </Pressable>
          )}

          {status === 'downloading' && (
            <Pressable
              onPress={pauseModelDownload}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Pause</Text>
            </Pressable>
          )}

          {status === 'paused' && (
            <Pressable
              onPress={resumeModelDownload}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.primaryButtonText}>Resume Download</Text>
            </Pressable>
          )}

          {(status === 'error' || status === 'no-wifi') && (
            <Pressable
              onPress={retryModelDownload}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.primaryButtonText}>Retry Download</Text>
            </Pressable>
          )}
        </View>

        {/* Skip button */}
        {status !== 'completed' && status !== 'checking' && (
          <Pressable
            onPress={skipDownload}
            style={({ pressed }) => [
              styles.skipButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={[styles.skipButtonText, { color: colors.muted }]}>
              Skip for now
            </Text>
          </Pressable>
        )}

        {/* Info text */}
        {(status === 'idle' || status === 'no-wifi' || status === 'error') && (
          <Text style={[styles.infoText, { color: colors.muted }]}>
            Without on-device AI, the app uses cloud AI instead.{'\n'}
            You can download later in Settings.
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * CloudAIBanner — shows a subtle banner when user skipped model download.
 * Auto-disappears after 5 seconds.
 */
export function CloudAIBanner() {
  const { dismissed, modelReady } = useModelDownload();
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const [opacity] = useState(new Animated.Value(0));

  useEffect(() => {
    if (dismissed && !modelReady) {
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [dismissed, modelReady]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.border, opacity }]}>
      <Text style={[styles.bannerText, { color: colors.muted }]}>
        On-device AI not active — using cloud AI
      </Text>
    </Animated.View>
  );
}

/**
 * Compact download indicator for the header/tab bar area.
 * Shows a small progress bar when downloading in background.
 */
export function ModelDownloadIndicator() {
  const { status, progress, modelReady } = useModelDownload();
  const colors = useColors();

  // Don't show if model is ready or idle
  if (modelReady || status === 'idle' || status === 'completed') return null;

  return (
    <View style={[styles.indicator, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.indicatorText, { color: colors.muted }]}>
        {status === 'downloading' && `AI: ${Math.round(progress * 100)}%`}
        {status === 'paused' && 'AI: Paused'}
        {status === 'error' && 'AI: Error'}
        {status === 'no-wifi' && 'AI: No WiFi'}
        {status === 'checking' && 'AI: Checking...'}
      </Text>
      {status === 'downloading' && (
        <View style={[styles.indicatorBar, { backgroundColor: colors.border }]}>
          <View style={[styles.indicatorFill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 32,
  },
  progressSection: {
    width: '100%',
    marginBottom: 24,
  },
  progressBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressText: {
    fontSize: 13,
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '600',
  },
  spinner: {
    marginBottom: 24,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  infoText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  // Banner styles
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    marginHorizontal: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Indicator styles
  indicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
    alignItems: 'center',
    minWidth: 80,
  },
  indicatorText: {
    fontSize: 11,
    fontWeight: '500',
  },
  indicatorBar: {
    width: '100%',
    height: 3,
    borderRadius: 1.5,
    marginTop: 3,
    overflow: 'hidden',
  },
  indicatorFill: {
    height: '100%',
    borderRadius: 1.5,
  },
});
