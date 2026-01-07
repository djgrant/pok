# Performance and Scalability Research

## Problem

pok is designed to be "the TanStack of command line apps" - a framework for building internal developer platforms. As adoption grows, understanding performance characteristics and scalability limits becomes critical. This research identifies current bottlenecks, quantifies performance characteristics, and recommends optimizations.

## Scope

- `packages/core/src/` - Core framework (routing, tasks, events, runtime)
- `packages/cmd/` - CLI entry point
- `packages/op/` - 1Password resolver (external I/O example)
- `test/` - Test infrastructure for benchmarking context

## Approach

Systematic analysis of:
1. Startup performance (cold start, module loading)
2. Command discovery and tree building
3. Task execution and concurrency
4. Memory patterns and potential leaks
5. Caching opportunities
6. Scalability with many commands/tasks

---

## Findings

### 1. Startup Time

#### Current Flow
```
pok (cmd/bin/pok.ts)
  └─> await import('@pokit/core')           # Dynamic import
      └─> runCli()
          ├─> findProjectRoot()             # Sync fs.existsSync loop
          ├─> findCommandsDir()             # Sync fs.existsSync
          ├─> await import('@pokit/reporter-clack')  # Dynamic peer dep
          ├─> await import('@pokit/prompter-clack')  # Dynamic peer dep
          └─> run() [router.ts]
              ├─> createEventBus()
              ├─> reporterAdapter.start()
              └─> buildCommandTree()        # MAIN BOTTLENECK
                  └─> for each *.ts file:
                      └─> await import(filePath)  # Serial imports!
```

#### Key Observations

**Positive:**
- Runtime abstraction (`getRuntime()`) is cached as singleton - good pattern
- Uses Bun's native `Bun.Glob` for fast file discovery
- Version check (`--version`) short-circuits before any heavy work

**Bottlenecks:**
1. **Serial command imports** (router.ts:150-193): Commands are loaded one-by-one in a loop. Each `await import(filePath)` is serial.
   ```typescript
   for await (const file of runtime.glob('*.{ts,tsx}', { cwd: commandsDir })) {
     const module = await import(filePath);  // SERIAL!
   }
   ```

2. **Sync filesystem operations** (cli.ts:22-50): `fs.existsSync` blocks the event loop
   ```typescript
   while (dir !== path.dirname(dir)) {
     if (fs.existsSync(path.join(dir, 'package.json'))) {  // SYNC
       return dir;
     }
   }
   ```

3. **Peer dependency loading** (cli.ts:85-105): Reporter and prompter loaded dynamically on every run
   ```typescript
   const reporterModule = await import('@pokit/reporter-clack');  // Every time
   const prompterModule = await import('@pokit/prompter-clack');  // Every time
   ```

### 2. Command Discovery

#### Current Implementation
- File-based routing: `commands/*.ts` files → command tree
- Supports dot-notation for nesting: `db.migrate.ts` → `db migrate`
- Alias validation happens after all commands loaded
- No caching of command tree between runs

#### Scalability Concerns
- **O(n) file imports**: Each command file requires a separate import
- **No tree caching**: Command tree rebuilt from scratch each run
- **Validation at runtime**: Alias conflicts detected every startup

#### Analysis
For a project with 50 commands:
- 50 dynamic imports (potentially 50 file reads + transpilation)
- Tree building: O(n) insertions into Map structure
- Alias validation: O(n²) in worst case (nested trees)

### 3. Lazy Loading

#### Current State
**Good lazy loading patterns:**
- Runtime abstraction: `getRuntime()` lazy loads Bun/Node runtime
- Peer dependencies: Reporter/prompter loaded only when needed
- Node.js fast-glob: Dynamically imported only in Node runtime

**Missing lazy loading:**
- **Zod schemas**: Imported eagerly in all command files
- **Task dependencies**: All task envs/resolvers initialized at command load time
- **Help generation**: Imports pulled in even when not needed

#### Recommendation
Commands could export a factory function that returns config, allowing the heavy imports to be deferred:
```typescript
// Instead of:
export const command = defineCommand({...})

// Could be:
export default () => defineCommand({...})  // Lazy factory
```

