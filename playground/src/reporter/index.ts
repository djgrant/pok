/**
 * PlaygroundReporter - Rich terminal output for the pok playground
 *
 * Creates beautiful, readable explanations with info boxes, tip boxes,
 * code blocks, and step indicators using ANSI escape sequences.
 */

// ============================================================================
// Types
// ============================================================================

export interface PlaygroundReporter {
  // Rich content boxes - bordered boxes with titles
  infoBox(title: string, content: string): void;
  tipBox(content: string): void;
  warningBox(content: string): void;

  // Code display - syntax highlighted code in a box
  codeBlock(filename: string, code: string, options?: { language?: string }): void;

  // Progress - step indicator like "Step 2 of 5: Creating your first command"
  stepIndicator(current: number, total: number, title: string): void;

  // Standard output
  log(message: string): void;
  success(message: string): void;
  error(message: string): void;

  // Spacing
  newline(): void;
}

// ============================================================================
// ANSI Escape Codes
// ============================================================================

const ANSI = {
  // Reset
  reset: '\x1b[0m',

  // Styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',

  // Foreground colors (Tokyo Night compatible)
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Bright foreground colors
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
} as const;

// Box drawing characters (Unicode)
const BOX = {
  topLeft: '\u256d',
  topRight: '\u256e',
  bottomLeft: '\u2570',
  bottomRight: '\u256f',
  horizontal: '\u2500',
  vertical: '\u2502',
  leftT: '\u251c',
  rightT: '\u2524',
  heavyHorizontal: '\u2501',
} as const;

// Icons
const ICONS = {
  info: '\u2139',
  tip: '\u2728',
  warning: '\u26a0',
  success: '\u2714',
  error: '\u2718',
  bullet: '\u25cf',
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap text to fit within a maximum width, preserving words
 */
function wrapText(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];

  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (currentLine.length === 0) {
        currentLine = word;
      } else if (currentLine.length + 1 + word.length <= maxWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
  }

  return lines;
}

/**
 * Pad a string to a specific width
 */
function padRight(str: string, width: number): string {
  const visibleLength = stripAnsi(str).length;
  const padding = Math.max(0, width - visibleLength);
  return str + ' '.repeat(padding);
}

/**
 * Strip ANSI escape codes from a string (for length calculation)
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Create a horizontal line
 */
function horizontalLine(width: number, char: string = BOX.horizontal): string {
  return char.repeat(width);
}

// ============================================================================
// Box Renderers
// ============================================================================

interface BoxOptions {
  width?: number;
  borderColor?: string;
  titleColor?: string;
  icon?: string;
  iconColor?: string;
}

/**
 * Render a box with optional title
 */
function renderBox(title: string | null, content: string, options: BoxOptions = {}): string[] {
  const width = options.width ?? 60;
  const borderColor = options.borderColor ?? ANSI.dim;
  const titleColor = options.titleColor ?? ANSI.white;
  const icon = options.icon ?? '';
  const iconColor = options.iconColor ?? titleColor;

  const innerWidth = width - 4; // Account for "| " and " |"
  const lines: string[] = [];

  // Top border
  if (title) {
    const iconPart = icon ? `${iconColor}${icon}${ANSI.reset}  ` : '';
    const titlePart = `${titleColor}${ANSI.bold}${title}${ANSI.reset}`;
    const headerContent = `  ${iconPart}${titlePart}`;
    const headerVisibleLen = stripAnsi(headerContent).length;
    const remainingWidth = Math.max(0, width - 2 - headerVisibleLen);

    lines.push(
      `${borderColor}${BOX.topLeft}${horizontalLine(width - 2)}${BOX.topRight}${ANSI.reset}`
    );
    lines.push(
      `${borderColor}${BOX.vertical}${ANSI.reset}${headerContent}${' '.repeat(remainingWidth)}${borderColor}${BOX.vertical}${ANSI.reset}`
    );
    lines.push(`${borderColor}${BOX.leftT}${horizontalLine(width - 2)}${BOX.rightT}${ANSI.reset}`);
  } else {
    lines.push(
      `${borderColor}${BOX.topLeft}${horizontalLine(width - 2)}${BOX.topRight}${ANSI.reset}`
    );
  }

  // Content
  const wrappedContent = wrapText(content, innerWidth);
  for (const line of wrappedContent) {
    const paddedLine = padRight(`  ${line}`, width - 2);
    lines.push(
      `${borderColor}${BOX.vertical}${ANSI.reset}${paddedLine}${borderColor}${BOX.vertical}${ANSI.reset}`
    );
  }

  // Bottom border
  lines.push(
    `${borderColor}${BOX.bottomLeft}${horizontalLine(width - 2)}${BOX.bottomRight}${ANSI.reset}`
  );

  return lines;
}

