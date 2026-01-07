# Ecosystem and Integrations Research

## Problem
pok is designed to be "the TanStack of command line apps" with a goal to "enable agents to discover a codebase's capabilities". However, the current ecosystem integrations are limited. This work package documents research into:
- Current integration capabilities
- Missing integrations
- Opportunities for ecosystem growth
- Ideas for AI/agent support
- Recommendations for priority integrations

## Scope
Research-only. No code changes. Documents current state and recommendations.

## Approach
Thorough analysis of the codebase to understand existing integrations and identify gaps.

## Hypothesis
pok has solid foundations (event-driven architecture, pluggable adapters, type-safe schemas) that can be leveraged for extensive ecosystem integration. The structured event system and Zod schemas provide natural integration points for AI agents.

## Results

### 1. Current Integration Capabilities

#### 1.1 Shell Integration
**Status: Good**
- Shell completion scripts for bash, zsh, fish, and PowerShell (`packages/core/src/lib/completion.ts`)
- Dynamic completion via hidden `__complete` command that introspects the command tree
- Auto-detection of current shell from `$SHELL` environment variable
- Installation instructions generated per shell

**Gaps:**
- No auto-installation of completions
- No shell hook system for directory-based activation
- No aliases file generation

#### 1.2 CI/CD Integration
**Status: Basic**
- Detects CI environment via `CI` env var in output configuration
- Plain mode (`--plain`) for CI-friendly output (ASCII symbols, no spinners)
- `--no-color` flag and `NO_COLOR` env var support (follows https://no-color.org standard)
- `--verbose` mode for streaming all logs immediately

**Gaps:**
- No machine-readable output format (JSON/structured logging)
- No GitHub Actions annotations (`::error::`, `::warning::`)
- No test results format (JUnit XML, TAP)
- No coverage integration
- No artifact upload/caching helpers

#### 1.3 Package Manager Integration
**Status: Good**
- Runtime detection of package manager (`getPackageManager()` in shell utils)
- Bun-first design with `bun create pokit` scaffolding
- Peer dependencies model for adapters

**Gaps:**
- No package.json scripts auto-generation
- No npm/yarn/pnpm workspace awareness
- No version management integration

#### 1.4 Reporter/Output System
**Status: Excellent**
- Event-driven architecture with discriminated union events (`CLIEvent`)
- Pluggable adapter pattern (`ReporterAdapter` interface)
- Three adapters: `reporter-clack` (terminal), `reporter-web` (React), `createRawReporterAdapter` (testing)
- Suspend/resume for TUI takeover
- Log levels: info, warn, error, success, step

**What This Enables:**
- Any output format can be built (JSON, structured logging, metrics)
- Web dashboards (already demonstrated in playground)
- Custom integrations

#### 1.5 Prompter System
**Status: Good**
- Clean `Prompter` interface with select, multiselect, confirm, text
- `createRawPrompter` for testing with pre-configured responses
- Clack-based terminal implementation

**Gaps:**
- No non-interactive mode with defaults/env fallback
- No stdin piping support for scripted usage

#### 1.6 Tabs/TUI Integration
**Status: Good**
- TabsAdapter interface for multi-process TUI
- Two implementations: `tabs-ink` and `tabs-opentui`
- Shared state management in `tabs-core`

#### 1.7 Secrets Management (1Password)
**Status: Good**
- `@pokit/op` package for 1Password CLI integration
- Vault, item, field operations
- Batch operations for efficiency
- Service account token support for CI

**Gaps:**
- No other secret manager adapters (HashiCorp Vault, AWS Secrets Manager, etc.)
- No local-only secret storage option

### 2. Missing Integrations

#### 2.1 AI/Agent Integration (Critical Gap)
**No machine-readable output:**
- CLI events exist but no JSON serializer
- No `--json` flag for structured output
- No command introspection API for agents

**No command schema export:**
- Zod schemas define context but can't be exported as JSON Schema
- No MCP (Model Context Protocol) support
- No OpenAI function calling schema generation
- No Anthropic tool use schema generation

**No agent-friendly discovery:**
- Commands are file-based but not machine-discoverable
- No manifest file describing available commands
- No help text in machine-parseable format

#### 2.2 IDE Integration
**Missing entirely:**
- No VS Code extension
- No Language Server Protocol (LSP) support
- No TypeScript language service plugin
- No command palette integration

**Opportunities:**
- File-based routing enables great IDE navigation
- Zod schemas could power autocomplete
- Pre-flight checks could show as diagnostics

#### 2.3 Logging/Observability
**Basic only:**
- Events exist but no structured logging output
- No OpenTelemetry integration
- No trace ID propagation
- No metrics emission
- No log aggregation support (Datadog, CloudWatch, etc.)

#### 2.4 Popular Tool Integration
**Missing:**
- No Docker integration helpers
- No Kubernetes/kubectl wrappers
- No cloud provider CLIs (AWS, GCP, Azure)
- No Git hooks integration
- No Makefile/Taskfile interop

### 3. Opportunities for Ecosystem Growth

#### 3.1 Machine-Readable Output Layer (Priority: HIGH)
The event system is the perfect foundation:
```typescript
// Example: JSON output adapter
const jsonAdapter = createJsonReporterAdapter({
  stream: process.stdout,
  format: 'ndjson' // or 'json-lines'
});
```

Events would serialize naturally:
```json
{"type":"group:start","id":"g1","label":"Deploy","layout":"sequence","ts":1704067200}
{"type":"activity:start","id":"a1","parentId":"g1","label":"Building...","ts":1704067201}
{"type":"activity:success","id":"a1","ts":1704067205}
{"type":"group:end","id":"g1","ts":1704067206}
```

#### 3.2 Command Schema Export (Priority: HIGH for AI)
```typescript
// New API
const schema = exportCommandSchema(command);
// Returns JSON Schema derived from Zod context definition

const manifest = exportProjectManifest(commandsDir);
// Returns { commands: [...], version: "1.0.0" }
```

This enables:
- AI agents to understand available commands
- IDE extensions to provide autocomplete
- Documentation generation
- Validation tools

#### 3.3 MCP (Model Context Protocol) Server (Priority: HIGH for AI)
pok commands as MCP tools would allow:
- Claude, ChatGPT, and other AI to discover and run commands
- Rich schema information for parameters
- Streaming output for long-running commands

Implementation sketch:
```typescript
// mcp-server.ts
import { createMCPServer } from '@pokit/mcp';
import { buildCommandTree } from '@pokit/core';

const server = createMCPServer({
  commandsDir: './commands',
  transport: 'stdio', // or 'http'
});

// AI can now call:
// - list_commands() -> discover available commands
// - run_command({ name: 'deploy', args: { env: 'prod' } })
// - get_command_schema('deploy') -> JSON Schema for params
```

#### 3.4 Non-Interactive Mode (Priority: MEDIUM)
For scripting and CI:
```bash
# All required values from flags
pok deploy --env prod --yes

# All required values from environment
ENV=prod POK_CONFIRM=yes pok deploy

# Pipe inputs
echo "prod\nyes" | pok deploy
```

#### 3.5 GitHub Actions Integration (Priority: MEDIUM)
```typescript
// @pokit/github-actions
import { createGitHubActionsAdapter } from '@pokit/github-actions';

// Auto-adds:
// - ::group:: / ::endgroup:: for activities
// - ::error:: / ::warning:: for logs
// - Job summaries with markdown
// - Artifact annotations
```

#### 3.6 IDE Extension (Priority: MEDIUM)
VS Code extension could provide:
- Command discovery in Explorer
- "Run Command" code lens on command files
- Autocomplete for flags in terminals
- Pre-flight check diagnostics
- Task integration (`tasks.json` generation)

### 4. Ideas for AI/Agent Support

#### 4.1 Agent Discovery Protocol
```typescript
// New package: @pokit/agent
export interface AgentAdapter {
  // Discover available commands
  listCommands(): Promise<CommandInfo[]>;
  
  // Get detailed command info
  getCommand(path: string): Promise<CommandDetail>;
  
  // Run a command
  run(path: string, args: Record<string, unknown>): AsyncIterable<AgentEvent>;
  
  // Get project context (env, recent runs, etc.)
  getContext(): Promise<ProjectContext>;
}

// CommandInfo includes:
// - path: 'deploy'
// - label: 'Deploy to environment'
// - parameters: JSON Schema
// - preChecks: ['Docker running', '1Password authenticated']
// - examples: ['mycli deploy --env prod']
```

#### 4.2 Structured Event Streaming
```typescript
// For AI agents consuming output
const events = await agent.run('deploy', { env: 'prod' });

for await (const event of events) {
  // event.type: 'started' | 'progress' | 'log' | 'completed' | 'failed'
  // event.data: structured data
}
```

#### 4.3 Introspection API
```typescript
// Expose command tree programmatically
import { introspect } from '@pokit/core';

const project = await introspect('./commands');
console.log(project.commands); // Full tree with schemas
console.log(project.checks);   // All available checks
console.log(project.tasks);    // All defined tasks
```

#### 4.4 Command Documentation Generation
```typescript
// Auto-generate docs from command definitions
import { generateDocs } from '@pokit/docs';

await generateDocs({
  commandsDir: './commands',
  output: './docs/commands',
  format: 'markdown', // or 'json', 'openapi'
});
```

### 5. Recommendations for Priority Integrations

#### Tier 1: Enable AI/Agents (Critical for Goal)
1. **JSON Output Adapter** - Serialize events to NDJSON
2. **Command Schema Export** - Convert Zod schemas to JSON Schema
3. **Introspection API** - Programmatic access to command tree
4. **MCP Server Package** - First-class AI integration

#### Tier 2: Improve CI/CD (High Impact)
5. **GitHub Actions Adapter** - Annotations, groups, summaries
6. **Non-Interactive Mode** - `--yes` flag, env var fallbacks
7. **Exit Code Semantics** - Document and standardize exit codes

#### Tier 3: Developer Experience (Quality of Life)
8. **VS Code Extension** - Command discovery, running, debugging
9. **Shell Hooks** - Auto-activate in project directories
10. **Auto-Completion Install** - One command to set up completions

#### Tier 4: Enterprise Features (Future)
11. **Secret Manager Adapters** - Vault, AWS Secrets Manager, etc.
12. **Audit Logging** - Who ran what, when, with what parameters
13. **Policy Engine** - Restrict commands by environment/user

### 6. Implementation Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| JSON Output Adapter | HIGH | LOW | P0 |
| Command Schema Export | HIGH | MEDIUM | P0 |
| MCP Server | HIGH | MEDIUM | P0 |
| Introspection API | MEDIUM | LOW | P1 |
| GitHub Actions Adapter | MEDIUM | LOW | P1 |
| Non-Interactive Mode | MEDIUM | LOW | P1 |
| VS Code Extension | MEDIUM | HIGH | P2 |
| Shell Hooks | LOW | LOW | P3 |
| Auto-Completion Install | LOW | LOW | P3 |

### 7. Architecture Notes

The existing architecture is well-suited for these extensions:

1. **Event Bus Pattern** - All output goes through events, making new adapters trivial
2. **Adapter Interfaces** - Clean contracts for Reporter, Prompter, Tabs
3. **Zod Schemas** - Type-safe definitions that can be converted to JSON Schema
4. **File-Based Routing** - Commands are discoverable by globbing
5. **Runtime Abstraction** - Bun/Node agnostic patterns

Key insight: Most AI integration work is about **exposing what already exists** rather than building new functionality.

## Evaluation
The hypothesis is confirmed. pok's architecture provides excellent foundations for ecosystem integration:
- Event-driven design makes new output formats trivial
- Zod schemas are perfect for AI tool definitions
- File-based routing enables discovery
- Adapter pattern allows swappable implementations

The main gaps are in the "exposure layer" - making existing capabilities accessible to external tools, especially AI agents. The MCP server pattern appears to be the highest-leverage integration for the stated goal of enabling agents to discover codebase capabilities.

**Recommended First PR:** Add `--json` flag and `createJsonReporterAdapter` that serializes all events to NDJSON. This is the minimum viable AI integration - an agent can parse the output and understand what happened.

**Recommended Second PR:** Add `introspect` function that returns the command tree with JSON Schema representations of each command's context. This enables agents to understand *what commands exist and how to call them*.

**Recommended Third PR:** Create `@pokit/mcp` package implementing the Model Context Protocol, exposing commands as tools. This provides native AI integration for Claude and compatible clients.
