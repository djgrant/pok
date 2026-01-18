/**
 * Tabs Adapter Interface
 *
 * Defines the contract for tabbed terminal UI implementations.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Internal tab specification for the tabbed terminal UI.
 */
export type TabSpec = {
  /**
   * The label displayed in the tab bar.
   */
  label: string;
  /**
   * The shell command to execute.
   */
  exec: string;
};

/**
 * Options for the tabs adapter.
 */
export type TabsOptions = {
  /**
   * Name shown in console messages.
   */
  name: string;
  /**
   * Working directory for all commands.
   */
  cwd: string;
  /**
   * Environment variables for all commands.
   */
  env: Record<string, string | undefined>;
};

/**
 * Tabs Adapter for running multiple commands in a tabbed terminal UI.
 */
export interface TabsAdapter {
  /**
   * Run multiple commands in a tabbed terminal interface.
   *
   * @param items - Array of tab specifications to run
   * @param options - Common options for all tabs
   * @returns Promise that resolves when all commands complete
   */
  run(items: TabSpec[], options: TabsOptions): Promise<void>;
}
