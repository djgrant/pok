/**
 * Output Configuration
 *
 * Provides central configuration for output formatting, including:
 * - Color support detection via NO_COLOR env var and --no-color flag
 * - Unicode support detection via CI env var and --plain flag
 * - TTY detection for interactive terminals
 *
 * Follows the NO_COLOR standard: https://no-color.org
 */

/**
 * Output configuration for controlling terminal output formatting
 */
export type OutputConfig = {
  /** Whether to use ANSI color codes */
  color: boolean;
  /** Whether to use Unicode symbols (vs ASCII fallbacks) */
  unicode: boolean;
  /** Whether to stream all logs immediately (no buffering during spinners) */
  verbose: boolean;
};

/**
 * Output-related CLI flags that should be extracted from args
 */
export const OUTPUT_FLAGS = ['--no-color', '--plain', '--verbose'] as const;

/**
 * Detect output configuration from command-line args and environment
 *
 * Priority for color:
 * 1. --no-color or --plain flag (highest priority - disables color)
 * 2. NO_COLOR env var (any value disables color)
 * 3. TERM=dumb (disables color)
 * 4. Non-TTY stdout (disables color unless FORCE_COLOR is set)
 * 5. FORCE_COLOR env var (enables color even in non-TTY)
 *
 * Priority for unicode:
 * 1. --plain flag (highest priority - disables unicode)
 * 2. CI env var (disables unicode)
 * 3. TERM=dumb (disables unicode)
 *
 * @param args - Command-line arguments
 * @returns Output configuration
 */
export function detectOutputConfig(args: string[]): OutputConfig {
  // Check for explicit flags first
  const noColor = args.includes('--no-color');
  const plain = args.includes('--plain');

  // Check environment variables
  const envNoColor = process.env.NO_COLOR !== undefined;
  const envForceColor = process.env.FORCE_COLOR !== undefined;
  const ci = process.env.CI !== undefined;
  const termDumb = process.env.TERM === 'dumb';

  // Check terminal capabilities
  const isTTY = process.stdout.isTTY === true;

  // Determine color support
  // Explicit --no-color or --plain always disables color
  // NO_COLOR env var disables color
  // TERM=dumb disables color
  // Non-TTY disables color unless FORCE_COLOR is set
  const color = !noColor && !plain && !envNoColor && !termDumb && (isTTY || envForceColor);

  // Determine unicode support
  // --plain always disables unicode
  // CI environments default to no unicode for cleaner logs
  // TERM=dumb implies no unicode support
  const unicode = !plain && !ci && !termDumb;

  // Check for verbose flag
  const verbose = args.includes('--verbose');

  return { color, unicode, verbose };
}

/**
 * Extract output-related flags from args, returning remaining args
 *
 * @param args - Command-line arguments
 * @returns Object with output flags and remaining args
 */
export function extractOutputFlags(args: string[]): {
  outputArgs: string[];
  remainingArgs: string[];
} {
  const outputArgs: string[] = [];
  const remainingArgs: string[] = [];

  for (const arg of args) {
    if (OUTPUT_FLAGS.includes(arg as (typeof OUTPUT_FLAGS)[number])) {
      outputArgs.push(arg);
    } else {
      remainingArgs.push(arg);
    }
  }

  return { outputArgs, remainingArgs };
}