### 4. Memory Usage

#### Potential Concerns

**Process Registry (runner.ts:297-369):**
```typescript
class ProcessRegistry {
  private runners = new Set<WeakRef<RunnerProcessSet>>();  // WeakRef - good!
  // BUT: cleanupDeadRefs() only called after killAll()
}
```
- Uses `WeakRef` correctly for garbage collection
- However, dead refs only cleaned during `killAll()` - could accumulate

**Env Cache (runner.ts:507):**
```typescript
const envCache = new Map<string, string>();  // Per-runner cache
```
- Good: Caches resolved env vars within a command run
- Potential issue: No size limit, no TTL

**Event Bus (bus.ts):**
```typescript
const listeners = new Set<EventListener>();
```
- Listeners removed via unsubscribe function
- No listener leak protection (no weak references)

**Command Tree:**
- Tree stored in memory for entire CLI lifecycle
- No cleanup between commands in interactive mode

### 5. Concurrency

#### Current Support

**Parallel task execution (runner.ts:753-841):**
```typescript
parallel(items: RunnerItem[], options?: ParallelOptions): Promise<void>
```
- Three modes: `'race'`, `'fail-fast'`, `'all-settled'`
- Uses `Promise.allSettled()` with `AbortController` for cancellation
- Process registry handles signal cleanup

**Parallel children (router.ts:749-780):**
```typescript
if (mode === 'parallel') {
  await reporter.group(groupLabel, { layout: 'parallel' }, async (grp) => {
    await Promise.allSettled(leavesWithContext.map(...));
  });
}
```

**Env resolution (op/resolver.ts:78-79):**
```typescript
const items = await op.getItemsBatch(vaultName, itemNames);  // Batch fetch
```

#### Gaps
1. **No concurrency limit**: `r.parallel([...100 tasks])` spawns all 100 immediately
2. **No worker pool**: Each task runs in main thread or spawned process
3. **Serial command loading**: As noted above, command imports are not parallelized

### 6. Large Codebases

#### Scaling Characteristics

| Metric | Current Behavior | Scalability |
|--------|-----------------|-------------|
| Commands | O(n) imports at startup | Poor for >100 commands |
| Tasks per command | Loaded with command | Good - on-demand |
| Env vars | Cached per runner | Good within run |
| Pre-checks | Deduplicated by reference | Good |
| Event listeners | Unbounded Set | Potential memory issue |

#### Stress Points
1. **100+ commands**: Noticeable startup delay from serial imports
2. **Deep command trees**: Alias validation becomes O(n²)
3. **Long-running processes**: Event listeners may accumulate
4. **Many parallel tasks**: No concurrency throttling

### 7. Caching Opportunities

#### Currently Cached
- Runtime instance (singleton)
- Env vars (per-runner, per-run)
- Schema info (per parseContext call via local Map)

#### Potential Caching

1. **Command Tree Cache**
   - Cache built tree to disk (e.g., `.pok/cache/commands.json`)
   - Invalidate based on file mtimes
   - Skip rebuild if cache valid

2. **Transpilation Cache**
   - Bun already caches transpilation
   - Could leverage Bun's `Bun.build` for pre-compilation

3. **Schema Info Cache**
   - `getSchemaInfo()` called multiple times per schema
   - Could use WeakMap keyed on schema object

4. **Help Text Cache**
   - Help generation is pure function
   - Could memoize based on command config

---

## Recommendations

### High Priority (Significant Impact)

#### 1. Parallel Command Loading
```typescript
// router.ts - Parallel import with concurrency limit
const files = [];
for await (const file of runtime.glob('*.{ts,tsx}', { cwd: commandsDir })) {
  files.push(file);
}

const BATCH_SIZE = 10;
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const batch = files.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(async (file) => {
    const module = await import(path.join(commandsDir, file));
    // process...
  }));
}
```
**Impact**: 5-10x faster startup for projects with many commands

