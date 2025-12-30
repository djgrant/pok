/**
 * useTutorialActions - Hook for executing tutorial actions in WebContainer
 *
 * Provides file creation and command execution capabilities for the tutorial panel.
 */

import { useState, useCallback, useRef } from 'react';
import { WebContainer } from '@webcontainer/api';
import { UseEventBusResult } from './useEventBus';

export type TutorialActions = {
  createFile: (path: string, content: string) => Promise<void>;
  runCommand: (command: string) => Promise<{ exitCode: number; output: string[] }>;
  openFile: (path: string) => void;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
};

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 300;

export function useTutorialActions(
  webContainer: WebContainer | null,
  eventBus: UseEventBusResult,
  openFileTab: (path: string) => void,
  setActiveTerminal: () => void
): TutorialActions {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastActionRef = useRef<number>(0);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Create a file in the WebContainer filesystem.
   * - Ensures parent directories exist
   * - Writes the file content
   * - Emits file:created event for tree refresh
   * - Opens the file in the editor
   */
  const createFile = useCallback(
    async (path: string, content: string): Promise<void> => {
      // Debounce check
      const now = Date.now();
      if (now - lastActionRef.current < DEBOUNCE_DELAY) {
        return;
      }
      lastActionRef.current = now;

      if (!webContainer) {
        throw new Error('WebContainer not ready');
      }

      setIsLoading(true);
      setError(null);

      try {
        // Ensure directory exists
        const dir = path.split('/').slice(0, -1).join('/');
        if (dir) {
          await webContainer.fs.mkdir(dir, { recursive: true });
        }

        // Write the file
        await webContainer.fs.writeFile(path, content);

        // Emit event for file tree refresh
        eventBus.emit({ type: 'file:created', path });

        // Open the file in the editor
        openFileTab(path);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Failed to create file: ${message}`);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [webContainer, eventBus, openFileTab]
  );

  /**
   * Run a command in the WebContainer.
   * - Switches to terminal tab
   * - Spawns the command via shell
   * - Captures output
   * - Returns exit code and output lines
   */
  const runCommand = useCallback(
    async (command: string): Promise<{ exitCode: number; output: string[] }> => {
      // Debounce check
      const now = Date.now();
      if (now - lastActionRef.current < DEBOUNCE_DELAY) {
        return { exitCode: -1, output: ['Action debounced'] };
      }
      lastActionRef.current = now;

      if (!webContainer) {
        throw new Error('WebContainer not ready');
      }

      setIsLoading(true);
      setError(null);

      try {
        // Switch to terminal tab first
        setActiveTerminal();

        const output: string[] = [];

        // Spawn the command via shell
        const process = await webContainer.spawn('sh', ['-c', command]);

        // Collect output from stdout
        const reader = process.output.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              // Split by newlines and add to output
              const lines = value.split('\n').filter((line) => line.length > 0);
              output.push(...lines);
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Wait for process to exit
        const exitCode = await process.exit;

        if (exitCode !== 0) {
          setError(`Command failed with exit code ${exitCode}`);
        }

        return { exitCode, output };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Failed to run command: ${message}`);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [webContainer, setActiveTerminal]
  );

  /**
   * Open a file in the editor (no WebContainer interaction needed).
   */
  const openFile = useCallback(
    (path: string): void => {
      openFileTab(path);
    },
    [openFileTab]
  );

  return {
    createFile,
    runCommand,
    openFile,
    isLoading,
    error,
    clearError,
  };
}
