import { z } from 'zod';
import type {
  ContextDef,
  ContextFieldDef,
  InferContext,
  ResolveOption,
  ResolveOptionsPage,
  ResolveOptionsResult,
} from './command';
import { isContextFieldDef } from './command';
import { withCapabilities } from '../prompter';
import type { OptionsRequest, Prompter, SelectOption } from '../prompter';
import { findClosestMatch } from './string-distance';
import { CLIError, type ErrorContext } from './cli-error';

type ResolvePrimitive = string | number | boolean;

/**
 * Options for parsing context with error context
 */
export type ParseContextOptions = {
  /** Error context for rich error messages */
  errorContext?: ErrorContext;
  /** When true, unknown flags are ignored and added to 'rest' instead of throwing */
  ignoreUnknownFlags?: boolean;
};

/**
 * Convert kebab-case to camelCase
 *
 * @example
 * kebabToCamel('dry-run') // 'dryRun'
 * kebabToCamel('no-git-checks') // 'noGitChecks'
 */
function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Parsed arguments result
 */
export type ParsedArgs<C extends ContextDef> = {
  /** Parsed context values */
  context: InferContext<C>;
  /** Remaining positional arguments */
  rest: string[];
};

/**
 * Get info about a Zod schema for flag parsing
 */
export type SchemaInfo = {
  type: 'string' | 'boolean' | 'enum';
  choices?: string[];
  default?: unknown;
  isOptional: boolean;
};

/**
 * Unwrap a Zod schema to get its core type and metadata
 *
 * Uses safeParse to probe the schema behavior rather than internal APIs.
 */
export function getSchemaInfo(schema: z.ZodType): SchemaInfo {
  // Check if it has a default by parsing undefined
  const undefinedResult = schema.safeParse(undefined);
  const hasDefault = undefinedResult.success && undefinedResult.data !== undefined;
  const defaultValue = hasDefault ? undefinedResult.data : undefined;

  // Check if optional (accepts undefined)
  const isOptional = undefinedResult.success;

  // Check if boolean by testing true/false
  const trueResult = schema.safeParse(true);
  const falseResult = schema.safeParse(false);
  const stringTrueResult = schema.safeParse('true');

  if (
    trueResult.success &&
    falseResult.success &&
    trueResult.data === true &&
    falseResult.data === false &&
    !stringTrueResult.success
  ) {
    return {
      type: 'boolean',
      default: defaultValue,
      isOptional: isOptional || hasDefault,
    };
  }

  // Check for enum by testing a few known patterns
  // Try to get choices by testing various strings
  const choices = extractEnumChoices(schema);
  if (choices) {
    return {
      type: 'enum',
      choices,
      default: defaultValue,
      isOptional: isOptional || hasDefault,
    };
  }

  // Default to string type
  return {
    type: 'string',
    default: defaultValue,
    isOptional: isOptional || hasDefault,
  };
}

/**
 * Wrapper type names that should be unwrapped when extracting enum values
 * Supports both Zod v3 (typeName) and Zod v4 (type) formats
 */
const WRAPPER_TYPE_NAMES_V3 = [
  'ZodOptional',
  'ZodDefault',
  'ZodNullable',
  'ZodBranded',
  'ZodReadonly',
  'ZodCatch',
] as const;

const WRAPPER_TYPE_NAMES_V4 = ['optional', 'default', 'nullable', 'readonly', 'catch'] as const;

/**
 * Unwrap a Zod schema to get its core type
 *
 * Removes wrapper types (optional, default, nullable, branded, readonly, catch)
 * to expose the underlying schema type.
 * Supports both Zod v3 and Zod v4.
 */
export function unwrapSchema(schema: z.ZodType): z.ZodType {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def;
  if (!def) return schema;

  // Zod v3 uses `typeName`, Zod v4 uses `type`
  const typeName = def.typeName || def.type;

  // Check if this is a wrapper type that should be unwrapped
  const isWrapperV3 = WRAPPER_TYPE_NAMES_V3.includes(typeName);
  const isWrapperV4 = WRAPPER_TYPE_NAMES_V4.includes(typeName);

  if ((isWrapperV3 || isWrapperV4) && def.innerType) {
    return unwrapSchema(def.innerType);
  }

  return schema;
}

