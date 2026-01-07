# Testing Infrastructure Research

## Problem

pok needs a thorough assessment of its testing infrastructure to identify gaps, improve test coverage, and enhance the ergonomics of testing for both internal development and users building pok-based CLIs.

## Scope

- `test/` - Integration test suite
- `packages/*/test/` - Package-level tests
- `test/utils/` - Test utilities
- `.github/workflows/` - CI configuration
- `docs/testing.md` - Testing documentation

## Approach

Comprehensive review of existing test infrastructure, identifying coverage gaps, and recommending improvements.

## Hypothesis

The testing infrastructure has solid foundations with good integration test patterns but may have gaps in unit test coverage, edge case testing, and user-facing testing ergonomics.

## Results

### 1. Current Test Coverage Assessment

#### What's Tested

**Core Package (`packages/core/test/`)**
- 21+ test files covering major functionality:
  - `runner.test.ts` - 600+ lines, comprehensive coverage of exec, run, parallel, group, retry functionality
  - `router.test.ts` - Command tree building, help, error handling, alias support
  - `bus.test.ts` - Event bus emit/subscribe patterns
  - `pre-checks.test.ts` - Static, dynamic, and failing pre-flight checks
  - `tasks.test.ts` - Exec and run task execution
  - `errors.test.ts` - Error handling and event emission
  - `dry-run.test.ts` - Dry run pattern utilities
  - `navigation.test.ts` - Menu navigation and breadcrumbs
  - `aliases.test.ts` - Command alias resolution
  - `shell.test.ts` - Shell utilities (commandExists, getVersion, etc.)
  - `args.test.ts` - Argument parsing
  - `help.test.ts` - Help generation
  - `completion.test.ts` - Shell completion
  - `cli-error.test.ts` - CLI error formatting
  - `string-distance.test.ts` - Levenshtein distance for typo suggestions
  - `output-config.test.ts` - Output configuration
  - `reporter.test.ts` - Reporter functionality
  - `commands.test.ts` - Command definition tests
  - `resolver.test.ts` - Environment resolver tests

**Reporter Clack (`packages/reporter-clack/test/`)**
- `adapter.test.ts` - 670+ lines, comprehensive visual output testing
- Virtual terminal snapshot testing pattern
- Tests for sequential groups, parallel groups, log buffering, suspend/resume
- Plain mode and verbose mode testing
- Remediation display testing

**Tabs Core (`packages/tabs-core/test/`)**
- `state-reducer.test.ts` - 616 lines, thorough reducer testing
- `process-manager.test.ts` - Process lifecycle management
- `ring-buffer.test.ts` - Ring buffer data structure

**Create Package (`packages/create/test/`)**
- `create.test.ts` - 320 lines, template generation tests
- `e2e.test.ts` - End-to-end scaffolding tests

**Op Package (`packages/op/test/`)**
- `resolver.test.ts` - 1Password resolver structure tests
- `op.test.ts` - Op integration tests

**Other Packages**
- `packages/prompter-clack/test/prompter.test.ts` - Prompter tests
- `packages/tabs-ink/test/adapter.test.ts` - Ink adapter tests
- `packages/tabs-opentui/test/adapter.test.ts` - OpenTUI adapter tests
- `packages/reporter-web/test/` - Web reporter tests
- `packages/cmd/test/cmd.test.ts` - Global launcher tests

**Integration Tests (`test/`)**
- 19 test cases covering various command scenarios
- Each case has `command.ts`, `events.ts`, and `output.ts` files
- Tests include: simple commands, context, pre-checks, tasks, env tasks, reporters, log levels, activity failures, nested groups, parent-child relationships, run-all patterns, menu navigation, and remediation

### 2. Critical Gaps Identified

#### Missing Unit Test Coverage

1. **Composite Resolver (`lib/resolver.composite.ts`)** - No dedicated tests
2. **CLI Entry Point (`cli.ts`)** - Minimal direct testing
3. **Runtime Detection (`runtime/`)** - Bun vs Node.js runtime code
4. **Prompter Raw (`prompter/prompter.raw.ts`)** - Limited edge case coverage
5. **Tabs Adapter (`tabs/index.ts`)** - Type-only, needs integration tests

#### Missing Edge Case Testing

1. **Concurrent Execution Stress Tests**
   - No tests for many parallel tasks (10+)
   - No memory pressure testing
   - No signal handling race condition tests

2. **Error Recovery Scenarios**
   - Partial failure in `all-settled` mode
   - Retry exhaustion with cleanup
   - AbortSignal during retry delay

3. **Timeout Testing**
   - `TimeoutError` is exported but not directly tested
   - No tests for command timeout configuration

