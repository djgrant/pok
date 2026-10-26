/** Shared call log for the plugin-hooks fixture (underscore: not a route). */
export const calls: string[] = [];
export const resetCalls = (): void => {
  calls.length = 0;
};
