import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import xdg from '@folder/xdg';

const MAX_ENTRIES = 50;
const HISTORY_DIR_ENV = 'POK_HISTORY_DIR';

export type HistoryEntry = {
  commandPath: string[];
  args: string[];
  timestamp: string;
};

type HistoryFile = {
  entries: HistoryEntry[];
};

function getHistoryBaseDir(): string {
  const override = process.env[HISTORY_DIR_ENV];
  if (override && override.trim().length > 0) {
    return override;
  }

  try {
    const dirs = xdg();
    return dirs.data;
  } catch {
    return path.join(os.tmpdir(), 'pok-data');
  }
}

function getHistoryPath(appName: string): string {
  const dataDir = getHistoryBaseDir();
  return path.join(dataDir, 'pok', appName, 'history.json');
}

function canWriteHistoryPath(historyPath: string): boolean {
  const dir = path.dirname(historyPath);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function getWritableHistoryPath(appName: string): string | null {
  const preferred = getHistoryPath(appName);
  if (canWriteHistoryPath(preferred)) {
    return preferred;
  }

  const fallback = path.join(os.tmpdir(), 'pok-data', 'pok', appName, 'history.json');
  if (canWriteHistoryPath(fallback)) {
    return fallback;
  }

  return null;
}

function safeReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readHistoryFile(historyPath: string): HistoryEntry[] {
  const content = safeReadFile(historyPath);
  if (!content) return [];
  try {
    const data: HistoryFile = JSON.parse(content);
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

export function loadHistory(appName: string): HistoryEntry[] {
  const preferred = getHistoryPath(appName);
  const fallback = path.join(os.tmpdir(), 'pok-data', 'pok', appName, 'history.json');
  if (fileExists(preferred) || preferred === fallback) {
    return readHistoryFile(preferred);
  }
  return readHistoryFile(fallback);
}

function saveHistory(appName: string, entries: HistoryEntry[]): void {
  const historyPath = getWritableHistoryPath(appName);
  if (!historyPath) return;
  const dir = path.dirname(historyPath);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const data: HistoryFile = { entries };
    fs.writeFileSync(historyPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // Best effort only: history persistence must never break command execution.
  }
}

export function appendHistory(appName: string, commandPath: string[], args: string[]): void {
  let entries: HistoryEntry[] = [];
  try {
    entries = loadHistory(appName);
  } catch {
    entries = [];
  }

  const isSame = (a: HistoryEntry) =>
    a.commandPath.join('.') === commandPath.join('.') && a.args.join(' ') === args.join(' ');

  entries = entries.filter((e) => !isSame(e));

  entries.unshift({
    commandPath,
    args,
    timestamp: new Date().toISOString(),
  });

  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(0, MAX_ENTRIES);
  }

  try {
    saveHistory(appName, entries);
  } catch {
    // Best effort only: history persistence must never break command execution.
  }
}

export function clearHistory(appName: string): void {
  const preferred = getHistoryPath(appName);
  const fallback = path.join(os.tmpdir(), 'pok-data', 'pok', appName, 'history.json');
  for (const historyPath of new Set([preferred, fallback])) {
    try {
      fs.unlinkSync(historyPath);
    } catch {
      // ignore if not found
    }
  }
}

export function formatEntryLabel(entry: HistoryEntry): string {
  const cmd = entry.commandPath.join(' ');
  if (entry.args.length > 0) {
    return `${cmd} ${entry.args.join(' ')}`;
  }
  return cmd;
}
