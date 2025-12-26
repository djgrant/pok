/**
 * Shared Help Content for CLI Tabs
 *
 * Keyboard shortcut definitions and help overlay content used by all adapters.
 */

export type Shortcut = {
  key: string;
  description: string;
};

export type ShortcutGroup = {
  title: string;
  shortcuts: Shortcut[];
};

/**
 * Standard keyboard shortcut help content.
 * Used by both Ink and OpenTUI help overlays.
 */
export const HELP_CONTENT: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { key: '\u2191/\u2193', description: 'Scroll output up/down' },
      { key: 'Page Up/Dn', description: 'Scroll by page' },
      { key: 'Tab', description: 'Next tab' },
      { key: 'Shift+Tab', description: 'Previous tab' },
      { key: '1-9', description: 'Jump to tab by number' },
      { key: 'Meta+\u2190/\u2192', description: 'Previous/next tab' },
    ],
  },
  {
    title: 'Process Control',
    shortcuts: [
      { key: 'r', description: 'Restart current process' },
      { key: 'k', description: 'Kill current process' },
      { key: 'q', description: 'Quit (with confirmation)' },
      { key: 'Ctrl+C', description: 'Force quit immediately' },
    ],
  },
  {
    title: 'Input Mode',
    shortcuts: [
      { key: 'i', description: 'Enter input mode' },
      { key: 'Escape', description: 'Exit input mode' },
    ],
  },
];
