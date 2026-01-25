# DX and API Design Research

## Problem

Identify opportunities to improve pok's developer experience and API design. Focus on ergonomics, type inference, error messages, boilerplate reduction, and discoverability.

## Scope

- `packages/core/src/` - Core API definitions
- `test/commands/` and `commands/` - Real-world usage patterns
- `docs/api/` - API documentation

## Approach

Thorough codebase exploration examining:

1. API ergonomics and verbosity
2. TypeScript inference quality
3. Error message helpfulness
4. Boilerplate patterns
5. API discoverability
6. Comparison to competitors

## Hypothesis

There are concrete improvements possible in context definition syntax, type exports, error messages, and API discoverability that could significantly reduce friction for developers adopting pok.

## Results

### 1. Current State Assessment

#### Strengths

- **Clean file-based routing**: Command files like `deploy.ts` become `mycli deploy` automatically
- **Strong Zod integration**: Schema inference works well for context types
- **Good separation of concerns**: defineCommand, defineTask, defineCheck, defineEnv are distinct primitives
- **Thoughtful dry-run pattern**: `dryRunContext` spreadable helper is elegant
- **Comprehensive retry configuration**: BackoffStrategies enum with clear documentation

#### Well-Designed Patterns

```typescript
// This is elegant - spread to add dry-run
context: {
  env: { from: 'flag', schema: z.enum(['dev', 'prod']) },
  ...dryRunContext, // Adds --dry-run automatically
}

// Task definition is clean
const migrate = defineTask({
  label: 'Run migrations',
  env: dbEnv,
  exec: 'prisma migrate deploy',
});
```

---

### 2. Pain Points Discovered

#### 2.1 Context Definition Verbosity (HIGH PRIORITY)

**Current pattern requires significant boilerplate:**

```typescript
context: {
  env: {
    from: 'flag',
    schema: z.enum(['dev', 'staging', 'prod']).default('dev'),
    description: 'Target environment',
  },
  verbose: {
    from: 'flag',
    schema: z.boolean().default(false),
    description: 'Enable verbose output',
  },
  count: {
    from: 'flag',
    schema: z.number().default(1),
    description: 'Number of iterations',
  },
},
```

**Issues:**

- `from: 'flag'` is always the same (no other sources implemented)
- Every field needs the same structure repeated
- 5+ lines per flag

**Comparison to competitors:**

- **Commander.js**: `.option('--env <type>', 'Target environment', 'dev')`
- **Yargs**: `.option('env', { alias: 'e', type: 'string', default: 'dev' })`
- **oclif**: Uses decorators but more concise

#### 2.2 Undocumented/Unimplemented `flag:` Property (BUG)

**In `commands/publish.ts` and `commands/version.ts`:**

```typescript
context: {
  unscopedOnly: {
    from: 'flag',
    flag: 'unscoped-only',  // <-- Not in type definition!
    schema: z.boolean().optional(),
  },
},
```

The `flag:` property is being used to customize CLI flag names but:

1. It's NOT in the `ContextFieldDef` type
2. The `args.ts` parser doesn't look for it - it uses `camelToKebab(name)`
3. TypeScript should error but doesn't because `ContextFieldDef` isn't strict

**This is a discoverability failure** - developers can't discover this "feature" from types, and it may not work!

#### 2.3 Deeply Nested Context Access (MEDIUM PRIORITY)

**Current access pattern is verbose:**

```typescript
run: async (r, ctx) => {
  // Must access ctx.context.env, not just ctx.env
  const env = ctx.context.env;
  const dryRun = ctx.context.dryRun;

  // ctx.extraArgs and ctx.cwd are top-level
  // but context fields are nested
};
```

**Why two levels?** The `RunContext` type has:

- `context: InferContext<C>` - parsed flags
- `extraArgs: string[]` - positional args
- `cwd: string` - project root

This creates asymmetry and verbosity.

#### 2.4 Task Context Type Complexity (MEDIUM PRIORITY)

**The TaskContext generic has 4+ type parameters:**

