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
   * Run multiple commands in a tabbed interface.
   *
   * @param items - Array of tab specifications to run
   * @param options - Common options for all tabs
   * @returns Promise that resolves when all commands complete
   */
  run(items: TabSpec[], options: TabsOptions): Promise<void>;
}

/**
 * A function component type that doesn't require a React dependency in core.
 * Adapters will cast this to their framework's component type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent<P = any> = (props: P) => any;

/**
 * App Adapter for rendering custom fullscreen TUI applications.
 *
 * The component receives props and owns its own state via React hooks.
 * The adapter handles terminal lifecycle (alternate screen, raw mode, cleanup).
 */
export interface AppAdapter {
  /**
   * Run a fullscreen app component.
   *
   * @param component - React component to render
   * @param props - Props to pass to the component.
   * @returns Promise that resolves when the app exits
   */
  run<TProps>(
    component: AnyComponent<TProps>,
    props: TProps
  ): Promise<void>;
}
