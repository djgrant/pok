# Documentation and Onboarding Research

## Problem

pok aims to "reduce onboarding time" and "reduce developer friction" but the documentation and onboarding experience needs evaluation to identify gaps, friction points, and opportunities for improvement.

## Scope

- `/docs/**/*.md` - All documentation
- `/packages/*/README.md` - Package documentation
- `/README.md` - Main repository README
- `/playground/` - Interactive learning environment
- `/packages/create/` - Project scaffolding

## Approach

Comprehensive review of all documentation from the perspective of new users at different experience levels:
1. Complete beginner to CLI frameworks
2. Experienced developer new to pok
3. Developer migrating from another CLI framework

## Hypothesis

The documentation is well-structured but has gaps in progressive learning paths, real-world examples, and API completeness that could be addressed to improve developer onboarding.

## Results

### Current State Assessment

#### Strengths

1. **Excellent Architecture Documentation**
   - `docs/architecture.md` provides a clear system overview with ASCII diagrams
   - Event-driven design is well-explained
   - Package relationships are clearly documented

2. **Comprehensive Concept Documentation**
   - `docs/concepts/` covers commands, tasks, checks, environments, events, and dry-run patterns
   - Each concept has deep-dive documentation with patterns and best practices
   - Good coverage of advanced patterns (dynamic checks, environment resolution, etc.)

3. **Strong API Reference**
   - All major APIs documented: `defineCommand`, `defineTask`, `defineEnv`, `defineCheck`, `Runner`
   - Type signatures are included
   - Configuration options are tabulated

4. **Good Getting Started Guide**
   - Clear prerequisites (Bun >= 1.0.0)
   - Two paths: new project and existing project
   - First command example is simple and functional
   - Progressive examples (context, exec, groups)

5. **Package Documentation**
   - Each package in `/docs/packages/` has dedicated documentation
   - Installation instructions are consistent
   - Usage examples provided

6. **Interactive Playground**
   - WebContainer-based browser terminal
   - Tutorial system with structured lessons
   - File creation and command execution built-in
   - Good SPEC.md defining the design philosophy

---

### Gaps Identified

#### 1. **README Inconsistencies and Drift**

| Package | Issue |
|---------|-------|
| `@pokit/core` README | References `tty: createTTYAdapter()` but actual API uses separate `prompter`, `reporterAdapter`, `tabs` |
| `@pokit/core` README | Shows utilities like `info, success, done, warn, error, step, dim, header, divider` that may not exist or differ from actual API |
| `@pokit/core` README | References `createRunner` but router docs show `run()` as the entry point |
| Package READMEs | Most are thin pointers to docs rather than self-contained references |

**Recommendation**: Audit and synchronize package READMEs with actual API. Consider using API extraction to auto-generate.

#### 2. **Missing Migration/Comparison Guide**

There's no documentation helping users coming from:
- Commander.js
- Yargs
- Oclif
- CAC

**Recommendation**: Create `/docs/migration/` or `/docs/comparisons/` showing how pok concepts map to familiar patterns.

#### 3. **No Cookbook/Recipes Section**

Common use cases lack documented solutions:
- Building a deployment CLI
- Creating a database migration tool
- Setting up a monorepo CLI
- Integrating with 1Password/Vault/AWS Secrets Manager
- CI/CD integration patterns
- Multi-environment configuration

**Recommendation**: Create `/docs/recipes/` or `/docs/cookbook/` with complete, copy-paste examples.

#### 4. **Playground Tutorial Gaps**

Current playground tutorial covers only:
1. Creating a simple command
2. Adding flags/validation
3. Understanding tasks (code display only, no hands-on)
4. Free exploration

Missing tutorials:
- Pre-flight checks
- Environment/secrets management
- Tabbed terminals
- Parent commands and subcommands
- Testing commands

**Recommendation**: Expand playground lessons to cover the full feature set.

#### 5. **No Troubleshooting Guide**

Common issues not documented:
- "Command not found" after installation
- TypeScript configuration issues
- Bun vs Node compatibility
- Shell completion setup failures
- WebContainer browser limitations (Safari)

**Recommendation**: Create `/docs/troubleshooting.md` or FAQ section.

#### 6. **API Documentation Gaps**

| Missing Documentation | Impact |
|----------------------|--------|
| `@pokit/op` package | No docs at all - users don't know it exists or what it does |
| `@pokit/tabs-opentui` | No docs - unclear when to use vs tabs-ink |
| Composite resolvers | `defineCompositeResolver` mentioned but not thoroughly documented |
| Retry configuration | Documented in API but lacks real-world usage examples |
| `extraArgs` usage | Mentioned but not explained with examples |

**Recommendation**: Fill these documentation gaps with dedicated pages.

#### 7. **No Video/Interactive Content Links**

- No YouTube tutorials or screencasts
- No embedded demos in docs
- No GIFs showing terminal output
- Playground is separate from docs site

**Recommendation**: Add visual content and/or embed playground in docs.

#### 8. **Testing Documentation is Test-Centric**

`docs/testing.md` focuses on testing pok applications but doesn't explain:
- How to test your own commands
- Mocking external services
- Integration testing patterns
- CI pipeline setup

**Recommendation**: Expand testing docs with practical testing patterns.

#### 9. **No Contribution Guide**

