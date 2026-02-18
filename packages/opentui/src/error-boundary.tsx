/**
 * Error Boundary for Tabs UI (OpenTUI)
 *
 * Catches React errors and ensures terminal state is restored before displaying error.
 * This prevents the terminal from being left in a corrupted state (alternate screen,
 * hidden cursor, raw mode) when React rendering crashes.
 */

import * as React from 'react';

export type ErrorBoundaryProps = {
  children?: React.ReactNode;
  onFatalError?: (error: Error, errorInfo: React.ErrorInfo) => void;
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
 * Internal React Error Boundary class that ensures terminal cleanup on crashes.
 * For OpenTUI, we use a simple fallback since OpenTUI components may not
 * render correctly after an error.
 */
class ErrorBoundaryClass extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
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

  render(): React.ReactNode {
    if (this.state.hasError) {
      // For OpenTUI, render a simple box with the error message
      // The terminal should already be restored at this point
      return (
        <box flexDirection="column" padding={1}>
          <text fg="#FF0000">TabsUI encountered a fatal error</text>
          <text fg="#888888">{this.state.error?.message ?? 'Unknown error'}</text>
          <text fg="#666666">Press Ctrl+C to exit</text>
        </box>
      );
    }

    return this.props.children;
  }
}

/**
 * Export the error boundary class.
 * Note: When using in JSX with OpenTUI, you may need to use React.createElement directly
 * due to OpenTUI's JSX type constraints.
 */
export const TabsErrorBoundary = ErrorBoundaryClass;
