/**
 * Output Configuration
 *
 * Provides central configuration for output formatting and interactivity, including:
 * - Color support detection via NO_COLOR env var and --no-color flag
 * - Unicode support detection via NO_UNICODE env var and --no-unicode flag
 * - TTY interactivity detection via NO_TTY/CI env vars and --no-tty flag
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
  /** Whether interactive terminal UI is allowed */
  interactive: boolean;
  /** Output format override (json, table, csv) - only applies to commands with output schemas */
  format?: 'json' | 'table' | 'csv';
};

/**
 * Output-related CLI flags that should be extracted from args
 */
export const OUTPUT_FLAGS = ['--no-color', '--no-unicode', '--no-tty', '--verbose', '--format'] as const;

/**
 * Detect output configuration from command-line args and environment
 *
 * Priority for color:
 * 1. --no-color flag (highest priority - disables color)
 * 2. NO_COLOR env var (any value disables color)
 * 3. TERM=dumb (disables color)
 * 4. Non-TTY stdout (disables color unless FORCE_COLOR is set)
 * 5. FORCE_COLOR env var (enables color even in non-TTY)
 *
 * Priority for unicode:
 * 1. --no-unicode flag (highest priority - disables unicode)
 * 2. NO_UNICODE env var (any value disables unicode)
 * 3. TERM=dumb (disables unicode)
 *
 * Priority for interactivity:
 * 1. --no-tty flag (highest priority - disables interactivity)
 * 2. NO_TTY env var (disables interactivity)
 * 3. CI env var (disables interactivity)
 * 4. Non-TTY stdin/stdout (disables interactivity)
 *
 * @param args - Command-line arguments
 * @returns Output configuration
 */
export function detectOutputConfig(args: string[]): OutputConfig {
  // Check for explicit flags first
  const noColor = args.includes('--no-color');
  const noUnicode = args.includes('--no-unicode');
  const noTty = args.includes('--no-tty');

  // Check environment variables
  const envNoColor = process.env.NO_COLOR !== undefined;
  const envNoUnicode = process.env.NO_UNICODE !== undefined;
  const envNoTty = process.env.NO_TTY !== undefined;
  const envForceColor = process.env.FORCE_COLOR !== undefined;
  const ci = process.env.CI !== undefined;
  const termDumb = process.env.TERM === 'dumb';

  // Check terminal capabilities
  const stdoutIsTTY = process.stdout.isTTY === true;
  const stdinIsTTY = process.stdin.isTTY === true;
  const isTTY = stdoutIsTTY && stdinIsTTY;

  // Determine interactivity
  const interactive = !noTty && !envNoTty && !ci && isTTY;

  // Determine color support
  const color = !noColor && !envNoColor && !termDumb && (stdoutIsTTY || envForceColor);

  // Determine unicode support
  const unicode = !noUnicode && !envNoUnicode && !termDumb;

  // Check for verbose flag
  const verbose = args.includes('--verbose');

  // Check for --format flag
  const formatIndex = args.indexOf('--format');
  const formatValue = formatIndex !== -1 ? args[formatIndex + 1] : undefined;
  const format = formatValue && ['json', 'table', 'csv'].includes(formatValue)
    ? formatValue as 'json' | 'table' | 'csv'
    : undefined;

  return { color, unicode, verbose, interactive, format };
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

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (OUTPUT_FLAGS.includes(arg as (typeof OUTPUT_FLAGS)[number])) {
      outputArgs.push(arg);
      // --format takes a value argument
      if (arg === '--format' && i + 1 < args.length) {
        outputArgs.push(args[i + 1]!);
        i++; // skip the value
      }
    } else {
      remainingArgs.push(arg);
    }
  }

  return { outputArgs, remainingArgs };
}
