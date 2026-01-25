# Security Research: pok Framework

## Problem

pok states goals of "enforcing security on developer machines" and "falling into the pit of success" for security. This research evaluates the current security posture and identifies gaps between these goals and the implementation.

## Scope

- `packages/core/src/` - Core execution, validation, command routing
- `packages/op/` - 1Password integration for secrets
- Runtime implementations (Bun/Node)
- Input validation, shell execution, environment handling

## Current Security Posture Assessment

### 1. Input Validation ✅ Strengths

**What's good:**

- All command arguments are validated through Zod schemas (`packages/core/src/lib/args.ts`)
- Context definitions enforce type validation at runtime
- Unknown flags are rejected with helpful error messages
- Typo detection suggests valid alternatives

**Evidence:**

```typescript
// From args.ts:396-404
const result = fieldDef.schema.safeParse(value);
if (!result.success) {
  const choicesMsg = info.choices ? ` Valid: ${info.choices.join(', ')}` : '';
  throw createError(
    `Invalid value for --${flagName}: ${value}.${choicesMsg}`,
    contextDef,
    errorContext
  );
}
```

### 2. Shell Execution ⚠️ Mixed

**Three execution modes with different security profiles:**

1. **String form** (vulnerable): Passed directly to `sh -c`
   ```typescript
   // runner.ts:625-654
   const proc = runtime.spawn(['sh', '-c', finalCmd], {...});
   ```
2. **Array form** (safe): Bypasses shell entirely

   ```typescript
   // runner.ts:599-623
   const proc = runtime.spawn(cmd, {...});  // No shell interpolation
   ```

3. **Bun shell template** (safe): Automatic escaping via `$`

**Issue:** String form is the most convenient but most dangerous. Documentation exists in comments but users may not realize the injection risk.

**Shell escaping exists but is opt-in:**

