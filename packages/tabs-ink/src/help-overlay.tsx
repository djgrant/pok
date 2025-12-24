import { Box, Text } from 'ink';

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
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="blue"
      paddingX={2}
      paddingY={1}
    >
      <Box justifyContent="center" marginBottom={1}>
        <Text bold>Keyboard Help</Text>
      </Box>

      {HELP_CONTENT.map((group, i) => (
        <Box
          key={group.title}
          flexDirection="column"
          marginBottom={i < HELP_CONTENT.length - 1 ? 1 : 0}
        >
          <Text bold color="cyan">
            {group.title}
          </Text>
          {group.shortcuts.map(({ key, description }) => (
            <Box key={key}>
              <Box width={16}>
                <Text color="yellow">{key}</Text>
              </Box>
              <Text>{description}</Text>
            </Box>
          ))}
        </Box>
      ))}

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>Press ? or Escape to close</Text>
      </Box>
    </Box>
  );
}

export { HELP_CONTENT };
