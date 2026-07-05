import { describe, it, expect } from 'bun:test';
import { createScreen } from '../src/screen';
import type { OutputConfig } from '@pokit/core';

const interactive: OutputConfig = { color: true, unicode: true, verbose: false, interactive: true };
const nonInteractive: OutputConfig = { color: false, unicode: false, verbose: false, interactive: false };

describe('Screen.withLoading', () => {
  describe('non-interactive path', () => {
    it('runs the work without a spinner and returns its result', async () => {
      const screen = createScreen(nonInteractive);
      let sawSignal: AbortSignal | undefined;

      const result = await screen.withLoading('loading', async (signal) => {
        sawSignal = signal;
        return 42;
      });

      expect(result).toBe(42);
      // A signal is always provided, and it is not aborted for a successful run.
      expect(sawSignal).toBeInstanceOf(AbortSignal);
      expect(sawSignal!.aborted).toBe(false);
    });

    it('propagates errors from the work', async () => {
      const screen = createScreen(nonInteractive);
      await expect(
        screen.withLoading('loading', async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
    });
  });

  describe('interactive path', () => {
    it('aborts the work signal when the work throws (cancel)', async () => {
      const screen = createScreen(interactive);
      let sawSignal: AbortSignal | undefined;

      await expect(
        screen.withLoading('loading', async (signal) => {
          sawSignal = signal;
          expect(signal.aborted).toBe(false);
          throw new Error('cancelled');
        })
      ).rejects.toThrow('cancelled');

      // On failure the screen aborts the controller so in-flight async option
      // loading can bail out.
      expect(sawSignal).toBeInstanceOf(AbortSignal);
      expect(sawSignal!.aborted).toBe(true);
    });

    it('returns the result and leaves the signal un-aborted on success', async () => {
      const screen = createScreen(interactive);
      let sawSignal: AbortSignal | undefined;

      const result = await screen.withLoading('loading', async (signal) => {
        sawSignal = signal;
        return 'ok';
      });

      expect(result).toBe('ok');
      expect(sawSignal!.aborted).toBe(false);
    });
  });
});