```typescript
type TaskContext<
  TEnvs = Record<string, never>,
  TParams = Record<string, never>,
  TWriteEnvs extends WriteEnvsFn<string> | undefined = undefined,
  TContext extends Record<string, unknown> = Record<string, unknown>,
>
```

This complexity leaks into hover-tips and error messages, making debugging harder.

#### 2.5 Missing Convenience Exports (LOW PRIORITY)

**Common patterns aren't pre-packaged:**

```typescript
// Developers need to manually create these
const envFlag = {
  from: 'flag',
  schema: z.enum(['dev', 'staging', 'prod']),
  description: 'Target environment',
} as const;

// Could be: import { envFlag } from '@pokit/core/presets'
```

#### 2.6 Error Messages Lack Context (MEDIUM PRIORITY)

**Good error example from CLIError:**

```
Error: Required flag --env is missing

Usage: mycli deploy --env <dev|prod>

Run 'mycli deploy --help' for more information.
```

**Bad error example - task execution failure:**

```
CommandError: Command failed: prisma migrate deploy
```

No context about which task, what env, retry status, etc.

#### 2.7 No Short Flag Support (LOW PRIORITY)

```typescript
// Can't define: -e as alias for --env
context: {
  env: { from: 'flag', schema: z.string() }
}
// Only generates --env, no -e
```

#### 2.8 Async Check Bodies Need Await (MINOR)

```typescript
// Easy to forget the await
export const dockerRunning = defineCheck({
  label: 'Docker running',
  check: async () => {
    const running = await shell.isDockerRunning();
    if (!running) throw new Error('Docker not running');
  },
});
```

No enforcement that check actually awaits its async operations.

---

### 3. Concrete Improvement Ideas

#### 3.1 Shorthand Context Syntax (HIGH IMPACT)

**Proposal: Support Zod schema directly for common cases**

```typescript
// BEFORE (verbose)
context: {
  env: {
    from: 'flag',
    schema: z.enum(['dev', 'staging', 'prod']).default('dev'),
    description: 'Target environment',
  },
}

// AFTER (concise) - infer from schema
context: {
  env: z.enum(['dev', 'staging', 'prod']).default('dev'),
}

// Or with description
context: {
  env: z.enum(['dev', 'staging', 'prod']).default('dev').describe('Target environment'),
}
```

**Implementation:**

- Normalize context at runtime - detect Zod schema vs full object
- `z.describe()` already exists and works

**Backwards compatible:** Old format still works.

#### 3.2 Fix/Implement Custom Flag Names (BUG FIX)

**Add `flag` to type and implement in parser:**

```typescript
type ContextFieldDef = {
  from: ContextSource;
  schema: z.ZodType;
  description?: string;
  choices?: string[];
  flag?: string; // <-- Add this
  alias?: string; // <-- And short alias
};
```

**Update args.ts to respect custom flag names:**

```typescript
// In parseContext, check for custom flag name
const cliName = fieldDef.flag || camelToKebab(name);
```

#### 3.3 Flatten Context Access

**Proposal: Merge context into RunContext**

```typescript
// BEFORE
run: async (r, ctx) => {
  const env = ctx.context.env;
  const args = ctx.extraArgs;
};

// AFTER
run: async (r, ctx) => {
  const env = ctx.env; // Flattened
  const args = ctx.extraArgs; // Same
};
```

**Implementation:**

- RunContext could spread InferContext<C> directly
- Check for conflicts with reserved names (extraArgs, cwd)

#### 3.4 Common Flag Presets

**Proposal: Export reusable context patterns**

```typescript
// @pokit/core/presets
export const flags = {
  env: (choices: string[]) => ({
    from: 'flag' as const,
    schema: z.enum(choices as [string, ...string[]]),
    description: 'Target environment',
  }),

  dryRun: dryRunContext.dryRun,

  verbose: {
    from: 'flag' as const,
    schema: z.boolean().default(false),
    description: 'Enable verbose output',
  },

  yes: {
    from: 'flag' as const,
    schema: z.boolean().default(false),
    description: 'Skip confirmation prompts',
  },
};

// Usage
context: {
  env: flags.env(['dev', 'staging', 'prod']),
  ...dryRunContext,
  verbose: flags.verbose,
}
```