/**
 * Try to extract enum choices from a schema
 *
 * Uses Zod's internal _def structure to get exact enum values.
 * Supports both Zod v3 and Zod v4.
 * Supports:
 * - z.enum(['a', 'b', 'c'])
 * - z.nativeEnum(SomeEnum)
 * - z.literal('a').or(z.literal('b'))
 * - Wrapped versions (optional, default, nullable, etc.)
 */
export function extractEnumChoices(schema: z.ZodType): string[] | undefined {
  const unwrapped = unwrapSchema(schema);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unwrappedAny = unwrapped as any;
  const def = unwrappedAny._def;
  if (!def) return undefined;

  // Zod v3 uses `typeName`, Zod v4 uses `type`
  const typeName = def.typeName || def.type;

  // Zod v4: Check for `.options` property directly on the schema (enum)
  // Enum's options are string values, union's options are ZodType objects
  if (
    Array.isArray(unwrappedAny.options) &&
    unwrappedAny.options.length > 0 &&
    typeof unwrappedAny.options[0] === 'string'
  ) {
    return unwrappedAny.options as string[];
  }

  // Zod v3/v4: Check for ZodEnum: z.enum(['a', 'b', 'c'])
  if ((typeName === 'ZodEnum' || typeName === 'enum') && Array.isArray(def.values)) {
    return def.values as string[];
  }

  // Zod v4: Check for entries (enum as object)
  if (typeName === 'enum' && def.entries && typeof def.entries === 'object') {
    return Object.values(def.entries).filter((v): v is string => typeof v === 'string');
  }

  // Zod v3/v4: Check for ZodNativeEnum: z.nativeEnum(SomeEnum)
  if ((typeName === 'ZodNativeEnum' || typeName === 'nativeEnum') && def.values) {
    return Object.values(def.values).filter((v): v is string => typeof v === 'string');
  }

  // Zod v3/v4: Check for ZodUnion of literals: z.literal('a').or(z.literal('b'))
  const isUnion = typeName === 'ZodUnion' || typeName === 'union';
  if (isUnion && Array.isArray(def.options)) {
    const literals = extractLiteralsFromUnion(def.options);
    if (literals && literals.length > 0) {
      return literals;
    }
  }

  return undefined;
}

/**
 * Recursively extract string literal values from union options.
 * Handles nested unions like z.literal('a').or(z.literal('b')).or(z.literal('c'))
 */
function extractLiteralsFromUnion(options: z.ZodType[]): string[] | undefined {
  const literals: string[] = [];

  for (const option of options) {
    // Unwrap each option in case it's wrapped
    const unwrappedOption = unwrapSchema(option);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unwrappedOptionAny = unwrappedOption as any;
    const optDef = unwrappedOptionAny._def;
    const optTypeName = optDef?.typeName || optDef?.type;

    const isLiteral = optTypeName === 'ZodLiteral' || optTypeName === 'literal';
    const isNestedUnion = optTypeName === 'ZodUnion' || optTypeName === 'union';

    if (isLiteral) {
      // Zod v3 uses _def.value, Zod v4 uses _def.values[0] or schema.value
      let literalValue: unknown;
      if (typeof optDef.value === 'string') {
        // Zod v3
        literalValue = optDef.value;
      } else if (Array.isArray(optDef.values) && optDef.values.length === 1) {
        // Zod v4: _def.values is an array
        literalValue = optDef.values[0];
      } else if (typeof unwrappedOptionAny.value === 'string') {
        // Zod v4: direct property on schema
        literalValue = unwrappedOptionAny.value;
      }

      if (typeof literalValue === 'string') {
        literals.push(literalValue);
      } else {
        // Non-string literal in union
        return undefined;
      }
    } else if (isNestedUnion && Array.isArray(optDef.options)) {
      // Recursively extract from nested union
      const nestedLiterals = extractLiteralsFromUnion(optDef.options);
      if (nestedLiterals === undefined) {
        return undefined;
      }
      literals.push(...nestedLiterals);
    } else {
      // If any option is not a literal or nested union, return undefined
      // (can't extract reliable choices from mixed unions)
      return undefined;
    }
  }

  return literals;
}

