# Creating a Standalone CLI

While `pok` provides a global launcher for quick scripts, you can also use `@pokit/core` to build and distribute your own standalone CLI applications with their own binary name (e.g., `my-tool`).

## 1. Project Setup

Create a new directory for your CLI and initialize it:

```bash
mkdir my-tool && cd my-tool
bun init -y
```

Install the core framework and adapters:

```bash
bun add @pokit/core zod @pokit/prompter-clack @pokit/reporter-clack
```

## 2. Create the Entry Point

Create a `bin/cli.ts` file. This will be the main script your users run.

```typescript
#!/usr/bin/env bun
import { runCli } from '@pokit/core';
import { createPrompter } from '@pokit/prompter-clack';
import { createReporterAdapter } from '@pokit/reporter-clack';
import * as path from 'path';

// Get the directory where this script is located
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const projectRoot = path.resolve(__dirname, '..');

await runCli(process.argv.slice(2), {
  appName: 'my-tool',
  version: '1.0.0',
  // Point to your commands directory
  commandsDir: path.join(projectRoot, 'commands'),
  projectRoot: projectRoot,
  // Attach adapters
  prompter: createPrompter(),
  reporterAdapter: createReporterAdapter(),
});
```

Make it executable:

```bash
chmod +x bin/cli.ts
```

## 3. Define Commands

Create a `commands/` directory and add your first command:

```typescript
// commands/hello.ts
import { defineCommand } from '@pokit/core';

export const command = defineCommand({
  label: 'Say hello',
  run: async (r) => {
    r.reporter.info('Hello from my standalone tool!');
  },
});
```

## 4. Configure Package Distribution

Add a `bin` field to your `package.json` so users can install it globally or run it via package managers.

```json
{
  "name": "my-tool",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "my-tool": "./bin/cli.ts"
  },
  "dependencies": {
    "@pokit/core": "latest",
    "@pokit/prompter-clack": "latest",
    "@pokit/reporter-clack": "latest"
  }
}
```

## 5. Distribution

### Via NPM/Registry
Publish your package to an NPM-compatible registry:

```bash
npm publish
```

Your users can then install and run it:
```bash
npm install -g my-tool
my-tool hello
```

### As a Standalone Binary
You can use Bun to compile your CLI into a single, zero-dependency executable for distribution:

```bash
# Compile for the current platform
bun build ./bin/cli.ts --compile --outfile my-tool

# Or cross-compile for other platforms
bun build ./bin/cli.ts --compile --target=bun-linux-x64 --outfile my-tool-linux
```

Your users can now run the `my-tool` binary directly without needing Bun or Node.js installed.
