/**
 * ANSI rendering for introspect TUI.
 */

import type { IntrospectState, FileEntry } from './state';
import { highlightCode } from './highlight';

// ANSI escape sequences
const ESC = '\x1b';
const CLEAR_SCREEN = `${ESC}[2J`;
const CURSOR_HOME = `${ESC}[H`;
const CURSOR_HIDE = `${ESC}[?25l`;
const CURSOR_SHOW = `${ESC}[?25h`;
const RESET = `${ESC}[0m`;
const BOLD = `${ESC}[1m`;
const DIM = `${ESC}[2m`;
const INVERSE = `${ESC}[7m`;
const CYAN = `${ESC}[36m`;
const YELLOW = `${ESC}[33m`;
const BLUE = `${ESC}[34m`;
const GRAY = `${ESC}[90m`;

// Icons
const FOLDER_ICON = '\u{1F4C1}'; // Folder
const FILE_ICON = '\u{1F4C4}'; // File
const FOLDER_OPEN_ICON = '\u{1F4C2}'; // Open folder

/**
 * Renders the entire TUI to stdout.
 */
export function render(
  state: IntrospectState,
  stdout: NodeJS.WriteStream,
  previewContent: string
): void {
  const { rows, cols } = state.terminalSize;

  // Layout calculations
  const headerHeight = 1;
  const statusBarHeight = 1;
  const dividerHeight = 1;
  const treeHeight = Math.min(state.entries.length + 1, Math.floor(rows * 0.3));
  const previewHeight = rows - headerHeight - statusBarHeight - dividerHeight - treeHeight - 1;

  const lines: string[] = [];

  // Header
  lines.push(renderHeader(state.rootDir, cols));

  // Tree section
  lines.push(...renderTree(state, cols, treeHeight));

  // Divider
  lines.push(renderDivider(cols));

  // Preview section
  const highlightedContent = highlightCode(previewContent, getSelectedFileName(state));
  lines.push(...renderPreview(highlightedContent, state.previewScroll, cols, previewHeight));

  // Status bar
  lines.push(renderStatusBar(state, cols));

  // Help overlay (if shown)
  if (state.showHelp) {
    const helpLines = renderHelpOverlay(cols, rows);
    // Overlay in center
    const startRow = Math.floor((rows - helpLines.length) / 2);
    for (let i = 0; i < helpLines.length; i++) {
      if (startRow + i < lines.length) {
        lines[startRow + i] = helpLines[i];
      }
    }
  }

  // Write to stdout
  stdout.write(CURSOR_HIDE);
  stdout.write(CLEAR_SCREEN);
  stdout.write(CURSOR_HOME);
  stdout.write(lines.join('\n'));
}

function getSelectedFileName(state: IntrospectState): string {
  const entry = state.entries[state.selectedIndex];
  return entry?.name ?? '';
}

function renderHeader(rootDir: string, cols: number): string {
  const title = ` ${rootDir} `;
  const padding = Math.max(0, cols - title.length - 2);
  const line = '\u2500'.repeat(padding);
  return `${BOLD}${CYAN}\u250C\u2500${title}${line}\u2510${RESET}`;
}

function renderTree(state: IntrospectState, cols: number, maxLines: number): string[] {
  const lines: string[] = [];

  for (let i = 0; i < Math.min(state.entries.length, maxLines - 1); i++) {
    const entry = state.entries[i];
    const isSelected = i === state.selectedIndex;
    const line = formatTreeEntry(entry, isSelected, cols);
    lines.push(line);
  }

  // Fill remaining space
  while (lines.length < maxLines - 1) {
    lines.push(`${GRAY}\u2502${RESET}${' '.repeat(cols - 2)}${GRAY}\u2502${RESET}`);
  }

  return lines;
}

function formatTreeEntry(entry: FileEntry, isSelected: boolean, cols: number): string {
  const indent = '  '.repeat(entry.depth);
  const icon =
    entry.type === 'directory' ? (entry.expanded ? FOLDER_OPEN_ICON : FOLDER_ICON) : FILE_ICON;
  const name = entry.name;

  let content = `${indent}${icon} ${name}`;
  if (entry.type === 'directory') {
    content = `${BLUE}${content}${RESET}`;
  }

  // Pad to width
  const visibleLength = indent.length + 2 + name.length + 1; // icon takes 2 chars
  const padding = Math.max(0, cols - visibleLength - 4);

  const prefix = `${GRAY}\u2502${RESET} `;
  const suffix = `${' '.repeat(padding)}${GRAY}\u2502${RESET}`;

  if (isSelected) {
    return `${prefix}${INVERSE}${content}${' '.repeat(padding)}${RESET}${GRAY}\u2502${RESET}`;
  }

  return `${prefix}${content}${suffix}`;
}

