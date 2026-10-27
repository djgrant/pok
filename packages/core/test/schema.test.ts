import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import {
  validateSync,
  parseSync,
  SchemaError,
  isArraySchema,
  schemaChoices,
  schemaObjectKeys,
  type StandardSchemaV1,
} from '../src/lib/schema';
import { getSchemaInfo, parseContext, extractChoices } from '../src/lib/args';
import { formatTable } from '../src/lib/tabular';

/** A minimal non-zod Standard Schema, optionally with Standard JSON Schema. */
function custom<T>(
  check: (v: unknown) => v is T,
  json?: Record<string, unknown>
): StandardSchemaV1<T> {
  const props: Record<string, unknown> = {
    version: 1,
    vendor: 'custom',
    validate: (value: unknown) =>
      check(value) ? { value } : { issues: [{ message: 'Invalid value' }] },
  };
  if (json) props.jsonSchema = { input: () => json, output: () => json };
  return { '~standard': props } as unknown as StandardSchemaV1<T>;
}

const isMode = (v: unknown): v is 'a' | 'b' => v === 'a' || v === 'b';

describe('validateSync', () => {
  it('rejects schemas that validate asynchronously', () => {
    const schema = z.string().refine(async () => true);
    expect(() => validateSync(schema, 'x')).toThrow(/synchronous/);
  });

  it('parseSync throws SchemaError with issues and paths', () => {
    const schema = z.object({ env: z.enum(['dev']) });
    try {
      parseSync(schema, { env: 'prod' });
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaError);
      expect((error as SchemaError).issues.length).toBeGreaterThan(0);
      expect((error as SchemaError).message).toStartWith('env: ');
    }
  });
});

describe('introspection via Standard JSON Schema', () => {
  it('reads choices from a non-zod schema', () => {
    const schema = custom(isMode, { type: 'string', enum: ['a', 'b'] });
    expect(schemaChoices(schema)).toEqual(['a', 'b']);
    expect(getSchemaInfo(schema)).toEqual({
      type: 'enum',
      choices: ['a', 'b'],
      default: undefined,
      isOptional: false,
    });
  });

  it('reads choices from a nullable literal union', () => {
    expect(schemaChoices(z.literal('x').or(z.literal('y')).nullable())).toEqual(['x', 'y']);
  });

  it('detects arrays', () => {
    expect(isArraySchema(z.array(z.string()).default([]))).toBe(true);
    expect(isArraySchema(z.string())).toBe(false);
    const arr = custom((v): v is string[] => Array.isArray(v), {
      type: 'array',
      items: { type: 'string' },
    });
    expect(isArraySchema(arr)).toBe(true);
  });

  it('reads object keys in declared order', () => {
    const row = z.object({ id: z.string(), title: z.string() });
    expect(schemaObjectKeys(z.array(row))).toEqual(['id', 'title']);
    expect(formatTable([{ title: 'T', id: '1' }], z.array(row))).toStartWith('id');
  });
});

describe('schemas without Standard JSON Schema', () => {
  const schema = custom(isMode);

  it('still validates flags', () => {
    const def = { mode: { from: 'flag' as const, schema } };
    expect(parseContext(['--mode', 'a'], def).context.mode).toBe('a');
    expect(() => parseContext(['--mode', 'c'], def)).toThrow(/Invalid value for --mode/);
  });

  it('has no inferred choices, but honours explicit choices', () => {
    expect(schemaChoices(schema)).toBeUndefined();
    const choices = extractChoices({ mode: { from: 'flag', schema, choices: ['a', 'b'] } });
    expect(choices.get('mode')).toEqual(['a', 'b']);
  });

  it('detects booleans and defaults by probing', () => {
    const flag = custom((v): v is boolean => typeof v === 'boolean' || v === undefined);
    expect(getSchemaInfo(flag).type).toBe('boolean');
  });
});
