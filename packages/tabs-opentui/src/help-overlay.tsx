/**
 * Help Overlay for OpenTUI
 *
 * Displays keyboard shortcuts in a modal overlay.
 */

import { HELP_CONTENT } from '@openpok/tabs-core';

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