/**
 * Extract enum choices directly from Zod schema internal structure
 *
 * @deprecated Use extractEnumChoices instead, which handles more schema types.
 * This function is kept for backwards compatibility.
 */
export function getEnumChoicesFromSchema(schema: z.ZodType): string[] | undefined {
  return extractEnumChoices(schema);
}

/**
 * Convert camelCase to kebab-case for CLI flags
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Normalize a user-provided flag name/alias.
 */
function normalizeFlagName(raw: string): string {
  const stripped = raw.replace(/^--/, '');
  return kebabToCamel(stripped);
}

/**
 * Create an error - CLIError if errorContext is provided, otherwise regular Error
 */
function createError(message: string, contextDef: ContextDef, errorContext?: ErrorContext): Error {
  if (errorContext) {
    return new CLIError(message, { ...errorContext, contextDef });
  }
  return new Error(message);
}

/**
 * Parse command line arguments against context definitions
 *
 * Supports:
 * - --flag=value (string/enum flags with equals)
 * - --flag value (string/enum flags with space)
 * - --flag (boolean flags, sets to true)
 * - --no-flag (boolean flags, sets to false)
 *
 * @param args - Raw command line arguments
 * @param contextDef - Context field definitions
 * @param options - Optional parsing options including error context
 * @returns Parsed context and remaining positional arguments
 */
