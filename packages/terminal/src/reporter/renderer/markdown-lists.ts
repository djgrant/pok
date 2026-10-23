/**
 * List rendering for marked-terminal.
 *
 * marked-terminal prints a tight list item's text raw (`**bold**` stays
 * literal) and never wraps list items, so long items break mid-word at the
 * terminal edge. This extension renders lists itself: inline markdown is
 * parsed, and each item is word-wrapped to the width with a hanging indent
 * under its marker. Nested lists wrap to the space left inside their parent.
 */

import type { MarkedExtension, Renderer, Token, Tokens } from 'marked';

/** Indent of a list inside its surrounding block. */
const INDENT = '  ';

const ANSI = /\u001b\[[0-9;]*m/g;

function visibleLength(text: string): number {
  return text.replace(ANSI, '').length;
}

/** Word-wrap ANSI-styled text to `width` visible columns. */
function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      if (line && visibleLength(line) + 1 + visibleLength(word) > width) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function markdownLists(width: number, bullet: string): MarkedExtension {
  // The width available to the list being rendered; nested lists push their own.
  const widths = [width];
  return {
    renderer: {
      text(this: Renderer, token: Tokens.Text | Tokens.Escape) {
        // A tight list item's text is a block token holding inline tokens.
        return 'tokens' in token && token.tokens ? this.parser.parseInline(token.tokens) : false;
      },
      list(this: Renderer, token: Tokens.List) {
        const outer = widths.at(-1)!;
        const start = typeof token.start === 'number' ? token.start : 1;
        const items = token.items.map((item, i) => {
          const marker = token.ordered ? `${start + i}. ` : `${bullet} `;
          const inner = Math.max(outer - INDENT.length - marker.length, 10);
          widths.push(inner);
          const blocks = item.tokens.map((t: Token) =>
            t.type === 'text' || t.type === 'paragraph'
              ? wrap(this.parser.parseInline('tokens' in t && t.tokens ? t.tokens : [t]), inner).join('\n')
              : this.parser.parse([t]).replace(/\n+$/, '')
          );
          widths.pop();
          const checkbox = item.task ? (item.checked ? '[x] ' : '[ ] ') : '';
          const pad = ' '.repeat(marker.length);
          return (checkbox + blocks.join(item.loose ? '\n\n' : '\n'))
            .split('\n')
            .map((line, j) => (line ? INDENT + (j === 0 ? marker : pad) + line : ''))
            .join('\n');
        });
        return items.join(token.loose ? '\n\n' : '\n') + '\n\n';
      },
    },
  };
}
