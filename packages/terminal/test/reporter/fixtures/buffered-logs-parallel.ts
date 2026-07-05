/**
 * Expected output for logs buffered during parallel activities
 * Logs appear after activities complete at group end
 */
export const lines: string[] = [
  '┌  Parallel Deploy',
  '│',
  '◇  Task A',
  '│  ●  Task A info',
  '◇  Task B',
  '│  ▲  Task B warning',
  '│',
  '└  ✔ Done',
];