export function parseContext<C extends ContextDef>(
  args: string[],
  contextDef: C,
  options?: ParseContextOptions
): ParsedArgs<C> {
  const context: Record<string, unknown> = {};
  const rest: string[] = [];
  const errorContext = options?.errorContext;

  // Build schema info cache and known flag names for typo detection
  const schemaInfoCache = new Map<string, SchemaInfo>();
  const knownFlags: string[] = [];
  const flagToField = new Map<string, string>();
  const explicitlySetValues = new Map<string, { value: unknown; sourceFlag: string }>();

  const registerFlagName = (ownerField: string, candidate: string): void => {
    const normalized = normalizeFlagName(candidate);
    if (!normalized) {
      throw createError(
        `Invalid empty flag alias on context field "${ownerField}"`,
        contextDef,
        errorContext
      );
    }

    const existingOwner = flagToField.get(normalized);
    if (existingOwner && existingOwner !== ownerField) {
      const display = camelToKebab(normalized);
      throw createError(
        `Flag alias --${display} conflicts between context fields "${existingOwner}" and "${ownerField}"`,
        contextDef,
        errorContext
      );
    }
    flagToField.set(normalized, ownerField);

    // Track both canonical forms for typo suggestions
    knownFlags.push(normalized);
    const kebabName = camelToKebab(normalized);
    if (kebabName !== normalized) {
      knownFlags.push(kebabName);
    }
  };

  const setExplicitValue = (fieldName: string, value: unknown, rawFlagName: string): void => {
    const existing = explicitlySetValues.get(fieldName);
    if (!existing) {
      explicitlySetValues.set(fieldName, { value, sourceFlag: rawFlagName });
      context[fieldName] = value;
      return;
    }

    if (Object.is(existing.value, value)) {
      return;
    }

    throw createError(
      `Conflicting values for --${camelToKebab(fieldName)} provided by --${existing.sourceFlag} and --${rawFlagName}`,
      contextDef,
      errorContext
    );
  };

  for (const [name, fieldDef] of Object.entries(contextDef)) {
    // Skip static values
    if (!isContextFieldDef(fieldDef)) {
      context[name] = fieldDef;
      continue;
    }

    const info = getSchemaInfo(fieldDef.schema);
    schemaInfoCache.set(name, info);
    registerFlagName(name, name);
    registerFlagName(name, camelToKebab(name));
    for (const alias of fieldDef.aliases ?? []) {
      registerFlagName(name, alias);
    }

    // Initialize with defaults
    if (info.default !== undefined) {
      context[name] = info.default;
    } else if (info.type === 'boolean') {
      context[name] = false;
    }
  }

  // Parse arguments
  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (!arg) {
      i++;
      continue;
    }

    // Check for --flag or --no-flag
    if (arg.startsWith('--')) {
      const isNegated = arg.startsWith('--no-');
      const flagPart = isNegated ? arg.slice(5) : arg.slice(2);

      // Support --flag=value syntax
      let rawFlagName: string;
      let inlineValue: string | undefined;
      const equalsIndex = flagPart.indexOf('=');

      if (equalsIndex !== -1) {
        rawFlagName = flagPart.slice(0, equalsIndex);
        inlineValue = flagPart.slice(equalsIndex + 1);
      } else {
        rawFlagName = flagPart;
      }

      // Support both kebab-case and camelCase names + aliases
      const normalizedFlagName = normalizeFlagName(rawFlagName);
      const fieldName = flagToField.get(normalizedFlagName);
      const fieldDef = fieldName
        ? contextDef[fieldName]
        : (contextDef[normalizedFlagName] as C[keyof C] | undefined);

      if (!fieldDef || !isContextFieldDef(fieldDef)) {
        if (options?.ignoreUnknownFlags) {
          rest.push(arg);
          i++;
          continue;
        }

        // Better error message if it's a static context value
        if (fieldDef !== undefined) {
          throw createError(
            `Cannot use --${rawFlagName} as a flag because it is a static context value`,
            contextDef,
            errorContext
          );
        }

        // Try to find a close match for typo detection
        const suggestion = findClosestMatch(rawFlagName, knownFlags);
        let errorMessage = `Unknown flag: ${arg}`;
        if (suggestion) {
          errorMessage += `\n\nDid you mean --${suggestion}?`;
        }
        throw createError(errorMessage, contextDef, errorContext);
      }

      const resolvedFieldName = fieldName ?? normalizedFlagName;
      const info = schemaInfoCache.get(resolvedFieldName)!;

      if (info.type === 'boolean') {
        // Boolean flags don't accept inline values
        if (inlineValue !== undefined) {
          const displayName = camelToKebab(resolvedFieldName);
          throw createError(
            `Boolean flag --${displayName} does not accept a value. Use --${displayName} or --no-${displayName}`,
            contextDef,
            errorContext
          );
        }
        setExplicitValue(resolvedFieldName, !isNegated, rawFlagName);
        i++;
      } else {
        // String/enum flag - use inline value (--flag=value) or next arg (--flag value)
        let value: string | undefined;
        let advance: number;

        if (inlineValue !== undefined) {
          value = inlineValue;
          advance = 1;
        } else {
          value = args[i + 1];
          advance = 2;
        }

        if (value === undefined || (inlineValue === undefined && value.startsWith('--'))) {
          throw createError(
            `Flag --${camelToKebab(resolvedFieldName)} requires a value`,
            contextDef,
            errorContext
          );
        }

        // Validate the value against the schema
        const result = fieldDef.schema.safeParse(value);
        if (!result.success) {
          const choicesMsg = info.choices ? ` Valid: ${info.choices.join(', ')}` : '';
          throw createError(
            `Invalid value for --${camelToKebab(resolvedFieldName)}: ${value}.${choicesMsg}`,
            contextDef,
            errorContext
          );
        }

        setExplicitValue(resolvedFieldName, result.data, rawFlagName);
        i += advance;
      }
    } else {
      // Positional argument
      rest.push(arg);
      i++;
    }
  }

  return { context: context as InferContext<C>, rest };
}

function isOptionsPage(value: unknown): value is ResolveOptionsPage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'options' in value &&
    Array.isArray((value as ResolveOptionsPage).options)
  );
}

function isResolvePrimitive(value: unknown): value is ResolvePrimitive {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isResolveOptionObject(value: unknown): value is Exclude<ResolveOption, ResolvePrimitive> {
  if (typeof value !== 'object' || value === null || !('value' in value)) {
    return false;
  }

  const option = value as { value: unknown; label?: unknown };
  return (
    isResolvePrimitive(option.value) &&
    (option.label === undefined || typeof option.label === 'string')
  );
}

function normalizeOptionValue(value: unknown): SelectOption<ResolvePrimitive> {
  if (isResolvePrimitive(value)) {
    return { value, label: String(value) };
  }
  if (isResolveOptionObject(value)) {
    return { value: value.value, label: value.label ?? String(value.value) };
  }
  throw new Error(
    'Context resolve() must return primitive options or { value, label } option objects'
  );
}

function normalizeOptionsResult(
  value: ResolveOptionsResult
): {
  options: SelectOption<ResolvePrimitive>[];
  nextCursor?: string | null;
  totalCount?: number;
} {
  if (Array.isArray(value)) {
    return {
      options: value.map((option) => normalizeOptionValue(option)),
    };
  }

  return {
    ...value,
    options: value.options.map((option) => normalizeOptionValue(option)),
  };
}

function isAsyncIterable<T>(value: unknown): value is AsyncIterable<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Symbol.asyncIterator in (value as Record<PropertyKey, unknown>)
  );
}

