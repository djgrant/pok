import * as fs from 'fs';
import * as path from 'path';
import xdg from '@folder/xdg';

const MAX_ENTRIES = 50;

export type HistoryEntry = {
  commandPath: string[];
  args: string[];
  timestamp: string;
};

type HistoryFile = {
  entries: HistoryEntry[];
};

function getHistoryPath(appName: string): string {
  const dirs = xdg();
  const dataDir = dirs.data;
  return path.join(dataDir, 'pok', appName, 'history.json');
}

export function loadHistory(appName: string): HistoryEntry[] {
  const historyPath = getHistoryPath(appName);
  try {
    const content = fs.readFileSync(historyPath, 'utf-8');
    const data: HistoryFile = JSON.parse(content);
    return data.entries ?? [];
  } catch {
    return [];
  }
}

function saveHistory(appName: string, entries: HistoryEntry[]): void {
  const historyPath = getHistoryPath(appName);
  const dir = path.dirname(historyPath);
  fs.mkdirSync(dir, { recursive: true });
  const data: HistoryFile = { entries };
  fs.writeFileSync(historyPath, JSON.stringify(data, null, 2), 'utf-8');
}

export function appendHistory(
  appName: string,
  commandPath: string[],
  args: string[]
): void {
  let entries = loadHistory(appName);

  const isSame = (a: HistoryEntry) =>
    a.commandPath.join('.') === commandPath.join('.') &&
    a.args.join(' ') === args.join(' ');

  entries = entries.filter((e) => !isSame(e));

  entries.unshift({
    commandPath,
    args,
    timestamp: new Date().toISOString(),
  });

  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(0, MAX_ENTRIES);
  }

  saveHistory(appName, entries);
}

export function clearHistory(appName: string): void {
  const historyPath = getHistoryPath(appName);
  try {
    fs.unlinkSync(historyPath);
  } catch {
    // ignore if not found
  }
}

export function formatEntryLabel(entry: HistoryEntry): string {
  const cmd = entry.commandPath.join(' ');
  if (entry.args.length > 0) {
    return `${cmd} ${entry.args.join(' ')}`;
  }
  return cmd;
}