4. **Event Bus Edge Cases**
   - Removing listener during iteration
   - Async listener errors
   - Event ordering under load

#### Missing Integration Patterns

1. **Cross-Package Integration**
   - No tests combining reporter-clack + tabs-ink
   - No tests for full stack (core + all adapters)

2. **Lifecycle Testing**
   - No tests for SIGINT/SIGTERM handling
   - No tests for cleanup on exit

3. **Environment Edge Cases**
   - No CI/TTY detection tests
   - No tests for missing/invalid environment variables

### 3. Test Infrastructure Strengths

1. **Virtual Terminal Pattern** - Excellent for visual output testing
2. **Event Capture Pattern** - Clean integration test model
3. **Fixture-Based Testing** - Good for regression detection
4. **Mock Utilities** - Reusable mocks for checks, resolvers, envs
5. **Normalization** - Stable snapshots across runs
6. **Test Documentation** - `docs/testing.md` is comprehensive

### 4. CI/CD Assessment

**Current Pipeline (`.github/workflows/ci.yml`)**
```yaml
- Check types
- Check formatting  
- Run tests
- Build
```

**Gaps:**
1. No test coverage reporting
2. No parallel test execution
3. No test artifact publishing
4. No matrix testing (different Bun/Node versions)
5. No integration test isolation
6. No smoke test for published packages

### 5. Test Ergonomics for Users

**Strengths:**
- `createRawPrompter` - Excellent mock interface
- `createRawReporterAdapter` - Clean event capture
- `@pokit/test-utils` package - Reusable utilities
- Good documentation in `docs/testing.md`

**Gaps:**
1. No test helper for command definition testing
2. No snapshot helpers for event sequences
3. No debug mode for test failures
4. No example test patterns in `create-pokit` scaffold

## Recommendations

### Priority 1: Critical Coverage

1. **Add TimeoutError tests**
   ```typescript
   it('throws TimeoutError when command exceeds timeout', async () => {
     const runner = createTestRunner({ quiet: true });
     await expect(
       runner.exec('sleep 10', { timeout: 100 })
     ).rejects.toBeInstanceOf(TimeoutError);
   });
   ```

2. **Add composite resolver tests**
   - Test resolver chaining
   - Test fallback behavior
   - Test context merging

3. **Add signal handling tests**
   - SIGINT during task execution
   - SIGTERM cleanup verification
   - AbortController propagation

### Priority 2: CI/CD Improvements

1. **Add coverage reporting**
   ```yaml
   - name: Run tests with coverage
     run: bun test --coverage
   - name: Upload coverage
     uses: codecov/codecov-action@v4
   ```

2. **Add matrix testing**
   ```yaml
   strategy:
     matrix:
       bun-version: ['1.0', '1.1', 'latest']
   ```

3. **Add smoke test job**
   ```yaml
   smoke-test:
     needs: ci
     runs-on: ubuntu-latest
     steps:
       - name: Install from npm
         run: npm create pokit@latest test-project
       - name: Run command
         run: cd test-project && pnpm pok hello
   ```

### Priority 3: User Testing Ergonomics

1. **Add `createTestCommand` helper**
   ```typescript
   import { createTestCommand } from '@pokit/core/testing';
   
   const { run, events, error } = await createTestCommand({
     command: myCommand,
     args: ['--env', 'dev'],
   });
   ```

2. **Add event assertion helpers**
   ```typescript
   expect(events).toHaveEventSequence([
     'group:start',
     'activity:start',
     'activity:success',
     'group:end'
   ]);
   ```

3. **Add scaffold test examples**
   - Include test file in `create-pokit` templates
   - Show testing patterns in example command

### Priority 4: Developer Experience

1. **Add `--watch` mode documentation**
   ```bash
   pok test -- --watch
   ```

2. **Add test debugging guide**
   - How to run single test
   - How to debug event sequences
   - How to generate fixtures

3. **Add visual regression testing**
   - Snapshot reporter output
   - Compare terminal screenshots
   - Detect styling regressions

## Evaluation

The hypothesis was confirmed. pok has a solid testing foundation with:
- Comprehensive integration tests for core flows
- Good patterns for event capture and mocking
- Well-documented testing utilities

Key gaps identified:
1. Missing unit tests for some core modules (composite resolver, runtime)
2. Insufficient edge case and stress testing
3. CI pipeline lacks coverage reporting and matrix testing
4. User-facing test ergonomics could be improved with helpers

The recommendations prioritize coverage gaps first, then CI improvements, then user experience enhancements. Implementation should follow this priority order.
