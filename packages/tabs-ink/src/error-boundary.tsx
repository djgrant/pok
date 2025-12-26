/**
 * Error Boundary for Tabs UI
 *
 * Catches React errors and ensures terminal state is restored before displaying error.
 * This prevents the terminal from being left in a corrupted state (alternate screen,
 * hidden cursor, raw mode) when React rendering crashes.
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Text, Box } from 'ink';

export type ErrorBoundaryProps = {
  children: ReactNode;
  onFatalError?: (error: Error, errorInfo: ErrorInfo) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Restore terminal to a clean state.
 * Called on errors and signal handlers to ensure terminal isn't left corrupted.
 */
export function restoreTerminal(): void {
  // Exit alternate screen buffer
  process.stdout.write('\x1b[?1049l');
  // Show cursor (in case it was hidden)
  process.stdout.write('\x1b[?25h');
  // Reset all attributes (colors, styles)
  process.stdout.write('\x1b[0m');

  // Try to restore raw mode if stdin is a TTY
  if (process.stdin.isTTY && process.stdin.isRaw) {
    try {
      process.stdin.setRawMode(false);
    } catch {
      // Ignore errors - stdin may already be closed
    }
  }
}

/**
 * React Error Boundary that ensures terminal cleanup on crashes.
 */
export class TabsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Restore terminal state immediately
    restoreTerminal();

    // Log error details for debugging
    console.error('\n[TabsUI] Fatal error caught by error boundary:');
    console.error(error);
    if (errorInfo.componentStack) {
      console.error('\nComponent stack:', errorInfo.componentStack);
    }

    // Notify parent if callback provided
    this.props.onFatalError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Show minimal error message - terminal should already be restored
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>
            TabsUI encountered a fatal error
          </Text>
          <Text color="gray">{this.state.error?.message ?? 'Unknown error'}</Text>
          <Text color="gray" dimColor>
            Press Ctrl+C to exit
          </Text>
        </Box>
      );
    }

    return this.props.children;
  }
}