function isArraySchema(schema: z.ZodType): boolean {
  const unwrapped = unwrapSchema(schema);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (unwrapped as any)._def;
  const typeName = def?.typeName || def?.type;
  return typeName === 'ZodArray' || typeName === 'array';
}

async function loadOptionsFromAsyncIterable(
  iterator: AsyncIterable<ResolveOptionsResult>
): Promise<SelectOption<ResolvePrimitive>[]> {
  const options: SelectOption<ResolvePrimitive>[] = [];
  for await (const pageResult of iterator) {
    const page = normalizeOptionsResult(pageResult);
    options.push(...page.options);
  }
  return options;
}

async function loadAllResolvedOptions(
  resolve: NonNullable<ContextFieldDef['resolve']>,
  context: Record<string, unknown>
): Promise<SelectOption<ResolvePrimitive>[]> {
  const controller = new AbortController();
  const request: OptionsRequest = { signal: controller.signal };
  const result = await resolve(request, context);

  if (
    isAsyncIterable<
      | ResolveOptionsResult
    >(result)
  ) {
    return loadOptionsFromAsyncIterable(result);
  }

  if (Array.isArray(result) || isOptionsPage(result)) {
    const firstPage = normalizeOptionsResult(result);
    const options = [...firstPage.options];
    let nextCursor = firstPage.nextCursor ?? null;
    const seenCursors = new Set<string>();

    while (nextCursor) {
      if (seenCursors.has(nextCursor)) {
        throw new Error(`Context resolve() returned repeated cursor "${nextCursor}"`);
      }
      seenCursors.add(nextCursor);
      const next = await resolve({ signal: controller.signal, cursor: nextCursor }, context);
      if (!(Array.isArray(next) || isOptionsPage(next))) {
        throw new Error('Context resolve() returned invalid paginated result');
      }
      const nextPage = normalizeOptionsResult(next);
      options.push(...nextPage.options);
      nextCursor = nextPage.nextCursor ?? null;
    }

    return options;
  }

  throw new Error(
    'Context resolve() must return options, an options page, or an async iterator'
  );
}

type DynamicResolveProviderSetup = {
  provider: ReturnType<typeof withCapabilities<ResolvePrimitive>>;
  initialPage: {
    options: SelectOption<ResolvePrimitive>[];
    nextCursor?: string | null;
    totalCount?: number;
  };
};

async function createDynamicResolveProvider(
  resolve: NonNullable<ContextFieldDef['resolve']>,
  context: Record<string, unknown>
): Promise<DynamicResolveProviderSetup> {
  const controller = new AbortController();
  const firstRequest: OptionsRequest = { signal: controller.signal };
  const firstResult = await resolve(firstRequest, context);
  if (isAsyncIterable<ResolveOptionsResult>(firstResult)) {
    throw new Error('ASYNC_ITERABLE_RESOLVE_NOT_SUPPORTED_FOR_DYNAMIC_PROVIDER');
  }
  if (!(Array.isArray(firstResult) || isOptionsPage(firstResult))) {
    throw new Error('Context resolve() must return options, an options page, or an async iterator');
  }

  const initialPage = normalizeOptionsResult(firstResult);

  const provider = withCapabilities<ResolvePrimitive>(
    async (request) => {
      if (!request.cursor && !request.filter) {
        return initialPage;
      }
      const result = await resolve(request, context);
      if (isAsyncIterable<ResolveOptionsResult>(result)) {
        throw new Error(
          'Async iterator resolve() is not supported for filtered/paginated provider requests'
        );
      }
      if (!(Array.isArray(result) || isOptionsPage(result))) {
        throw new Error('Context resolve() returned invalid paginated result');
      }
      const normalized = normalizeOptionsResult(result);
      if (request.cursor && normalized.nextCursor === request.cursor) {
        throw new Error(`Context resolve() returned repeated cursor "${request.cursor}"`);
      }
      return normalized;
    },
    { supportsFilter: true }
  );

  return { provider, initialPage };
}

