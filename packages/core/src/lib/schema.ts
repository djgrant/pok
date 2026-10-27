/**
 * Schema interop.
 *
 * pok accepts any schema that implements Standard Schema
 * (https://standardschema.dev). Introspection (enum choices, array fields,
 * object keys) goes through Standard JSON Schema
 * (https://standardschema.dev/json-schema) when the library provides it.
 *
 * The spec interfaces are copied in, as the spec recommends, so pok needs no
 * runtime or type dependency on any schema library.
 */

/** The Standard Schema interface. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
      options?: Options | undefined
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }

  export interface Options {
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }

  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['input'];

  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['output'];
}

/** The Standard JSON Schema interface. */
export interface StandardJSONSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardJSONSchemaV1.Props<Input, Output>;
}

export declare namespace StandardJSONSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly types?: StandardSchemaV1.Types<Input, Output> | undefined;
    readonly jsonSchema: Converter;
  }

  export interface Converter {
    readonly input: (options: Options) => Record<string, unknown>;
    readonly output: (options: Options) => Record<string, unknown>;
  }

  export type Target = 'draft-2020-12' | 'draft-07' | 'openapi-3.0' | ({} & string);

  export interface Options {
    readonly target: Target;
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
}

/** Output type of a schema. */
export type InferOutput<S extends StandardSchemaV1> = StandardSchemaV1.InferOutput<S>;

/** Input type of a schema. */
export type InferInput<S extends StandardSchemaV1> = StandardSchemaV1.InferInput<S>;

// =============================================================================
// Validation
// =============================================================================

/** Thrown when a value fails schema validation. */
export class SchemaError extends Error {
  readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;

  constructor(issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    super(formatIssues(issues));
    this.name = 'SchemaError';
    this.issues = issues;
  }
}

function pathKey(segment: PropertyKey | StandardSchemaV1.PathSegment): PropertyKey {
  return typeof segment === 'object' ? segment.key : segment;
}

/** Dot-joined issue path, e.g. `colors.success`. Empty for root issues. */
export function issuePath(issue: StandardSchemaV1.Issue): string {
  return (issue.path ?? []).map((s) => String(pathKey(s))).join('.');
}

function formatIssues(issues: ReadonlyArray<StandardSchemaV1.Issue>): string {
  return issues
    .map((issue) => {
      const p = issuePath(issue);
      return p ? `${p}: ${issue.message}` : issue.message;
    })
    .join('\n');
}

/**
 * Validate synchronously.
 *
 * pok parses argv synchronously, so a schema whose validate() returns a
 * Promise (async refinements and the like) is rejected.
 */
export function validateSync<S extends StandardSchemaV1>(
  schema: S,
  value: unknown
): StandardSchemaV1.Result<InferOutput<S>> {
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise) {
    throw new TypeError(
      `pok requires synchronous schemas, but a ${schema['~standard'].vendor} schema returned a Promise from validate()`
    );
  }
  return result as StandardSchemaV1.Result<InferOutput<S>>;
}

/** Validate synchronously and return the output, throwing SchemaError on failure. */
export function parseSync<S extends StandardSchemaV1>(schema: S, value: unknown): InferOutput<S> {
  const result = validateSync(schema, value);
  if (result.issues) throw new SchemaError(result.issues);
  return result.value;
}

/** True for values that implement Standard Schema. */
export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false;
  const props = (value as { '~standard'?: { validate?: unknown } })['~standard'];
  return typeof props === 'object' && props !== null && typeof props.validate === 'function';
}

// =============================================================================
// Introspection (Standard JSON Schema)
// =============================================================================

type JsonNode = Record<string, unknown>;

const jsonCache = {
  input: new WeakMap<object, JsonNode | null>(),
  output: new WeakMap<object, JsonNode | null>(),
};

/**
 * JSON Schema for a schema's input or output side, or undefined when the
 * library does not implement Standard JSON Schema or cannot represent it.
 */
export function toJsonSchema(
  schema: StandardSchemaV1,
  io: 'input' | 'output' = 'input'
): JsonNode | undefined {
  const cache = jsonCache[io];
  const cached = cache.get(schema);
  if (cached !== undefined) return cached ?? undefined;

  let json: JsonNode | null = null;
  const converter = (schema['~standard'] as Partial<StandardJSONSchemaV1.Props>).jsonSchema;
  if (converter && typeof converter[io] === 'function') {
    try {
      json = converter[io]({ target: 'draft-2020-12' });
    } catch {
      // Libraries throw for types JSON Schema cannot express; treat as opaque.
      json = null;
    }
  }
  cache.set(schema, json);
  return json ?? undefined;
}

