/**
 * Tests for output configuration detection and flag extraction.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { detectOutputConfig, extractOutputFlags, OUTPUT_FLAGS } from '../src';

describe('Output Config', () => {
  // Store original env and stdout.isTTY for restoration
  let originalEnv: typeof process.env;
  let originalIsTTY: boolean | undefined;
  let originalStdinIsTTY: boolean | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalIsTTY = process.stdout.isTTY;
    originalStdinIsTTY = process.stdin.isTTY;
  });

  afterEach(() => {
    process.env = originalEnv;
    // Restore isTTY - note this is read-only in some environments
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalStdinIsTTY,
      writable: true,
      configurable: true,
    });
  });

  /**
   * Helper to set environment variables for testing
   */
  function setEnv(vars: Record<string, string | undefined>) {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  /**
   * Helper to simulate TTY status
   */
  function setTTY(isTTY: boolean) {
    Object.defineProperty(process.stdout, 'isTTY', {
      value: isTTY,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process.stdin, 'isTTY', {
      value: isTTY,
      writable: true,
      configurable: true,
    });
  }

  describe('detectOutputConfig', () => {
    describe('color detection', () => {
      it('respects NO_COLOR environment variable', () => {
        setEnv({ NO_COLOR: '1', FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.color).toBe(false);
      });

      it('disables color with NO_COLOR set to empty string', () => {
        setEnv({ NO_COLOR: '', FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.color).toBe(false);
      });

      it('--no-color flag disables color', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig(['--no-color']);
        expect(config.color).toBe(false);
      });


      it('--no-color overrides FORCE_COLOR', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: '1', CI: undefined, TERM: undefined });
        setTTY(false);
        const config = detectOutputConfig(['--no-color']);
        expect(config.color).toBe(false);
      });

      it('TERM=dumb disables color', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: 'dumb' });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.color).toBe(false);
      });

      it('non-TTY disables color by default', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(false);
        const config = detectOutputConfig([]);
        expect(config.color).toBe(false);
      });

      it('FORCE_COLOR enables color in non-TTY', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: '1', CI: undefined, TERM: undefined });
        setTTY(false);
        const config = detectOutputConfig([]);
        expect(config.color).toBe(true);
      });

      it('enables color in TTY with no disabling flags', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.color).toBe(true);
      });
    });

    describe('unicode detection', () => {
      it('--no-unicode flag disables unicode', () => {
        setEnv({ NO_COLOR: undefined, NO_UNICODE: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig(['--no-unicode']);
        expect(config.unicode).toBe(false);
      });

      it('NO_UNICODE environment disables unicode', () => {
        setEnv({ NO_COLOR: undefined, NO_UNICODE: '1', FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.unicode).toBe(false);
      });

      it('TERM=dumb disables unicode', () => {
        setEnv({ NO_COLOR: undefined, NO_UNICODE: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: 'dumb' });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.unicode).toBe(false);
      });

      it('enables unicode by default', () => {
        setEnv({ NO_COLOR: undefined, NO_UNICODE: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.unicode).toBe(true);
      });

      it('--no-color does not disable unicode', () => {
        setEnv({ NO_COLOR: undefined, NO_UNICODE: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig(['--no-color']);
        expect(config.unicode).toBe(true);
      });
    });

    describe('interactivity detection', () => {
      it('--no-tty flag disables interactivity', () => {
        setEnv({ NO_TTY: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig(['--no-tty']);
        expect(config.interactive).toBe(false);
      });

      it('NO_TTY environment disables interactivity', () => {
        setEnv({ NO_TTY: '1', CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.interactive).toBe(false);
      });

      it('CI environment disables interactivity', () => {
        setEnv({ NO_TTY: undefined, CI: 'true', TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.interactive).toBe(false);
      });

      it('non-TTY disables interactivity', () => {
        setEnv({ NO_TTY: undefined, CI: undefined, TERM: undefined });
        setTTY(false);
        const config = detectOutputConfig([]);
        expect(config.interactive).toBe(false);
      });

      it('enables interactivity by default', () => {
        setEnv({ NO_TTY: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.interactive).toBe(true);
      });
    });

    describe('verbose detection', () => {
      it('--verbose flag enables verbose mode', () => {
        const config = detectOutputConfig(['--verbose']);
        expect(config.verbose).toBe(true);
      });

      it('verbose is disabled by default', () => {
        const config = detectOutputConfig([]);
        expect(config.verbose).toBe(false);
      });
    });

    describe('combined scenarios', () => {
      it('CI environment disables interactivity but allows color if FORCE_COLOR is set', () => {
        setEnv({ NO_COLOR: undefined, NO_UNICODE: undefined, FORCE_COLOR: '1', CI: 'true', TERM: undefined });
        setTTY(false);
        const config = detectOutputConfig([]);
        expect(config.color).toBe(true);
        expect(config.interactive).toBe(false);
        expect(config.unicode).toBe(true);
      });

      it('--no-color and --no-unicode disable both color and unicode', () => {
        setEnv({ NO_COLOR: undefined, NO_UNICODE: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig(['--no-color', '--no-unicode']);
        expect(config.color).toBe(false);
        expect(config.unicode).toBe(false);
      });

      it('respects flags anywhere in args', () => {
        const config = detectOutputConfig(['command', '--no-color', 'arg']);
        expect(config.color).toBe(false);
      });
    });
  });

  describe('extractOutputFlags', () => {
    it('extracts --no-color flag', () => {
      const result = extractOutputFlags(['command', '--no-color', 'arg']);
      expect(result.outputArgs).toEqual(['--no-color']);
      expect(result.remainingArgs).toEqual(['command', 'arg']);
    });

    it('extracts --no-unicode flag', () => {
      const result = extractOutputFlags(['--no-unicode', 'command']);
      expect(result.outputArgs).toEqual(['--no-unicode']);
      expect(result.remainingArgs).toEqual(['command']);
    });

    it('extracts --no-tty flag', () => {
      const result = extractOutputFlags(['command', '--no-tty']);
      expect(result.outputArgs).toEqual(['--no-tty']);
      expect(result.remainingArgs).toEqual(['command']);
    });

    it('extracts --verbose flag', () => {
      const result = extractOutputFlags(['command', '--verbose']);
      expect(result.outputArgs).toEqual(['--verbose']);
      expect(result.remainingArgs).toEqual(['command']);
    });

    it('extracts multiple output flags', () => {
      const result = extractOutputFlags(['--no-color', 'command', '--verbose', '--no-tty']);
      expect(result.outputArgs).toEqual(['--no-color', '--verbose', '--no-tty']);
      expect(result.remainingArgs).toEqual(['command']);
    });

    it('preserves order of remaining args', () => {
      const result = extractOutputFlags(['a', '--no-unicode', 'b', '--no-color', 'c']);
      expect(result.remainingArgs).toEqual(['a', 'b', 'c']);
    });

    it('returns empty outputArgs when no flags present', () => {
      const result = extractOutputFlags(['command', 'arg']);
      expect(result.outputArgs).toEqual([]);
      expect(result.remainingArgs).toEqual(['command', 'arg']);
    });

    it('handles empty args', () => {
      const result = extractOutputFlags([]);
      expect(result.outputArgs).toEqual([]);
      expect(result.remainingArgs).toEqual([]);
    });
  });

  describe('OUTPUT_FLAGS constant', () => {
    it('contains expected flags', () => {
      expect(OUTPUT_FLAGS).toContain('--no-color');
      expect(OUTPUT_FLAGS).toContain('--no-unicode');
      expect(OUTPUT_FLAGS).toContain('--no-tty');
      expect(OUTPUT_FLAGS).toContain('--verbose');
    });
  });
});