function getResolutionOrder(contextDef: ContextDef): string[] {
  const allKeys = new Set(Object.keys(contextDef));
  const state = new Map<string, 'visiting' | 'visited'>();
  const ordered: string[] = [];

  const visit = (key: string, stack: string[]): void => {
    const current = state.get(key);
    if (current === 'visited') return;
    if (current === 'visiting') {
      const cycle = [...stack, key].join(' -> ');
      throw new Error(`Circular dependsOn in context: ${cycle}`);
    }

    state.set(key, 'visiting');
    const fieldDef = contextDef[key];
    if (isContextFieldDef(fieldDef) && fieldDef.dependsOn) {
      for (const dep of fieldDef.dependsOn) {
        if (!allKeys.has(dep)) {
          throw new Error(`Unknown dependsOn "${dep}" for context field "${key}"`);
        }
        visit(dep, [...stack, key]);
      }
    }
    state.set(key, 'visited');
    ordered.push(key);
  };

  for (const key of allKeys) {
    visit(key, []);
  }

  return ordered;
}

/**
 * Resolve context interactively
 *
 * Behavior depends on invocation context:
 * - fromMenu=true: Prompt for ALL context fields, using defaults as initial values
 * - fromMenu=false: Only prompt for required fields that are missing
 *
 * @param context - Currently parsed context
 * @param contextDef - Context field definitions
 * @param choices - Pre-computed choices for enum fields
 * @param prompts - TTY prompts adapter for user interaction
 * @param fromMenu - Whether the command was invoked from the interactive menu
 * @param allowPrompt - Whether prompting is allowed
 * @returns Context with values resolved
 */
export async function resolveInteractiveContext<C extends ContextDef>(
  context: InferContext<C>,
  contextDef: C,
  choices: Map<string, string[]>,
  prompter: Prompter,
  fromMenu: boolean = false,
  allowPrompt: boolean = true
): Promise<InferContext<C>> {
  const resolved = { ...context };

  if (!allowPrompt) {
    return resolved;
  }

  const orderedKeys = getResolutionOrder(contextDef);
  for (const name of orderedKeys) {
    const fieldDef = contextDef[name];
    // Skip static values
    if (!isContextFieldDef(fieldDef)) {
      continue;
    }

    const currentValue = resolved[name as keyof typeof resolved];
    const info = getSchemaInfo(fieldDef.schema);
    const fieldChoices = choices.get(name);

    // Determine if we should prompt for this field
    let shouldPrompt = false;

    if (fromMenu) {
      // From menu: prompt for ALL fields
      shouldPrompt = true;
    } else if (!info.isOptional) {
      // Direct invocation: only prompt for required fields that are missing
      const isMissing = currentValue === undefined || currentValue === '';
      shouldPrompt = isMissing;
    }

    if (shouldPrompt) {
      if (fieldDef.resolve) {
        if (isArraySchema(fieldDef.schema)) {
          const dynamicOptions = await loadAllResolvedOptions(
            fieldDef.resolve,
            resolved as Record<string, unknown>
          );
          if (dynamicOptions.length === 0) {
            throw new Error(`No options available for --${name}`);
          }

          const selected = await prompter.multiselect({
            message: fieldDef.description || `Select ${name}:`,
            options: dynamicOptions,
            initialValues:
              Array.isArray(currentValue) && currentValue.every((v) => isResolvePrimitive(v))
                ? currentValue
                : undefined,
            required: !info.isOptional,
          });
          const parsed = fieldDef.schema.safeParse(selected);
          if (!parsed.success) {
            throw new Error(`Invalid selected value for --${name}`);
          }
          (resolved as Record<string, unknown>)[name] = parsed.data;
        } else {
          const initialValue = isResolvePrimitive(currentValue)
            ? currentValue
            : isResolvePrimitive(info.default)
              ? info.default
              : undefined;
          let selected: ResolvePrimitive;
          try {
            const { provider, initialPage } = await createDynamicResolveProvider(
              fieldDef.resolve,
              resolved as Record<string, unknown>
            );
            if (initialPage.options.length === 0 && !initialPage.nextCursor) {
              throw new Error(`No options available for --${name}`);
            }
            selected = await prompter.select({
              message: fieldDef.description || `Select ${name}:`,
              provider,
              initialValue,
            });
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === 'ASYNC_ITERABLE_RESOLVE_NOT_SUPPORTED_FOR_DYNAMIC_PROVIDER'
            ) {
              const dynamicOptions = await loadAllResolvedOptions(
                fieldDef.resolve,
                resolved as Record<string, unknown>
              );
              if (dynamicOptions.length === 0) {
                throw new Error(`No options available for --${name}`);
              }
              selected = await prompter.select({
                message: fieldDef.description || `Select ${name}:`,
                options: dynamicOptions,
                initialValue,
              });
            } else {
              throw error;
            }
          }
          const parsed = fieldDef.schema.safeParse(selected);
          if (!parsed.success) {
            throw new Error(`Invalid selected value for --${name}`);
          }
          (resolved as Record<string, unknown>)[name] = parsed.data;
        }
      } else if (fieldChoices && fieldChoices.length > 0) {
        // Select from choices, pre-select current/default value
        const initialValue =
          currentValue !== undefined
            ? String(currentValue)
            : info.default !== undefined
              ? String(info.default)
              : undefined;
        const selected = await prompter.select({
          message: fieldDef.description || `Select ${name}:`,
          options: fieldChoices.map((c) => ({ value: c, label: c })),
          initialValue,
        });
        (resolved as Record<string, unknown>)[name] = selected;
      } else if (info.type === 'boolean') {
        // Confirm with current/default value pre-selected
        const initialValue =
          currentValue !== undefined
            ? Boolean(currentValue)
            : info.default !== undefined
              ? Boolean(info.default)
              : undefined;
        const confirmed = await prompter.confirm({
          message: fieldDef.description || `Enable ${name}?`,
          initialValue,
        });
        (resolved as Record<string, unknown>)[name] = confirmed;
      } else {
        // Text input with current/default as initial value
        const initialValue =
          currentValue !== undefined
            ? String(currentValue)
            : info.default !== undefined
              ? String(info.default)
              : undefined;
        const text = await prompter.text({
          message: fieldDef.description || `Enter ${name}:`,
          initialValue,
        });
        (resolved as Record<string, unknown>)[name] = text;
      }
    }
  }

  return resolved;
}

