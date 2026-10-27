/**
 * Terminal markdown rendering on top of marked's lexer.
 *
 * Renders block and inline markdown to ANSI: paragraphs reflow and wrap to
 * the width, list items wrap with a hanging indent under their marker, code
 * blocks are indented and coloured (no syntax highlighting), tables are boxed.
 */

import { Marked, type MarkedExtension, type Renderer, type Token, type Tokens } from 'marked';
import pc from 'picocolors';

const c = pc.createColors(true);

/** Indent of lists inside their surrounding block. */
const INDENT = '  ';
/** Indent of code blocks and quotes. */
const BLOCK_INDENT = '    ';

/** Stand-in for a hard break so paragraph reflow does not swallow it. */
const HARD_BREAK = '\u0000';

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

/** Soft line breaks become spaces; hard breaks stay. */
function reflow(text: string): string {
  return text.replace(/\n/g, ' ').split(HARD_BREAK).join('\n');
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function unescape(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m]!);
}

function prefixLines(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => (line ? prefix + line : ''))
    .join('\n');
}

type TableGlyphs = { h: string; v: string; corners: string };

// Corners in reading order: top, middle, bottom rows; left, inner, right.
const UNICODE_TABLE: TableGlyphs = { h: '─', v: '│', corners: '┌┬┐├┼┤└┴┘' };
const ASCII_TABLE: TableGlyphs = { h: '-', v: '|', corners: '+++++++++' };

function renderTable(header: string[], rows: string[][], g: TableGlyphs): string {
  const widths = header.map((h, i) =>
    Math.max(visibleLength(h), ...rows.map((r) => visibleLength(r[i] ?? '')))
  );
  const pad = (cell: string, i: number) => cell + ' '.repeat(widths[i]! - visibleLength(cell));
  const rule = (at: number) =>
    c.gray(
      g.corners[at]! +
        widths.map((w) => g.h.repeat(w + 2)).join(g.corners[at + 1]) +
        g.corners[at + 2]
    );
  const row = (cells: string[]) =>
    c.gray(g.v) +
    widths.map((_, i) => ` ${pad(cells[i] ?? '', i)} `).join(c.gray(g.v)) +
    c.gray(g.v);
  return [rule(0), row(header.map((h) => c.bold(h))), rule(3), ...rows.map(row), rule(6)].join(
    '\n'
  );
}

function terminalRenderer(width: number, unicode: boolean): MarkedExtension {
  const bullet = unicode ? '•' : '-';
  // Width available to the block being rendered; lists and quotes push their own.
  const widths = [width];
  const current = () => widths.at(-1)!;
  const nested = <T>(w: number, fn: () => T): T => {
    widths.push(Math.max(w, 10));
    try {
      return fn();
    } finally {
      widths.pop();
    }
  };

  return {
    renderer: {
      space() {
        return '';
      },
      heading(this: Renderer, { tokens, depth }: Tokens.Heading) {
        const text = `${'#'.repeat(depth)} ${this.parser.parseInline(tokens)}`;
        const styled = depth === 1 ? c.magenta(c.bold(c.underline(text))) : c.green(c.bold(text));
        return styled + '\n\n';
      },
      paragraph(this: Renderer, { tokens }: Tokens.Paragraph) {
        return wrap(reflow(this.parser.parseInline(tokens)), current()).join('\n') + '\n\n';
      },
      text(this: Renderer, token: Tokens.Text | Tokens.Escape) {
        return 'tokens' in token && token.tokens
          ? this.parser.parseInline(token.tokens)
          : unescape(token.text);
      },
      strong(this: Renderer, { tokens }: Tokens.Strong) {
        return c.bold(this.parser.parseInline(tokens));
      },
      em(this: Renderer, { tokens }: Tokens.Em) {
        return c.italic(this.parser.parseInline(tokens));
      },
      del(this: Renderer, { tokens }: Tokens.Del) {
        return c.dim(c.strikethrough(this.parser.parseInline(tokens)));
      },
      codespan({ text }: Tokens.Codespan) {
        return c.yellow(unescape(text));
      },
      br() {
        return HARD_BREAK;
      },
      link(this: Renderer, { href, tokens }: Tokens.Link) {
        const text = this.parser.parseInline(tokens);
        const url = c.blue(c.underline(href));
        return text.replace(ANSI, '') === href ? url : `${c.blue(text)} (${url})`;
      },
      image({ href, text }: Tokens.Image) {
        return `${text || 'image'} (${c.blue(c.underline(href))})`;
      },
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return c.gray(text);
      },
      hr() {
        return '-'.repeat(Math.max(current() - 1, 1)) + '\n\n';
      },
      code({ text }: Tokens.Code) {
        const lines = text.replace(/\n+$/, '').split('\n').map((line) => c.yellow(line));
        return prefixLines(lines.join('\n'), BLOCK_INDENT) + '\n\n';
      },
      blockquote(this: Renderer, { tokens }: Tokens.Blockquote) {
        const inner = nested(current() - BLOCK_INDENT.length, () => this.parser.parse(tokens));
        const lines = inner.replace(/\n+$/, '').split('\n').map((l) => (l ? c.gray(c.italic(l)) : l));
        return prefixLines(lines.join('\n'), BLOCK_INDENT) + '\n\n';
      },
      table(this: Renderer, token: Tokens.Table) {
        const header = token.header.map((cell) => this.parser.parseInline(cell.tokens));
        const rows = token.rows.map((row) => row.map((cell) => this.parser.parseInline(cell.tokens)));
        return renderTable(header, rows, unicode ? UNICODE_TABLE : ASCII_TABLE) + '\n\n';
      },
      list(this: Renderer, token: Tokens.List) {
        const outer = current();
        const start = typeof token.start === 'number' ? token.start : 1;
        const items = token.items.map((item, i) => {
          const marker = token.ordered ? `${start + i}. ` : `${bullet} `;
          const blocks = nested(outer - INDENT.length - marker.length, () =>
            item.tokens.map((t: Token) =>
              t.type === 'text' || t.type === 'paragraph'
                ? wrap(
                    reflow(this.parser.parseInline('tokens' in t && t.tokens ? t.tokens : [t])),
                    current()
                  ).join('\n')
                : this.parser.parse([t]).replace(/\n+$/, '')
            )
          );
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

/** Render markdown to ANSI text wrapped at `width` columns. */
export function renderTerminalMarkdown(
  content: string,
  options: { width: number; unicode: boolean }
): string {
  return String(new Marked(terminalRenderer(options.width, options.unicode)).parse(content));
}
