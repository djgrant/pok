/**
 * Tabs Adapter Interface
 *
 * Defines the contract for tabbed terminal UI implementations.
 * Used by r.tabs() to run multiple commands in a tabbed interface.
 *
 * Implementations: @pokjs/core-reporter-ink (provides both reporter and tabs)
 *
 * ## Overview
 *
 * The TabsAdapter provides a tabbed terminal interface for running multiple
 * concurrent commands. Each command runs in its own pseudo-terminal, and the
 * user can switch between tabs to view output from different commands.
 *
 * ## Behavioral Contract
 *
 * ### Lifecycle
 *
 * 1. `run()` is called with a list of tab specifications
 * 2. The adapter spawns all commands concurrently
 * 3. The adapter displays a tabbed UI and captures keyboard input
 * 4. The promise resolves when ALL commands have completed
 * 5. Terminal state is restored after completion
 *
 * ### Command Execution
 *
 * - All commands MUST be spawned concurrently (not sequentially)
 * - Commands MUST run in pseudo-terminals (PTY) for proper output handling
 * - Commands inherit the provided `cwd` and `env` from options
 * - Command failures MUST NOT cause the adapter to throw
 *
 * ### Exit Behavior
 *
 * - The promise resolves when ALL commands have exited (success or failure)
 * - Individual command exit codes SHOULD be displayed in the UI
 * - The adapter itself MUST NOT exit the process
 *
 * ### Cancellation
 *
 * - On Ctrl+C, the adapter SHOULD send SIGTERM to all running processes
 * - After a grace period, SIGKILL MAY be sent to force termination
 * - The promise SHOULD still resolve after cancellation (not reject)
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Internal tab specification for the tabbed terminal UI.
 * This is the format used by adapters after the runner resolves envs.
 *
 * ## Contract
 * - `label` is displayed in the tab bar and MUST be non-empty
 * - `exec` is the shell command to execute
 */
export type TabSpec = {
  /**
   * The label displayed in the tab bar.
   * MUST be non-empty.
   * SHOULD be short (recommended: < 20 characters) for proper display.
   */
  label: string;
  /**
   * The shell command to execute.
   * Executed via the user's default shell (e.g., `/bin/sh -c "..."`).
   */
  exec: string;
};

/**
 * Options for the tabs adapter.
 *
 * These options apply to all tabs in the session.
 */
export type TabsOptions = {
  /**
   * Name shown in console messages.
   * Used for logging and identification purposes.
   */
  name: string;
  /**
   * Working directory for all commands.
   * MUST be an absolute path to an existing directory.
   * All tab commands will be executed with this as their cwd.
   */
  cwd: string;
  /**
   * Environment variables for all commands.
   * These are merged with the current process environment.
   * Values of `undefined` will unset the corresponding variable.
   */
  env: Record<string, string | undefined>;
};

// =============================================================================
// Interface
// =============================================================================

/**
 * Tabs Adapter for running multiple commands in a tabbed terminal UI.
 *
 * ## Lifecycle Contract
 *
 * The adapter takes full control of the terminal during `run()`:
 *
 * 1. **Initialization**
 *    - Enter alternate screen buffer (optional but recommended)
 *    - Set up raw mode for keyboard input
 *    - Spawn all commands in PTYs
 *
 * 2. **Active State**
 *    - Render tab bar and active tab content
 *    - Handle keyboard navigation (tab switching, scrolling)
 *    - Buffer output from all processes
 *
 * 3. **Cleanup**
 *    - Wait for all processes to exit
 *    - Restore terminal state (exit alternate screen, reset raw mode)
 *    - Return control to the caller
 *
 * ## UI Requirements
 *
 * Implementations MUST provide:
 * - Visual tab bar showing all tabs
 * - Clear indication of the active tab
 * - Scrollable output buffer for each tab
 * - Keyboard navigation (number keys or arrow keys for tab switching)
 *
 * Implementations SHOULD provide:
 * - Visual indication of tab state (running, exited, failed)
 * - Exit code display when command completes
 * - Scroll position indicator
 * - Help text for keyboard shortcuts
 *
 * ## Error Handling
 *
 * | Scenario | Handling |
 * |----------|----------|
 * | Command not found | Show error in tab, continue running |
 * | Command exits non-zero | Show exit code in tab, continue running |
 * | All commands fail | Still resolve promise (don't reject) |
 * | PTY allocation fails | MAY reject or fall back to non-PTY |
 * | Terminal too small | SHOULD show warning, MAY reject |
 *
 * ## Resource Management
 *
 * - All spawned processes MUST be tracked
 * - On unexpected exit, all processes SHOULD be terminated
 * - Process handles MUST be cleaned up to prevent resource leaks
 */
export interface TabsAdapter {
  /**
   * Run multiple commands in a tabbed terminal interface.
   *
   * Each tab shows the buffered output of its command.
   * User can switch tabs and scroll through output.
   *
   * ## Contract
   *
   * - MUST spawn all commands concurrently
   * - MUST display a tabbed interface with keyboard navigation
   * - MUST buffer output from all commands (not just active tab)
   * - MUST resolve when ALL commands have completed
   * - MUST restore terminal state after completion
   * - MUST NOT reject due to command failures (individual or all)
   *
   * ## Empty Items
   *
   * - If `items` is empty, SHOULD resolve immediately (no-op)
   *
   * ## Keyboard Handling
   *
   * Implementations SHOULD support:
   * - Number keys (1-9) for direct tab selection
   * - Arrow keys for tab navigation
   * - Page Up/Down for scrolling
   * - 'q' or Ctrl+C for exit (with process cleanup)
   *
   * ## Cancellation (Ctrl+C)
   *
   * When the user presses Ctrl+C:
   * 1. Send SIGTERM to all running processes
   * 2. Wait briefly for graceful shutdown
   * 3. Send SIGKILL if processes don't exit
   * 4. Resolve the promise (don't reject)
   *
   * @param items - Array of tab specifications to run
   * @param options - Common options for all tabs
   * @returns Promise that resolves when all commands complete
   *
   * @example
   * ```typescript
   * await tabsAdapter.run(
   *   [
   *     { label: 'Server', exec: 'npm run dev' },
   *     { label: 'Tests', exec: 'npm test --watch' },
   *     { label: 'Build', exec: 'npm run build --watch' },
   *   ],
   *   {
   *     name: 'Development',
   *     cwd: '/path/to/project',
   *     env: { NODE_ENV: 'development' },
   *   }
   * );
   * ```
   */
  run(items: TabSpec[], options: TabsOptions): Promise<void>;
}