/**
 * Options for validating context
 */
export type ValidateContextOptions = {
  /** Error context for rich error messages */
  errorContext?: ErrorContext;
};

/**
 * Validate that all required context fields have values
 *
 * @param context - Parsed context values
 * @param contextDef - Context field definitions
 * @param options - Optional validation options including error context
 * @throws Error if a required field is missing
 */
export function validateRequiredContext<C extends ContextDef>(
  context: InferContext<C>,
  contextDef: C,
  options?: ValidateContextOptions
): void {
  const errorContext = options?.errorContext;

  for (const [name, fieldDef] of Object.entries(contextDef)) {
    // Skip static values
    if (!isContextFieldDef(fieldDef)) {
      continue;
    }

    const info = getSchemaInfo(fieldDef.schema);
    if (!info.isOptional) {
      const value = context[name as keyof typeof context];
      if (value === undefined || value === '') {
        throw createError(`Required flag --${name} is missing`, contextDef, errorContext);
      }
    }
  }
}

/**
 * Extract choices from context field definitions
 *
 * This is used during command loading to extract enum choices
 * before interactive prompting.
 *
 * Priority:
 * 1. Explicit `choices` field in the context definition (escape hatch)
 * 2. Auto-extraction from Zod schema internals
 */
export function extractChoices<C extends ContextDef>(contextDef: C): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const [name, fieldDef] of Object.entries(contextDef)) {
    // Skip static values
    if (!isContextFieldDef(fieldDef)) {
      continue;
    }

    // Prefer explicit choices if provided (escape hatch for edge cases)
    if (fieldDef.choices && fieldDef.choices.length > 0) {
      result.set(name, fieldDef.choices);
      continue;
    }

    // Fall back to schema extraction
    const choices = extractEnumChoices(fieldDef.schema);
    if (choices) {
      result.set(name, choices);
    }
  }

  return result;
}
