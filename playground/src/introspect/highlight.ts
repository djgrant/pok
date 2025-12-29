/**
 * Syntax highlighting using cli-highlight.
 */

// @ts-expect-error - cli-highlight doesn't have types in playground context
import { highlight } from 'cli-highlight';
import * as path from 'node:path';

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  css: 'css',
  html: 'html',
  xml: 'xml',
  sql: 'sql',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  cpp: 'cpp',
  h: 'c',
  hpp: 'cpp',
};

/**
 * Returns syntax-highlighted content for a file.
 */
export function highlightCode(content: string, filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  const language = EXT_TO_LANGUAGE[ext];

  if (!language) {
    // Return unhighlighted for unknown extensions
    return content;
  }

  try {
    return highlight(content, {
      language,
      ignoreIllegals: true,
    });
  } catch {
    // Fallback to unhighlighted on error
    return content;
  }
}
