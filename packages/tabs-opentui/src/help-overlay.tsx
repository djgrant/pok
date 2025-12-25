/**
 * Help Overlay for OpenTUI
 *
 * Displays keyboard shortcuts in a modal overlay.
 */

type ShortcutGroup = {
  title: string;
  shortcuts: Array<{ key: string; description: string }>;
};

const HELP_CONTENT: ShortcutGroup[] = [
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

export type HelpOverlayProps = {
  onClose: () => void;
};

export function HelpOverlay(_props: HelpOverlayProps) {
  return (
    <box
      flexDirection="column"
      border={['top', 'bottom', 'left', 'right']}
      borderStyle="single"
      borderColor="#0000FF"
      padding={1}
    >
      <box justifyContent="center" marginBottom={1}>
        <text fg="#FFFFFF">Keyboard Help</text>
      </box>

      {HELP_CONTENT.map((group, i) => (
        <box
          key={group.title}
          flexDirection="column"
          marginBottom={i < HELP_CONTENT.length - 1 ? 1 : 0}
        >
          <text fg="#00FFFF">{group.title}</text>
          {group.shortcuts.map(({ key, description }) => (
            <box key={key} flexDirection="row">
              <box width={16}>
                <text fg="#FFFF00">{key}</text>
              </box>
              <text>{description}</text>
            </box>
          ))}
        </box>
      ))}

      <box marginTop={1} justifyContent="center">
        <text fg="#666666">Press ? or Escape to close</text>
      </box>
    </box>
  );
}

export { HELP_CONTENT };