function renderDivider(cols: number): string {
  const line = '\u2500'.repeat(cols - 2);
  return `${GRAY}\u251C${line}\u2524${RESET}`;
}

function renderPreview(
  content: string,
  scrollOffset: number,
  cols: number,
  height: number
): string[] {
  const lines: string[] = [];
  const contentLines = content.split('\n');
  const lineNumWidth = String(contentLines.length).length + 1;

  for (let i = 0; i < height; i++) {
    const lineIndex = scrollOffset + i;
    if (lineIndex < contentLines.length) {
      const lineNum = String(lineIndex + 1).padStart(lineNumWidth, ' ');
      const codeLine = contentLines[lineIndex] ?? '';
      // Truncate if too long
      const maxCodeWidth = cols - lineNumWidth - 5;
      const truncatedCode =
        codeLine.length > maxCodeWidth ? codeLine.slice(0, maxCodeWidth - 1) + '\u2026' : codeLine;
      lines.push(`${GRAY}\u2502${DIM}${lineNum}\u2502${RESET} ${truncatedCode}`);
    } else {
      lines.push(`${GRAY}\u2502${' '.repeat(cols - 2)}\u2502${RESET}`);
    }
  }

  return lines;
}

function renderStatusBar(state: IntrospectState, cols: number): string {
  const isNarrow = cols < 80;

  // Use abbreviated controls for narrow terminals
  const controls = isNarrow
    ? '\u2191\u2193 \u2502 Enter \u2502 ? \u2502 q'
    : '[\u2191\u2193/jk] navigate  [Enter] expand  [PgUp/PgDn] scroll  [?] help  [q] quit';

  const fileInfo = state.entries[state.selectedIndex]?.name ?? '';

  // Truncate file info if needed to fit
  const availableWidth = cols - controls.length - 4;
  const truncatedFileInfo =
    fileInfo.length > availableWidth
      ? fileInfo.slice(0, Math.max(0, availableWidth - 1)) + '\u2026'
      : fileInfo;

  const padding = Math.max(0, cols - controls.length - truncatedFileInfo.length - 4);

  return `${GRAY}\u2514${YELLOW}${controls}${RESET}${' '.repeat(padding)}${DIM}${truncatedFileInfo}${RESET}${GRAY}\u2518${RESET}`;
}

function renderHelpOverlay(cols: number, _rows: number): string[] {
  const helpContent = [
    '',
    '  Keyboard Controls  ',
    '',
    '  \u2191 / k      Move up',
    '  \u2193 / j      Move down',
    '  Enter      Expand/collapse directory',
    '  PgUp       Scroll preview up',
    '  PgDn       Scroll preview down',
    '  ?          Toggle this help',
    '  q          Quit',
    '',
  ];

  const maxWidth = Math.max(...helpContent.map((l) => l.length)) + 4;
  const boxWidth = Math.min(maxWidth, cols - 10);

  const lines: string[] = [];
  const leftPad = Math.floor((cols - boxWidth) / 2);
  const padStr = ' '.repeat(leftPad);

  lines.push(`${padStr}${BOLD}${CYAN}\u250C${'\u2500'.repeat(boxWidth - 2)}\u2510${RESET}`);

  for (const line of helpContent) {
    const contentPad = boxWidth - line.length - 2;
    lines.push(
      `${padStr}${CYAN}\u2502${RESET}${line}${' '.repeat(Math.max(0, contentPad))}${CYAN}\u2502${RESET}`
    );
  }

  lines.push(`${padStr}${CYAN}\u2514${'\u2500'.repeat(boxWidth - 2)}\u2518${RESET}`);

  return lines;
}

/**
 * Shows the cursor when exiting.
 */
export function showCursor(stdout: NodeJS.WriteStream): void {
  stdout.write(CURSOR_SHOW);
}

/**
 * Clears the screen.
 */
export function clearScreen(stdout: NodeJS.WriteStream): void {
  stdout.write(CLEAR_SCREEN);
  stdout.write(CURSOR_HOME);
}
