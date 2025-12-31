# @pokit/reporter-clack

Terminal output adapter using [@clack/prompts](https://github.com/natemoo-re/clack).

## Installation

```bash
bun add @pokit/reporter-clack
```

## Usage

```typescript
import { run } from '@pokit/core';
import { createReporterAdapter } from '@pokit/reporter-clack';

await run(args, {
  reporterAdapter: createReporterAdapter(),
  // ...
});
```

## What It Provides

Structured, beautiful terminal output:

```
◆  Build
│
│  ◇  Compile TypeScript
│  ◇  Bundle with esbuild
│  ◇  Generate types
│
└  Build complete!

ℹ  Deploying to staging...

◆  Deploy
│
│  ◇  Upload assets
│  ◇  Update configuration
│  ◇  Verify deployment
│
└  Deployed successfully!
```

## Output Types

### Logs

```
ℹ  Information message
⚠  Warning message
✖  Error message
✔  Success message
→  Step message
```

### Groups

```
◆  Group Label
│
│  ◇  Activity 1
│  ◇  Activity 2
│
└  Group complete
```

### Activities (with spinners)

```
◆  Building
│
│  ◓  Compiling...        (spinning)
│  ◇  Bundle complete     (done)
│  ✖  Tests failed        (failed)
```

### Nested Groups

```
◆  Deploy
│
│  ◆  Build
│  │  ◇  Compile
│  │  ◇  Bundle
│  └
│
│  ◆  Upload
│  │  ◇  Assets
│  │  ◇  Config
│  └
│
└  Deploy complete
```

## Event Handling

The adapter subscribes to CLI events:

| Event              | Rendering                    |
| ------------------ | ---------------------------- |
| `group:start`      | Opens a group box with intro |
| `group:end`        | Closes the group with outro  |
| `activity:start`   | Shows spinner                |
| `activity:success` | Shows checkmark              |
| `activity:failure` | Shows X mark                 |
| `log`              | Prints styled message        |
| `reporter:suspend` | Pauses output                |
| `reporter:resume`  | Resumes output               |

## Features

- **Spinners** - Animated activity indicators
- **Structured output** - Visual hierarchy with boxes
- **Colors** - Semantic coloring (success=green, error=red)
- **Unicode** - Beautiful symbols and box drawing

## API

### createReporterAdapter

```typescript
function createReporterAdapter(): ReporterAdapter;
```

Returns a ReporterAdapter that renders events using Clack.

## Related

- [API Reference: Events](../api/events.md)
- [@pokit/core](./core.md)