/**
 * Render a code block with line numbers
 */
function renderCodeBlock(
  filename: string,
  code: string,
  options: { width?: number; language?: string } = {}
): string[] {
  const width = options.width ?? 60;
  const borderColor = ANSI.dim;
  const lines: string[] = [];

  // Parse code into lines
  const codeLines = code.split('\n');
  const lineNumWidth = String(codeLines.length).length;
  const contentWidth = width - 4 - lineNumWidth - 3; // borders + padding + line num + separator

  // Top border with filename
  const fileLabel = ` ${filename} `;
  const topLineLen = width - 2 - fileLabel.length;
  const leftPad = 1;
  lines.push(
    `${borderColor}${BOX.topLeft}${horizontalLine(leftPad)}${ANSI.reset}${ANSI.cyan}${fileLabel}${ANSI.reset}${borderColor}${horizontalLine(topLineLen - leftPad)}${BOX.topRight}${ANSI.reset}`
  );

  // Code lines
  for (let i = 0; i < codeLines.length; i++) {
    const lineNum = String(i + 1).padStart(lineNumWidth, ' ');
    let codeLine = codeLines[i];

    // Truncate if too long
    if (codeLine.length > contentWidth) {
      codeLine = codeLine.substring(0, contentWidth - 1) + '\u2026';
    }

    const paddedCode = padRight(codeLine, contentWidth);
    lines.push(
      `${borderColor}${BOX.vertical}${ANSI.reset} ${ANSI.dim}${lineNum}${ANSI.reset} ${borderColor}\u2502${ANSI.reset} ${paddedCode}${borderColor}${BOX.vertical}${ANSI.reset}`
    );
  }

  // Bottom border
  lines.push(
    `${borderColor}${BOX.bottomLeft}${horizontalLine(width - 2)}${BOX.bottomRight}${ANSI.reset}`
  );

  return lines;
}

/**
 * Render a step indicator
 */
function renderStepIndicator(
  current: number,
  total: number,
  title: string,
  options: { width?: number } = {}
): string[] {
  const width = options.width ?? 60;
  const lines: string[] = [];

  const stepText = `  Step ${current} of ${total}: ${title}`;
  const line = BOX.heavyHorizontal.repeat(width);

  lines.push(`${ANSI.magenta}${line}${ANSI.reset}`);
  lines.push(`${ANSI.magenta}${ANSI.bold}${stepText}${ANSI.reset}`);
  lines.push(`${ANSI.magenta}${line}${ANSI.reset}`);

  return lines;
}

// ============================================================================
// Reporter Factory
// ============================================================================

/**
 * Create a PlaygroundReporter instance
 *
 * @param output - Function to output text (defaults to console.log)
 * @param options - Configuration options
 */
export function createPlaygroundReporter(
  output: (text: string) => void = console.log,
  options: { width?: number } = {}
): PlaygroundReporter {
  const width = options.width ?? 60;

  const writeLine = (line: string) => output(line);
  const writeLines = (lines: string[]) => lines.forEach(writeLine);

  return {
    infoBox(title: string, content: string): void {
      const lines = renderBox(title, content, {
        width,
        borderColor: ANSI.blue,
        titleColor: ANSI.brightBlue,
        icon: ICONS.info,
        iconColor: ANSI.blue,
      });
      writeLines(lines);
    },

    tipBox(content: string): void {
      const lines = renderBox('Tip', content, {
        width,
        borderColor: ANSI.green,
        titleColor: ANSI.brightGreen,
        icon: ICONS.tip,
        iconColor: ANSI.yellow,
      });
      writeLines(lines);
    },

    warningBox(content: string): void {
      const lines = renderBox('Warning', content, {
        width,
        borderColor: ANSI.yellow,
        titleColor: ANSI.brightYellow,
        icon: ICONS.warning,
        iconColor: ANSI.yellow,
      });
      writeLines(lines);
    },

    codeBlock(filename: string, code: string, codeOptions?: { language?: string }): void {
      const lines = renderCodeBlock(filename, code, {
        width,
        language: codeOptions?.language,
      });
      writeLines(lines);
    },

    stepIndicator(current: number, total: number, title: string): void {
      const lines = renderStepIndicator(current, total, title, { width });
      writeLines(lines);
    },

    log(message: string): void {
      writeLine(message);
    },

    success(message: string): void {
      writeLine(`${ANSI.green}${ICONS.success}${ANSI.reset}  ${message}`);
    },

    error(message: string): void {
      writeLine(`${ANSI.red}${ICONS.error}${ANSI.reset}  ${message}`);
    },

    newline(): void {
      writeLine('');
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export { wrapText, stripAnsi };
export type { BoxOptions };
