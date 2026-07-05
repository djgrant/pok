# @pokit/reporter-clack

`@pokit/reporter-clack` provides a reporter adapter backed by [@clack/prompts](https://github.com/natemoo-re/clack).

## Installation

```bash
bun add @pokit/reporter-clack
```

## Configuration

```typescript
import { run } from '@pokit/core';
import { createReporterAdapter } from '@pokit/reporter-clack';

await run(args, {
  reporterAdapter: createReporterAdapter(),
  // ...
});
```

## Output rendering

The adapter renders grouped activities, logs, and status output:

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
- **Unicode** - Symbols and box drawing

## API

### createReporterAdapter

```typescript
function createReporterAdapter(): ReporterAdapter;
```

Returns a ReporterAdapter that renders events using Clack.