#### 3.5 Better Error Context in Task Failures

**Proposal: Include task metadata in errors**

```typescript
class TaskError extends Error {
  constructor(
    message: string,
    public readonly taskLabel: string,
    public readonly attempt: number,
    public readonly maxAttempts: number,
    public readonly output?: string
  ) {}
}

// Error message:
// TaskError: Task "Run migrations" failed (attempt 2/3)
// Command: prisma migrate deploy
// Output: [...]
```

#### 3.6 Type-Safe Context Helper

**Proposal: Helper function for defining context with inference**

```typescript
// Helper that provides better inference
import { ctx } from '@pokit/core';

context: ctx({
  env: ctx.enum(['dev', 'prod']).default('dev'),
  verbose: ctx.boolean().default(false),
  count: ctx.number().default(1),
}),
```

This is less radical than proposal 3.1 but still reduces boilerplate.

---

### 4. Priority Recommendations

#### P0 - Critical (Bug Fixes)

1. **Fix `flag:` property** - Either implement or remove from dogfood code
2. **Make ContextFieldDef strict** - Add `& Record<string, never>` to catch extra props

#### P1 - High Impact

3. **Shorthand context syntax** - Biggest DX win, high usage frequency
4. **Common flag presets** - Low effort, immediate benefit
5. **Short flag aliases** - Expected feature in any CLI framework

#### P2 - Medium Impact

6. **Flatten context access** - Reduces verbosity in every command
7. **Better task error messages** - Improves debugging experience

#### P3 - Nice to Have

8. **Type-safe context helper (ctx)** - Alternative if shorthand is too radical
9. **Async check enforcement** - Catches subtle bugs

---

### 5. Comparison to Competitors

| Feature             | pok   | Commander.js | Yargs | oclif |
| ------------------- | ----- | ------------ | ----- | ----- |
| Type safety         | ★★★★★ | ★★☆☆☆        | ★★★☆☆ | ★★★★☆ |
| Boilerplate         | ★★★☆☆ | ★★★★★        | ★★★★☆ | ★★★☆☆ |
| File-based routing  | ★★★★★ | N/A          | N/A   | ★★★☆☆ |
| Interactive prompts | ★★★★★ | ★★☆☆☆        | ★★★☆☆ | ★★★★☆ |
| Pre-flight checks   | ★★★★★ | N/A          | N/A   | N/A   |
| Env resolution      | ★★★★★ | N/A          | N/A   | N/A   |
| Error messages      | ★★★★☆ | ★★★☆☆        | ★★★★☆ | ★★★★☆ |
| Learning curve      | ★★★☆☆ | ★★★★★        | ★★★★☆ | ★★★☆☆ |

**pok's differentiators:**

- Integrated secret resolution (defineEnv/defineEnvResolver)
- Pre-flight check system
- Tabbed terminal UI
- Event-driven output

**pok's gaps vs competitors:**

- More verbose flag definitions than Commander
- No short flag aliases (-e for --env)
- Higher learning curve due to more concepts

---

### 6. Quick Wins (< 1 day effort each)

1. **Add `flag:` and `alias:` to ContextFieldDef** - 2 hours
2. **Export common presets** - 2 hours
3. **Document all type exports in README** - 1 hour
4. **Add examples of shorthand when Zod supports it** - 1 hour
5. **Improve CommandError with task context** - 3 hours

---

## Evaluation

The research confirms that pok's API is fundamentally well-designed but has accumulated some rough edges:

1. **The context definition syntax is the biggest pain point** - It's verbose compared to alternatives and doesn't leverage Zod's full potential (like `.describe()`)

2. **Type definitions don't match actual usage** - The `flag:` property bug indicates a gap between implementation and types

3. **The primitives are powerful but undersold** - Features like env resolution, pre-flight checks, and the dry-run pattern are genuinely unique but not immediately discoverable

**Recommendation:** Focus on P0 (bug fixes) and the shorthand context syntax (P1) as the highest-impact improvements. The ecosystem around pok (checks, envs, tasks) is mature; the command definition syntax is where friction lives.