#### 2. Command Tree Caching
```typescript
// Check cache before building
const cacheFile = path.join(projectRoot, '.pok/cache/tree.json');
const cacheMeta = await getCacheMeta(cacheFile);
if (cacheMeta && await isCacheValid(cacheMeta, commandsDir)) {
  return loadCachedTree(cacheFile);
}
// Build and cache
const tree = await buildCommandTree(commandsDir, ctx);
await saveTreeCache(cacheFile, tree, commandsDir);
```
**Impact**: Near-instant startup for unchanged command sets

#### 3. Async Filesystem Operations
```typescript
// cli.ts - Use async fs
import { access, readFile } from 'fs/promises';

async function findProjectRoot(startDir: string): Promise<string> {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    try {
      await access(path.join(dir, 'package.json'));
      return dir;
    } catch { }
    dir = path.dirname(dir);
  }
  return startDir;
}
```
**Impact**: Non-blocking startup, better for concurrent usage

### Medium Priority (Moderate Impact)

#### 4. Concurrency Limiting for Parallel Tasks
```typescript
async parallel(items: RunnerItem[], options?: ParallelOptions & { 
  concurrency?: number 
}): Promise<void> {
  const concurrency = options?.concurrency ?? 10;
  // Use p-limit or similar
}
```

#### 5. Schema Info Memoization
```typescript
const schemaInfoCache = new WeakMap<z.ZodType, SchemaInfo>();

export function getSchemaInfo(schema: z.ZodType): SchemaInfo {
  const cached = schemaInfoCache.get(schema);
  if (cached) return cached;
  
  const info = computeSchemaInfo(schema);
  schemaInfoCache.set(schema, info);
  return info;
}
```

#### 6. Lazy Command Factory Pattern
```typescript
// commands/db.migrate.ts
export const command = () => defineCommand({
  label: 'Run migrations',
  run: async (r) => {
    // Heavy imports only happen when command runs
    const { migrate } = await import('../tasks/migrate');
    await r.run(migrate);
  }
});
```

### Low Priority (Polish)

#### 7. Event Listener Leak Protection
```typescript
// Add max listeners or use WeakRef for auto-cleanup
const MAX_LISTENERS = 100;
on(listener: EventListener): Unsubscribe {
  if (listeners.size >= MAX_LISTENERS) {
    console.warn('EventBus: max listeners reached');
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}
```

#### 8. Process Registry Periodic Cleanup
```typescript
// Periodically clean dead WeakRefs
setInterval(() => {
  this.cleanupDeadRefs();
}, 30000);
```

---

## Benchmarking Suggestions

### Proposed Benchmarks

1. **Startup Time**
   ```bash
   # Cold start
   time pok --help
   
   # With N commands
   for n in 10 50 100 200; do
     ./scripts/generate-commands.sh $n
     time pok --help
   done
   ```

2. **Command Tree Building**
   ```typescript
   console.time('buildCommandTree');
   const tree = await buildCommandTree(commandsDir, ctx);
   console.timeEnd('buildCommandTree');
   ```

3. **Parallel Task Throughput**
   ```typescript
   const tasks = Array(100).fill(null).map(() => 
     r.exec('sleep 0.1')
   );
   console.time('parallel');
   await r.parallel(tasks, { mode: 'all-settled' });
   console.timeEnd('parallel');
   ```

4. **Memory Usage**
   ```typescript
   // Track heap usage before/after operations
   const before = process.memoryUsage().heapUsed;
   await operation();
   const after = process.memoryUsage().heapUsed;
   console.log(`Memory delta: ${(after - before) / 1024 / 1024}MB`);
   ```

### Metrics to Track
- Time to first byte (help output)
- Command tree build time vs command count
- Memory usage under sustained load
- Parallel task throughput (tasks/second)
- Env resolution latency (with/without cache)

---

## Hypothesis

The current architecture prioritizes developer experience and correctness over raw performance. This is appropriate for the intended use case (internal developer platforms with <100 commands). 

However, implementing parallel command loading and command tree caching would provide:
- 5-10x faster startup for large command sets
- Near-instant repeated startups
- Better scalability to enterprise-scale monorepos

The Bun runtime already provides significant performance advantages (fast startup, native TypeScript support). The recommended optimizations leverage Bun's strengths while addressing the main bottleneck: serial command loading.

## Results

*To be filled upon implementation*

## Evaluation

*To be filled upon completion*