Missing:
- How to contribute to pok
- Development setup
- Architecture decisions
- Package structure explanation for contributors

**Recommendation**: Add `CONTRIBUTING.md` and `/docs/contributing/`.

#### 10. **Scaffolding Creates Minimal Project**

`create-pokit` generates:
```
commands/
  hello.ts
  build.ts
pok
package.json
tsconfig.json
.gitignore
```

Missing from scaffolded project:
- Example with context/flags
- Example pre-flight check
- Example task
- README with next steps
- `.env.example` template

**Recommendation**: Enhance create-pokit templates to be more educational.

---

### Onboarding Friction Points

1. **Package Selection Confusion**
   - Users must understand prompter vs reporter vs tabs
   - "Starter" template doesn't include tabs-ink
   - No clear guidance on when tabs are needed

2. **Bun Requirement**
   - Hard dependency on Bun not emphasized enough
   - No graceful degradation for Node.js-only environments

3. **Entry Point Complexity**
   The entry point requires understanding multiple concepts:
   ```typescript
   await run(process.argv.slice(2), {
     commandsDir: path.resolve(import.meta.dir, 'commands'),
     projectRoot: path.resolve(import.meta.dir),
     appName: 'mycli',
     prompter: createPrompter(),
     reporterAdapter: createReporterAdapter(),
     tabs: createTabsAdapter(),
   });
   ```
   This is a lot for a "Quick Start"

4. **Zod Requirement Not Clear**
   - Zod v4 is mentioned in agents.md but not prominently in docs
   - Users may install wrong Zod version

5. **No npx/bunx Support Out of Box**
   - Getting started requires `chmod +x` and relative paths
   - No npm scripts configured for common patterns

---

### Recommendations Summary

#### High Priority

1. **Create Cookbook/Recipes** - Real-world examples users can adapt
2. **Fix README Drift** - Synchronize package READMEs with actual APIs  
3. **Add Troubleshooting** - Common issues and solutions
4. **Document @pokit/op** - Missing package documentation

#### Medium Priority

5. **Expand Playground Tutorials** - Cover more features hands-on
6. **Migration Guides** - Help users from other frameworks
7. **Enhance Scaffolding** - More educational starter project
8. **Add Visual Content** - GIFs, videos, or embedded playground

#### Lower Priority

9. **Contribution Guide** - Help potential contributors
10. **Testing Patterns** - More practical testing examples
11. **CLI Reference** - Auto-generated from types

---

### Recommended Documentation Structure

```
docs/
├── index.md                    # Landing page
├── getting-started.md          # Installation and first command
├── architecture.md             # System overview
├── terminal-requirements.md    # TTY compatibility
├── cli-flags.md               # Global flags reference
├── testing.md                 # Testing guide
├── troubleshooting.md         # NEW: Common issues
├── api/                       # API Reference
│   ├── define-command.md
│   ├── define-task.md
│   ├── define-env.md
│   ├── define-check.md
│   ├── runner.md
│   ├── router.md
│   ├── events.md
│   ├── prompter.md
│   ├── tabs.md
│   └── completion.md
├── concepts/                  # Deep dives
│   ├── commands.md
│   ├── tasks.md
│   ├── checks.md
│   ├── environments.md
│   ├── events.md
│   └── dry-run.md
├── packages/                  # Package docs
│   ├── core.md
│   ├── create.md
│   ├── op.md                 # NEW
│   ├── prompter-clack.md
│   ├── reporter-clack.md
│   ├── tabs-core.md
│   ├── tabs-ink.md
│   └── tabs-opentui.md       # NEW
├── recipes/                   # NEW: Cookbook
│   ├── deployment-cli.md
│   ├── database-migrations.md
│   ├── monorepo-cli.md
│   ├── secrets-management.md
│   └── ci-integration.md
├── migration/                 # NEW: Migration guides
│   ├── from-commander.md
│   ├── from-yargs.md
│   └── from-oclif.md
└── contributing/              # NEW: Contributor docs
    ├── development-setup.md
    └── architecture-decisions.md
```

---

### Ideas for Better Learning Resources

1. **Interactive Playground in Docs**
   - Embed playground iframe in relevant doc pages
   - "Try it" buttons that pre-populate examples

2. **Progressive Tutorial Path**
   - "Build a real CLI" end-to-end tutorial
   - Takes user from zero to published npm package

3. **Video Walkthroughs**
   - 5-minute getting started video
   - Feature-specific deep dives
   - "Building X with pok" series

4. **Example Repository**
   - Separate repo with complete, maintained examples
   - Reference implementations for common patterns
   - CI that validates examples still work

5. **API Playground**
   - Interactive type explorer
   - Show inferred types as you build commands

6. **Discord/Community**
   - Community for questions and sharing
   - Showcase gallery of pok-built CLIs

## Evaluation

The documentation is fundamentally solid with good coverage of core concepts and architecture. The main gaps are:

1. **Practical content** - Recipes, real-world examples, migration guides
2. **Completeness** - Missing package docs (@pokit/op, tabs-opentui)
3. **Synchronization** - README drift from actual APIs
4. **Progressive learning** - Playground covers basics but not full feature set
5. **Onboarding polish** - Scaffolding could be more educational

The hypothesis was validated: documentation structure is good but practical gaps exist that create friction for new users.