```typescript
// runtime/node.ts:134-136
const escapeShell = (str: string): string => {
  return `'${str.replace(/'/g, "'\\''")}'`;
};
```

### 3. Environment Variables & Secrets ✅ Good

**1Password integration provides secure secret management:**

- Secrets are fetched on-demand, not stored in environment files
- Vault references use validated identifier patterns (`op.ts:11`)
- Input validation rejects shell metacharacters

```typescript
// op.ts:11
const VALID_IDENTIFIER_PATTERN = /^[a-zA-Z0-9 _.-]+$/;
```

**Environment variable handling:**

- Env vars are cached in memory during task execution
- Variables are resolved through typed resolvers with Zod validation
- Write operations validate against declared variables only

**Gap:** No mechanism to prevent secrets from being logged or leaked to stdout.

### 4. File System Access ❌ No Controls

**Current state:**

- No file system sandboxing
- Commands can access any file the process can access
- No allowlist/denylist for paths
- No read-only mode for dry-run

### 5. Permission/Capability Model ❌ Not Implemented

**Current state:**

- No permission model for commands
- No capability restrictions
- All commands have equal privileges
- No concept of "dangerous" operations

### 6. Audit Logging ❌ Not Implemented

**Current state:**

- Event system exists but is for UI rendering only
- No security-focused logging
- No record of executed commands or accessed secrets
- No audit trail capability

**Event types available (events/types.ts):**

- `root:start`, `root:end`
- `group:start`, `group:end`
- `activity:start`, `activity:success`, `activity:failure`
- `log` (info, warn, error, success, step)

These are purely for UI feedback, not security auditing.

### 7. Dependency Security ❌ No Formal Process

**Current state:**

- No security audit policy documented
- No automated vulnerability scanning (no Dependabot, Snyk, etc.)
- No lockfile integrity checking beyond pnpm
- Dependencies are minimal, which is good:
  - `@pokit/core`: only `fast-glob`
  - `@pokit/op`: only `@pokit/core`

### 8. Dry Run Mode ✅ Good Foundation

**What exists:**

- `dryRunContext` helper for adding --dry-run flag
- `createDryRunReporter` for dry-run output
- Pattern for "show what would happen"

**Gap:** Dry run is advisory only - commands must manually implement it. Nothing prevents actual execution.

## Approach

This research identifies security gaps and proposes a prioritized improvement plan.

## Hypothesis

pok has good foundations (Zod validation, 1Password integration) but lacks security-focused features that would fulfill its stated goals of "enforcing security on developer machines."

## Results

### Critical Gaps Identified

1. **Shell Injection Risk (High)**
   - String-form `r.exec()` allows injection
   - Users must know to use array form for dynamic input
   - No linting/warning for dangerous patterns

2. **No Command Permissions (Medium-High)**
   - All commands are equal
   - No way to mark commands as "destructive"
   - No confirmation requirements for production operations

3. **No Audit Trail (Medium)**
   - Security-critical operations aren't logged
   - Secret access isn't tracked
   - No forensic capability

4. **No Secret Leak Prevention (Medium)**
   - Secrets can be logged to stdout/stderr
   - No redaction in error messages
   - No protection against accidental exposure

5. **No File System Boundaries (Low-Medium)**
   - Commands can access any file
   - No project root enforcement
   - No read-only mode

### Recommendations

#### Priority 1: Prevent Shell Injection (Short Term)

1. **Deprecate string-form `r.exec()` for dynamic content**
   - Add runtime warning when string contains variables
   - Document the risk prominently
   - Consider making array form the default in examples

2. **Add shell injection linting**
   - ESLint rule to warn on string template literals in exec
   - Suggest array form or `$` template

3. **Provide safer helpers**
   ```typescript
   // Instead of r.exec(`git checkout ${branch}`)
   r.git.checkout(branch); // Type-safe, pre-escaped
   ```

#### Priority 2: Add Command Permission Model (Medium Term)

1. **Define permission levels**

   ```typescript
   defineCommand({
     label: 'Deploy to production',
     permissions: {
       level: 'destructive', // 'read-only' | 'write' | 'destructive'
       requiresConfirmation: true,
       environments: ['prod'],
     },
   });
   ```

2. **Automatic confirmation prompts**
   - Commands marked `destructive` require explicit confirmation
   - Different confirmation for different environments

3. **Permission inheritance**
   - Tasks inherit minimum permissions from commands
   - Env writes require 'write' permission

#### Priority 3: Secret Protection (Medium Term)

1. **Secret redaction in output**

   ```typescript
   // Automatically redact resolved secrets in logs
   reporter.info(message); // Secrets replaced with ***
   ```

2. **Secure string wrapper**

   ```typescript
   type SecureString = { toString: () => '[REDACTED]'; value: () => string };
   ```

3. **Secret access logging**
   ```typescript
   // Emit audit event when secrets are accessed
   eventBus.emit({ type: 'security:secret-access', key: 'POSTGRES_URL' });
   ```

#### Priority 4: Audit Logging (Medium Term)

1. **Add security event types**

   ```typescript
   type SecurityEvent =
     | { type: 'security:command-start'; command: string; user: string }
     | { type: 'security:secret-access'; key: string }
     | { type: 'security:exec'; command: string; cwd: string }
     | { type: 'security:file-write'; path: string };
   ```

2. **Audit adapter interface**

   ```typescript
   interface AuditAdapter {
     log(event: SecurityEvent): void | Promise<void>;
   }
   ```

3. **Optional file-based audit log**
   - JSON-L format for easy parsing
   - Configurable retention

#### Priority 5: File System Boundaries (Long Term)

1. **Project root enforcement**

   ```typescript
   defineCommand({
     sandbox: {
       root: 'project', // Can only access project files
       allowlist: ['/tmp'], // Additional allowed paths
     },
   });
   ```

2. **Read-only mode for dry-run**
   - Intercept file writes in dry-run mode
   - Report what would be written

#### Priority 6: Dependency Security (Ongoing)

1. **Add security scanning**
   - Enable Dependabot or Renovate
   - Add `npm audit` / `bun audit` to CI

2. **Document security policy**
   - SECURITY.md with disclosure process
   - Supported versions
   - Security update policy

### Quick Wins (Can Implement Now)

1. **Add security section to docs**
   - Document safe vs unsafe exec patterns
   - Best practices for secret handling

2. **Add warning in string exec**

   ```typescript
   if (typeof cmd === 'string' && cmd.includes('$')) {
     reporter.warn('Using string exec with variables may be unsafe. Consider array form.');
   }
   ```

3. **Export safe exec helper**
   ```typescript
   export function safeExec(cmd: string, args: string[]): ExecInput {
     return [cmd, ...args]; // Forces array form
   }
   ```

### Security Feature Comparison

| Feature           | Current        | Recommended              |
| ----------------- | -------------- | ------------------------ |
| Input Validation  | ✅ Zod schemas | Keep                     |
| Shell Escaping    | ⚠️ Opt-in      | Make default             |
| Secret Management | ✅ 1Password   | Add leak prevention      |
| Permission Model  | ❌ None        | Add destructive/readonly |
| Audit Logging     | ❌ None        | Add security events      |
| File Sandboxing   | ❌ None        | Add project boundaries   |
| Dependency Audit  | ❌ None        | Add to CI                |

## Evaluation

pok has solid foundations for security but significant gaps remain before it can claim to "enforce security on developer machines." The design principle of "falling into the pit of success" is partially achieved through Zod validation but not for shell execution, which is the most dangerous surface area.

**Recommended implementation order:**

1. Documentation updates (immediate)
2. Shell injection warnings (immediate)
3. Command permissions (next release)
4. Secret redaction (next release)
5. Audit logging (future)
6. File sandboxing (future)

The 1Password integration is a strong security feature that sets pok apart from other CLI frameworks. Building on this foundation with additional security features would create a genuinely security-first CLI framework.
