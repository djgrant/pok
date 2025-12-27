import { Box, Text } from 'ink';
import { HELP_CONTENT } from '@openpok/tabs-core';

export type HelpOverlayProps = {
  onClose: () => void;
};

export function HelpOverlay(_props: HelpOverlayProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="blue" paddingX={2} paddingY={1}>
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
