# Architecture and Extensibility Research

## Problem
Assess pok's architecture to understand how well it supports extensibility, modularity, and customization. Identify strengths, weaknesses, and opportunities for improvement.

## Scope
- `packages/core/` - Core framework architecture
- `packages/reporter-*/` - Reporter implementations
- `packages/prompter-*/` - Prompter implementations  
- `packages/tabs-*/` - Tab implementations
- `docs/architecture.md` - Architecture documentation
- Package boundaries and dependency graph

## Approach
Deep code review of extension points, interfaces, dependency injection patterns, and package coupling.

## Hypothesis
pok likely has a solid foundation with its event-driven architecture and interface-based adapters, but may have opportunities for additional extension points and clearer plugin boundaries.

## Results

### 1. Architecture Assessment

#### Strengths

**Event-Driven Core Design** (Excellent)
The architecture follows a clean separation between event emission and event consumption:
- `EventBus` provides pub/sub mechanism (`createEventBus()`)
- `Reporter` emits semantic events (activities, groups, logs)
- `ReporterAdapter` consumes events and renders output
- This decoupling enables multiple adapters: terminal (`reporter-clack`), web (`reporter-web`), testing (`adapter.raw`)

**Interface-Based Abstraction** (Excellent)
Core defines abstract interfaces; implementations are swappable:
- `ReporterAdapter` - output rendering
- `Prompter` - interactive input
- `TabsAdapter` - tabbed terminal UI
- Each interface has documented behavioral contracts (see `packages/core/src/events/adapter.ts`, `packages/core/src/prompter/types.ts`, `packages/core/src/tabs/types.ts`)

**Schema-First Design** (Excellent)
Zod schemas drive the entire system:
- Command context definitions → type inference → validation
- Environment resolvers declare required context → type-safe task execution
- "Schema is destiny" principle is well-implemented

**Runtime Abstraction** (Good)
Clean runtime detection and abstraction layer:
- `packages/core/src/runtime/` provides unified interface for Bun/Node.js
- Lazy-loaded implementations prevent bundling unused code
- `Runtime` interface covers spawn, shell, glob, file reading

#### Weaknesses

**Hardcoded Adapter Dependencies in CLI Entry Point**
`packages/core/src/cli.ts` lines 86-105 hardcode `@pokit/reporter-clack` and `@pokit/prompter-clack`:
```typescript
const reporterModule = await import('@pokit/reporter-clack');
const prompterModule = await import('@pokit/prompter-clack');
```
This limits flexibility - users cannot swap default adapters without modifying core.

**Router is Monolithic** 
`packages/core/src/lib/router.ts` at 1346 lines is the largest file. It handles:
- Command tree building
- Navigation/menu logic
- Pre-check execution
- Context resolution
- Command execution
- Completion generation

This could be decomposed for better testability and extensibility.

**No Lifecycle Hooks**
Commands support `pre` checks, but there's no `post` hook or lifecycle system for:
- Before/after command execution
- Before/after task execution
- Global middleware

### 2. Extension Point Analysis

#### Current Extension Points

| Extension Point | Interface | How to Extend |
|----------------|-----------|---------------|
| Reporter | `ReporterAdapter` | Implement `start(bus) → Controller` |
| Prompter | `Prompter` | Implement select/multiselect/confirm/text |
| Tabs | `TabsAdapter` | Implement `run(items, options)` |
| Env Resolver | `EnvResolver` | Use `defineEnvResolver()` |
| Checks | `CheckConfig` | Use `defineCheck()` |
| Tasks | `ExecTaskConfig`/`RunTaskConfig` | Use `defineTask()` |
| Commands | `CommandConfig` | Use `defineCommand()` |

#### Extension Point Evaluation

**ReporterAdapter** - Well-designed
- Clean interface: `start(bus: EventBus): ReporterAdapterController`
- Controller pattern with `stop()` for cleanup
- Idempotency requirements documented
- Three implementations: clack, web, raw (testing)

