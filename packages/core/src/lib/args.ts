import { z } from 'zod';
import type { ContextDef, InferContext } from './command';
import type { Prompter } from '../prompter';

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
 * Try to extract enum choices from a schema
 *
 * Uses Zod's internal _def structure to get exact enum values when possible,
 * with fallback to heuristic probing for wrapped schemas.
 */
function extractEnumChoices(schema: z.ZodType): string[] | undefined {
  // Try to access Zod internal structure for enum values
  const choices = getEnumChoicesFromSchema(schema);
  if (choices) return choices;

  // Fallback: heuristic approach for wrapped or complex schemas
  // Common environment values to test
  const testValues = ['dev', 'staging', 'prod', 'production', 'development', 'test', 'local'];

  const validValues: string[] = [];
  let hasStringRestriction = false;

  for (const value of testValues) {
    const result = schema.safeParse(value);
    if (result.success) {
      validValues.push(value);
    } else {
      hasStringRestriction = true;
    }
  }

  // If some test values work and some don't, it's likely an enum
  // Also check that random strings fail
  const randomResult = schema.safeParse('__random_unlikely_value_xyz__');
  if (hasStringRestriction && validValues.length > 0 && !randomResult.success) {
    return validValues;
  }

  return undefined;
}

/**
 * Extract enum choices directly from Zod schema internal structure
 *
 * This is more reliable than heuristic probing but requires accessing
 * Zod internals, which may change between versions.
 */
export function getEnumChoicesFromSchema(schema: z.ZodType): string[] | undefined {
  // Unwrap through layers: ZodDefault, ZodOptional, ZodNullable
  let current: z.ZodType = schema;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (current as any)._def;
  if (!def) return undefined;

  // Follow the chain of wrappers
  if (def.typeName === 'ZodDefault' && def.innerType) {
    current = def.innerType;
  }
  if ((current as any)._def?.typeName === 'ZodOptional' && (current as any)._def?.innerType) {
    current = (current as any)._def.innerType;
  }
  if ((current as any)._def?.typeName === 'ZodNullable' && (current as any)._def?.innerType) {
    current = (current as any)._def.innerType;
  }

  // Check for ZodEnum
  const innerDef = (current as any)._def;
  if (innerDef?.typeName === 'ZodEnum' && innerDef?.values) {
    return innerDef.values as string[];
  }

  // Check for ZodNativeEnum
  if (innerDef?.typeName === 'ZodNativeEnum' && innerDef?.values) {
    return Object.values(innerDef.values).filter((v): v is string => typeof v === 'string');
  }

  return undefined;
}

/**
 * Parse command line arguments against context definitions
 *
 * Supports:
 * - --flag value (string/enum flags)
 * - --flag (boolean flags, sets to true)
 * - --no-flag (boolean flags, sets to false)
 *
 * @param args - Raw command line arguments
 * @param contextDef - Context field definitions
 * @returns Parsed context and remaining positional arguments
 */
export function parseContext<C extends ContextDef>(args: string[], contextDef: C): ParsedArgs<C> {
  const context: Record<string, unknown> = {};
  const rest: string[] = [];

  // Build schema info cache
  const schemaInfoCache = new Map<string, SchemaInfo>();
  for (const [name, fieldDef] of Object.entries(contextDef)) {
    const info = getSchemaInfo(fieldDef.schema);
    schemaInfoCache.set(name, info);

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
      const rawFlagName = isNegated ? arg.slice(5) : arg.slice(2);
      // Support both kebab-case (--dry-run) and camelCase (--dryRun)
      const flagName = kebabToCamel(rawFlagName);
      const fieldDef = contextDef[flagName];

      if (!fieldDef) {
        throw new Error(`Unknown flag: ${arg}`);
      }

      const info = schemaInfoCache.get(flagName)!;

      if (info.type === 'boolean') {
        context[flagName] = !isNegated;
        i++;
      } else {
        // String/enum flag - next arg is the value
        const value = args[i + 1];
        if (value === undefined || value.startsWith('--')) {
          throw new Error(`Flag --${flagName} requires a value`);
        }

        // Validate the value against the schema
        const result = fieldDef.schema.safeParse(value);
        if (!result.success) {
          const choicesMsg = info.choices ? ` Valid: ${info.choices.join(', ')}` : '';
          throw new Error(`Invalid value for --${flagName}: ${value}.${choicesMsg}`);
        }

        context[flagName] = value;
        i += 2;
      }
    } else {
      // Positional argument
      rest.push(arg);
      i++;
    }
  }

  return { context: context as InferContext<C>, rest };
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
 * @returns Context with values resolved
 */
export async function resolveInteractiveContext<C extends ContextDef>(
  context: InferContext<C>,
  contextDef: C,
  choices: Map<string, string[]>,
  prompter: Prompter,
  fromMenu: boolean = false
): Promise<InferContext<C>> {
  const resolved = { ...context };

  for (const [name, fieldDef] of Object.entries(contextDef)) {
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
      if (fieldChoices && fieldChoices.length > 0) {
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
 * Validate that all required context fields have values
 *
 * @param context - Parsed context values
 * @param contextDef - Context field definitions
 * @throws Error if a required field is missing
 */
export function validateRequiredContext<C extends ContextDef>(
  context: InferContext<C>,
  contextDef: C
): void {
  for (const [name, fieldDef] of Object.entries(contextDef)) {
    const info = getSchemaInfo(fieldDef.schema);
    if (!info.isOptional) {
      const value = context[name as keyof typeof context];
      if (value === undefined || value === '') {
        throw new Error(`Required flag --${name} is missing`);
      }
    }
  }
}

/**
 * Extract choices from context field definitions
 *
 * This is used during command loading to extract enum choices
 * before interactive prompting (since we can't reliably probe schemas).
 */
export function extractChoices<C extends ContextDef>(contextDef: C): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const [name, fieldDef] of Object.entries(contextDef)) {
    const choices = extractEnumChoices(fieldDef.schema);
    if (choices) {
      result.set(name, choices);
    }
  }

  return result;
}
