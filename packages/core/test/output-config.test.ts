/**
 * Tests for output configuration detection and flag extraction.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { detectOutputConfig, extractOutputFlags, OUTPUT_FLAGS } from '../src';

describe('Output Config', () => {
  // Store original env and stdout.isTTY for restoration
  let originalEnv: typeof process.env;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalEnv = { ...process.env };
    originalIsTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    process.env = originalEnv;
    // Restore isTTY - note this is read-only in some environments
    Object.defineProperty(process.stdout, 'isTTY', {
      value: originalIsTTY,
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

      it('--plain flag disables color', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig(['--plain']);
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
      it('--plain flag disables unicode', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig(['--plain']);
        expect(config.unicode).toBe(false);
      });

      it('CI environment disables unicode', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, CI: 'true', TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.unicode).toBe(false);
      });

      it('TERM=dumb disables unicode', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: 'dumb' });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.unicode).toBe(false);
      });

      it('enables unicode by default', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig([]);
        expect(config.unicode).toBe(true);
      });

      it('--no-color does not disable unicode', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig(['--no-color']);
        expect(config.unicode).toBe(true);
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
      it('CI environment disables unicode but allows color if FORCE_COLOR is set', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: '1', CI: 'true', TERM: undefined });
        setTTY(false);
        const config = detectOutputConfig([]);
        expect(config.color).toBe(true);
        expect(config.unicode).toBe(false);
      });

      it('--plain disables both color and unicode', () => {
        setEnv({ NO_COLOR: undefined, FORCE_COLOR: undefined, CI: undefined, TERM: undefined });
        setTTY(true);
        const config = detectOutputConfig(['--plain']);
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

    it('extracts --plain flag', () => {
      const result = extractOutputFlags(['--plain', 'command']);
      expect(result.outputArgs).toEqual(['--plain']);
      expect(result.remainingArgs).toEqual(['command']);
    });

    it('extracts --verbose flag', () => {
      const result = extractOutputFlags(['command', '--verbose']);
      expect(result.outputArgs).toEqual(['--verbose']);
      expect(result.remainingArgs).toEqual(['command']);
    });

    it('extracts multiple output flags', () => {
      const result = extractOutputFlags(['--no-color', 'command', '--verbose']);
      expect(result.outputArgs).toEqual(['--no-color', '--verbose']);
      expect(result.remainingArgs).toEqual(['command']);
    });

    it('preserves order of remaining args', () => {
      const result = extractOutputFlags(['a', '--plain', 'b', '--no-color', 'c']);
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
      expect(OUTPUT_FLAGS).toContain('--plain');
      expect(OUTPUT_FLAGS).toContain('--verbose');
    });
  });
});
