import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { logDebugEvent } from '@/lib/debug/session-logger';

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
      timestamp: new Date().toISOString(),
    });
    console.error('[ChatErrorBoundary]', error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            An unexpected error occurred in the chat. Your data is safe.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.errorDetail} numberOfLines={4}>
              {this.state.error.message}
            </Text>
          )}
          <Pressable
            onPress={this.handleRestart}
            style={({ pressed }) => [
              styles.button,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.buttonText}>Restart session</Text>
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