**Prompter** - Well-designed  
- Four methods: select, multiselect, confirm, text
- Options types are generic (`SelectOptions<T>`)
- Two implementations: clack, raw (testing)
- Contract specifies cancellation behavior

**TabsAdapter** - Simple but effective
- Single method: `run(items, options)`
- Two implementations: ink, opentui
- Shared logic in `tabs-core` package

**EnvResolver** - Powerful but complex
- Composite resolvers enable chaining
- Type-safe with branded `EnvVarKey<T>`
- Optional `write` capability for persistence
- Could benefit from simpler documentation

#### Missing Extension Points

1. **Middleware System** - No way to intercept command execution globally
2. **Custom Command Sources** - Commands must come from filesystem
3. **Output Transformers** - Cannot transform events before adapter consumption
4. **Custom Argument Parsers** - Context sources limited to `'flag'`
5. **Plugin Registration** - No formal plugin API

### 3. Package Boundary Analysis

#### Dependency Graph

```
@pokit/core (no runtime dependencies on other @pokit packages)
    ↑ peerDependency
    ├── @pokit/reporter-clack
    ├── @pokit/prompter-clack
    ├── @pokit/reporter-web
    ├── @pokit/tabs-core
    │       ↑
    │       ├── @pokit/tabs-ink
    │       └── @pokit/tabs-opentui
    └── @pokit/op
```

#### Boundary Assessment

**Well-Defined Boundaries**
- Core has zero runtime dependencies on other @pokit packages
- Adapters depend on core via peerDependency (correct pattern)
- tabs-core provides shared logic for tabs implementations
- No circular dependencies detected

**Coupling Issues**

1. **Core devDependencies include adapters**
   `packages/core/package.json` includes `@pokit/reporter-clack` and `@pokit/prompter-clack` as devDependencies for testing. This is acceptable but creates implicit coupling.

2. **CLI entry point hardcodes adapters**
   `runCli()` dynamically imports specific adapter packages, which should be configurable.

3. **reporter-web has thin adapter**
   `packages/reporter-web/src/adapter.ts` (58 lines) is minimal - just pipes events to a store. This is correct for web, but the store logic (`store.ts`) could be extracted to a shared package.

### 4. Testability Assessment

#### Test Infrastructure

**Excellent Testing Support**
- `createRawReporterAdapter()` - Captures events for assertions
- `createRawPrompter()` - Pre-configured responses for non-interactive testing
- `createEventBus({ onError: 'throw' })` - Strict error handling in tests
- `@pokit/test-utils` package for shared test utilities

**Testing Patterns**
- Event-driven architecture enables testing without terminal I/O
- Runner accepts dependencies via `RunnerOptions`
- Commands can be tested with mocked adapters

#### Dependency Injection Analysis

**Current DI Pattern**
Dependencies flow through `RouterContext`:
```typescript
type RouterContext = {
  config: RouterConfig;
  eventBus: EventBus;
  reporter: Reporter;
  adapterController: ReporterAdapterController;
  prompter: Prompter;
  tabs?: TabsAdapter;
  // ...
};
```

`RunnerOptions` receives similar dependencies:
```typescript
type RunnerOptions = {
  eventBus: EventBus;
  tabs?: TabsAdapter;
  prompter: Prompter;
  // ...
};
```

**Assessment**
- Manual DI works but is verbose
- No container or service locator pattern
- Dependencies are passed through function parameters (explicit, testable)
- Could benefit from a lightweight DI container for complex scenarios

### 5. Recommendations for Improved Extensibility

#### High Priority

1. **Configurable Default Adapters**
   Make `runCli()` accept adapter factory functions:
   ```typescript
   await runCli(args, {
     createReporter: () => createMyReporter(),
     createPrompter: () => createMyPrompter(),
   });
   ```

2. **Lifecycle Hooks**
   Add command/task lifecycle hooks:
   ```typescript
   defineCommand({
     pre: [...],
     post: [...],           // NEW: post-execution hooks
     onSuccess: (ctx) => {},  // NEW: success handler
     onFailure: (error) => {}, // NEW: failure handler
   });
   ```

