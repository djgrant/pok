/**
 * Tabs Adapter Interface
 *
 * Defines the contract for tabbed terminal UI implementations.
 * Used by r.tabs() to run multiple commands in a tabbed interface.
 *
 * Implementations: @openpok/core-reporter-ink (provides both reporter and tabs)
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Internal tab specification for the tabbed terminal UI.
 * This is the format used by adapters after the runner resolves envs.
 */
export type TabSpec = {
  label: string;
  exec: string;
};

export type TabsOptions = {
  /** Name shown in console messages */
  name: string;
  /** Working directory for commands */
  cwd: string;
  /** Environment variables for commands */
  env: Record<string, string | undefined>;
};

// =============================================================================
// Interface
// =============================================================================

export interface TabsAdapter {
  /**
   * Run multiple commands in a tabbed terminal interface.
   * Each tab shows the buffered output of its command.
   * User can switch tabs and scroll through output.
   */
  run(items: TabSpec[], options: TabsOptions): Promise<void>;
}
