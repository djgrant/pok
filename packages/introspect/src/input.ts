/**
 * Keyboard input handling for introspect TUI.
 */

export type InputHandlers = {
  onUp: () => void;
  onDown: () => void;
  onEnter: () => void;
  onPageUp: () => void;
  onPageDown: () => void;
  onQuit: () => void;
  onHelp: () => void;
};

/**
 * Sets up raw mode input handling.
 * Returns a cleanup function to restore terminal state.
 */
export function setupInput(stdin: NodeJS.ReadStream, handlers: InputHandlers): () => void {
  // Enable raw mode if available (TTY only)
  if (stdin.isTTY && stdin.setRawMode) {
    stdin.setRawMode(true);
  }

  stdin.resume();
  stdin.setEncoding('utf8');

  const onData = (key: string): void => {
    // Escape sequences for arrow keys
    switch (key) {
      // Arrow up
      case '\x1b[A':
      case 'k':
        handlers.onUp();
        break;

      // Arrow down
      case '\x1b[B':
      case 'j':
        handlers.onDown();
        break;

      // Enter
      case '\r':
      case '\n':
        handlers.onEnter();
        break;

      // Page Up
      case '\x1b[5~':
        handlers.onPageUp();
        break;

      // Page Down
      case '\x1b[6~':
        handlers.onPageDown();
        break;

      // Quit
      case 'q':
      case '\x03': // Ctrl+C
        handlers.onQuit();
        break;

      // Help
      case '?':
        handlers.onHelp();
        break;
    }
  };

  stdin.on('data', onData);

  // Return cleanup function
  return () => {
    stdin.removeListener('data', onData);
    if (stdin.isTTY && stdin.setRawMode) {
      stdin.setRawMode(false);
    }
    stdin.pause();
  };
}