3. **Decompose Router**
   Extract router responsibilities:
   - `CommandTreeBuilder` - builds tree from filesystem
   - `CommandNavigator` - handles menu navigation
   - `CommandExecutor` - executes commands
   - `CheckRunner` - executes pre-checks
   
#### Medium Priority

4. **Plugin System**
   Define a plugin API:
   ```typescript
   interface PokPlugin {
     name: string;
     // Extend command discovery
     commandSources?: CommandSource[];
     // Add middleware
     middleware?: Middleware[];
     // Register custom resolvers
     resolvers?: EnvResolver[];
   }
   ```

5. **Event Transformers**
   Allow intercepting/transforming events:
   ```typescript
   const bus = createEventBus({
     transform: (event) => {
       // Modify events before consumption
       return event;
     }
   });
   ```

6. **Additional Context Sources**
   Extend context beyond flags:
   ```typescript
   context: {
     env: { from: 'env', schema: z.string() },       // Environment variable
     config: { from: 'config', schema: z.string() }, // Config file
     prompt: { from: 'prompt', schema: z.string() }, // Always prompt
   }
   ```

#### Low Priority

7. **Extract Web Reporter Store**
   Move `reporter-web/src/store.ts` logic to a shared `@pokit/reporter-store` package for reuse across web frameworks.

8. **Formalize Runtime Extensions**
   Allow extending the `Runtime` interface for additional platform-specific features.

### 6. Ideas for New Extension Points

1. **Command Decorators**
   Enable cross-cutting concerns:
   ```typescript
   const withTiming = defineDecorator({
     before: (ctx) => { ctx.startTime = Date.now(); },
     after: (ctx) => { reporter.info(`Took ${Date.now() - ctx.startTime}ms`); },
   });
   ```

2. **Output Formatters**
   Support structured output:
   ```typescript
   defineCommand({
     outputFormat: 'json', // or 'yaml', 'table'
     run: (r, ctx) => {
       return { result: 'data' }; // Automatically formatted
     },
   });
   ```

3. **Conditional Commands**
   Hide commands based on context:
   ```typescript
   defineCommand({
     visible: async (ctx) => await hasFeatureFlag('new-feature'),
     // ...
   });
   ```

4. **Custom Menu Renderers**
   Allow custom interactive menu UI:
   ```typescript
   const customMenu = defineMenuRenderer({
     render: (options) => {
       // Custom rendering logic
     },
   });
   ```

5. **Telemetry Hooks**
   Built-in extension point for analytics:
   ```typescript
   definePlugin({
     onCommandStart: (cmd) => track('command_start', cmd),
     onCommandEnd: (cmd, result) => track('command_end', { cmd, result }),
   });
   ```

## Evaluation

### Overall Architecture Score: 8/10

**Strengths:**
- Event-driven design enables excellent separation of concerns
- Interface-based abstractions make adapters swappable
- Schema-first approach with Zod provides type safety
- Package boundaries are clean with no circular dependencies
- Testing infrastructure is comprehensive

**Areas for Improvement:**
- Router is monolithic and could be decomposed
- No formal plugin system limits third-party extensions
- Hardcoded adapter imports reduce flexibility
- Missing lifecycle hooks for advanced use cases

**Conclusion:**
pok's architecture demonstrates solid foundations aligned with its design principles ("vertically-integrated abstractions", "principle of least API"). The event-driven core and interface-based adapters provide good extensibility for the reporter/prompter/tabs concerns. The main opportunities for improvement are:
1. Formalizing a plugin API
2. Adding lifecycle hooks
3. Making adapter selection configurable
4. Decomposing the router for better maintainability

The architecture successfully balances the "ceremony-free interfaces" principle while providing sufficient extension points for common customization needs. Advanced extensibility (plugins, middleware) would benefit from explicit APIs rather than requiring core modifications.