function isNode(value: unknown): value is JsonNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNullNode(node: unknown): boolean {
  return isNode(node) && (node.type === 'null' || (Array.isArray(node.enum) && node.enum.length === 1 && node.enum[0] === null));
}

/** anyOf/oneOf alternatives with `null` branches removed (nullable wrappers). */
function alternatives(node: JsonNode): unknown[] | undefined {
  const alts = node.anyOf ?? node.oneOf;
  return Array.isArray(alts) ? alts.filter((a) => !isNullNode(a)) : undefined;
}

function stringChoices(node: unknown): string[] | undefined {
  if (!isNode(node)) return undefined;

  if (Array.isArray(node.enum)) {
    const values = node.enum.filter((v) => v !== null);
    return values.length > 0 && values.every((v) => typeof v === 'string')
      ? (values as string[])
      : undefined;
  }

  if ('const' in node) {
    return typeof node.const === 'string' ? [node.const] : undefined;
  }

  const alts = alternatives(node);
  if (alts && alts.length > 0) {
    const out: string[] = [];
    for (const alt of alts) {
      const choices = stringChoices(alt);
      if (!choices) return undefined;
      for (const c of choices) if (!out.includes(c)) out.push(c);
    }
    return out;
  }

  return undefined;
}

/** String choices of an enum-like schema (enum, literal union), if any. */
export function schemaChoices(schema: StandardSchemaV1): string[] | undefined {
  return stringChoices(toJsonSchema(schema));
}

function isArrayNode(node: unknown): boolean {
  if (!isNode(node)) return false;
  if (node.type === 'array') return true;
  if (Array.isArray(node.type)) return node.type.includes('array');
  const alts = alternatives(node);
  return !!alts && alts.length > 0 && alts.every(isArrayNode);
}

/** True when the schema accepts an array (repeatable flags, variadic args). */
export function isArraySchema(schema: StandardSchemaV1): boolean {
  return isArrayNode(toJsonSchema(schema));
}

/**
 * Declared property order of an object schema, or of the element of an
 * array-of-objects schema. Null when unknown.
 */
export function schemaObjectKeys(
  schema: StandardSchemaV1,
  io: 'input' | 'output' = 'output'
): string[] | null {
  const json = toJsonSchema(schema, io);
  if (!json) return null;
  const target = isArrayNode(json) && isNode(json.items) ? json.items : json;
  return isNode(target.properties) ? Object.keys(target.properties) : null;
}

// =============================================================================
// Built-in schemas
// =============================================================================

type JsonSchemaFactory = () => Record<string, unknown>;

/**
 * Build a Standard Schema from a sync validation function. Used for pok's own
 * schemas so core does not depend on a schema library.
 */
export function createSchema<Input, Output = Input>(
  validate: (value: unknown) => StandardSchemaV1.Result<Output>,
  jsonSchema?: JsonSchemaFactory
): StandardSchemaV1<Input, Output> & Partial<StandardJSONSchemaV1<Input, Output>> {
  const props: StandardSchemaV1.Props<Input, Output> & {
    jsonSchema?: StandardJSONSchemaV1.Converter;
  } = {
    version: 1,
    vendor: 'pok',
    validate,
  };
  if (jsonSchema) {
    props.jsonSchema = {
      input: () => ({ $schema: 'https://json-schema.org/draft/2020-12/schema', ...jsonSchema() }),
      output: () => ({ $schema: 'https://json-schema.org/draft/2020-12/schema', ...jsonSchema() }),
    };
  }
  return { '~standard': props } as StandardSchemaV1<Input, Output> &
    Partial<StandardJSONSchemaV1<Input, Output>>;
}

/** Boolean with a default, for flags like `--dry-run`. */
export function booleanSchema(
  defaultValue: boolean
): StandardSchemaV1<boolean | undefined, boolean> {
  return createSchema<boolean | undefined, boolean>(
    (value) => {
      if (value === undefined) return { value: defaultValue };
      if (typeof value === 'boolean') return { value };
      return { issues: [{ message: 'Expected boolean' }] };
    },
    () => ({ type: 'boolean', default: defaultValue })
  );
}

/** Any object, passed through unchanged. */
export function objectSchema<T extends Record<string, unknown> = Record<string, unknown>>(): StandardSchemaV1<T> {
  return createSchema<T>(
    (value) =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? { value: value as T }
        : { issues: [{ message: 'Expected object' }] },
    () => ({ type: 'object' })
  );
}
