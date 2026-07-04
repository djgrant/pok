/**
 * Tabular output formatters for structured command output.
 *
 * Renders a command's returned data as an aligned ASCII table (`--format table`)
 * or RFC-4180-ish CSV (`--format csv`). Both are dependency-free and operate on
 * plain JS values, with optional Zod schema introspection to derive a stable
 * column order.
 *
 * Data shapes handled:
 * - Array of flat objects  → one column per key (rows = array items)
 * - Single plain object    → two-column key/value table
 * - Everything else        → not tabulatable (formatters return `null` so the
 *                            caller can fall back to JSON)
 *
 * Nested object/array cell values are JSON-stringified.
 */

import type { z } from 'zod';

/**
 * Format a single cell value for display.
 * Strings pass through; null/undefined become empty; primitives are stringified;
 * objects and arrays are JSON-stringified.
 */
function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * Whether a value is a plain (non-array, non-null) object usable as a table row.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Best-effort extraction of an ordered key list from a Zod schema.
 * Supports object schemas (uses declared shape order) and array-of-object
 * schemas (uses the element object's shape order). Returns null when the schema
 * can't be introspected.
 */
function schemaKeys(schema: z.ZodType | undefined): string[] | null {
  if (!schema) return null;
  try {
    const anySchema = schema as any;
    // Array schema: derive columns from element object shape.
    const element = anySchema.element;
    if (element && element.shape) {
      return Object.keys(element.shape);
    }
    // Object schema: use its shape directly.
    if (anySchema.shape) {
      return Object.keys(anySchema.shape);
    }
  } catch {
    // Introspection is best-effort; fall through to data-derived order.
  }
  return null;
}

/**
 * Derive the ordered column list for an array of row objects.
 * Prefers schema key order when available, otherwise uses the union of keys in
 * first-seen order across all rows.
 */
function deriveColumns(
  rows: Record<string, unknown>[],
  schema: z.ZodType | undefined
): string[] {
  const fromSchema = schemaKeys(schema);
  if (fromSchema && fromSchema.length > 0) return fromSchema;

  const seen = new Set<string>();
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  return columns;
}

/**
 * Normalize input data into a list of row objects, if tabulatable.
 * Returns null when the data can't be represented as rows of a table.
 */
function toRows(data: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(data)) {
    // Every element must be a plain object for a columnar table.
    if (data.length > 0 && !data.every(isPlainObject)) return null;
    return data as Record<string, unknown>[];
  }
  if (isPlainObject(data)) {
    // Rendered as a key/value table by the caller.
    return null;
  }
  // Scalars / nested-but-not-object values are not tabulatable.
  return null;
}

/**
 * Render a matrix of already-stringified cells as an aligned text table.
 */
function renderMatrix(header: string[], rows: string[][]): string {
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length))
  );
  const pad = (cells: string[]) =>
    cells
      .map((c, i) => (c ?? '').padEnd(widths[i]!))
      .join('  ')
      .replace(/\s+$/, '');
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');

  return [pad(header), separator, ...rows.map(pad)].join('\n');
}

/**
 * Render command data as an aligned text table.
 *
 * @returns the table string, or `null` when the data is not tabulatable
 *   (caller should fall back to JSON). An empty array yields an empty string.
 */
export function formatTable(data: unknown, schema?: z.ZodType): string | null {
  const rows = toRows(data);

  if (rows) {
    if (rows.length === 0) {
      // Empty array: emit a header-only table if columns are known from the
      // schema, otherwise print nothing.
      const columns = schemaKeys(schema);
      if (columns && columns.length > 0) {
        return renderMatrix(columns, []);
      }
      return '';
    }
    const columns = deriveColumns(rows, schema);
    const body = rows.map((row) => columns.map((c) => formatCell(row[c])));
    return renderMatrix(columns, body);
  }

  // Single plain object → key/value table.
  if (isPlainObject(data)) {
    const columns = schemaKeys(schema) ?? Object.keys(data);
    const body = columns.map((key) => [key, formatCell(data[key])]);
    return renderMatrix(['key', 'value'], body);
  }

  return null;
}

/**
 * Escape a single CSV field per RFC 4180: wrap in double quotes and double any
 * embedded quotes when the field contains a comma, quote, CR, or LF.
 */
function escapeCsvField(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Render command data as RFC-4180-ish CSV.
 *
 * @returns the CSV string, or `null` when the data is not tabulatable
 *   (caller should fall back to JSON). An empty array yields an empty string
 *   (or a header row when columns are known from the schema).
 */
export function formatCsv(data: unknown, schema?: z.ZodType): string | null {
  const rows = toRows(data);

  if (rows) {
    if (rows.length === 0) {
      const columns = schemaKeys(schema);
      if (columns && columns.length > 0) {
        return columns.map(escapeCsvField).join(',');
      }
      return '';
    }
    const columns = deriveColumns(rows, schema);
    const lines = [columns.map(escapeCsvField).join(',')];
    for (const row of rows) {
      lines.push(columns.map((c) => escapeCsvField(formatCell(row[c]))).join(','));
    }
    return lines.join('\n');
  }

  // Single plain object → header + one row.
  if (isPlainObject(data)) {
    const columns = schemaKeys(schema) ?? Object.keys(data);
    const header = columns.map(escapeCsvField).join(',');
    const values = columns.map((c) => escapeCsvField(formatCell(data[c]))).join(',');
    return `${header}\n${values}`;
  }

  return null;
}
