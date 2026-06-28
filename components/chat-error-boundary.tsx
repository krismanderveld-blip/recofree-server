import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ScrollView } from 'react-native';
import { logDebugEvent } from '@/lib/debug/session-logger';
import { tStatic as t } from '@/lib/i18n';
import { LocalDeviceTimeService } from "@/lib/core/time";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary around the chat pipeline.
 * On crash: shows a minimal error message + "Restart session" button.
 * Logs the error to the debug system. Never crashes the whole app.
 */
export class ChatErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to debug system
    logDebugEvent('chat_crash', {
      message: error.message,
      stack: error.stack?.slice(0, 500) ?? '',
      componentStack: errorInfo.componentStack?.slice(0, 500) ?? '',
      timestamp: LocalDeviceTimeService.now().utcIso,
    });
    console.error('[ChatErrorBoundary]', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const stackLines = (err?.stack ?? t('chat_error_boundary.no_stack')).split('\n').slice(0, 10).join('\n');
      return (
        <View style={styles.container}>
          <Text style={styles.title}>{t('chat_error_boundary.title')}</Text>
          <Text style={styles.message}>
            {t('chat_error_boundary.message')}
          </Text>
          {err && (
            <ScrollView style={styles.crashBox} nestedScrollEnabled>
              <Text style={styles.crashTitle}>Error: {err.name}</Text>
              <Text style={styles.crashMessage}>{err.message}</Text>
              <Text style={styles.crashStack} selectable>{stackLines}</Text>
            </ScrollView>
          )}
          <Text style={styles.screenshotHint}>
            {t('chat_error_boundary.screenshot_hint')}
          </Text>
          <Pressable
            onPress={this.handleRestart}
            style={({ pressed }) => [
              styles.button,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.buttonText}>{t('chat_error_boundary.restart_button')}</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#11181C',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: '#687076',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  errorDetail: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  crashBox: {
    width: '100%',
    maxHeight: 280,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  crashTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 4,
  },
  crashMessage: {
    fontSize: 12,
    color: '#DC2626',
    marginBottom: 8,
  },
  crashStack: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#7F1D1D',
    lineHeight: 14,
  },
  screenshotHint: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0369A1',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#039BE5',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
