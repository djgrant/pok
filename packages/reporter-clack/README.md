# @openpok/reporter-clack

Terminal output adapter for pok using [Clack](https://github.com/natemoo-re/clack).

## Installation

```bash
bun add @openpok/reporter-clack
```

## Usage

```typescript
import { run } from '@openpok/core';
import { createReporterAdapter } from '@openpok/reporter-clack';

await run(args, {
  reporterAdapter: createReporterAdapter(),
  // ...
});
```

## Features

- Styled log messages (info, success, warn, error)
- Progress spinners
- Grouped output with collapsible sections
- Activity indicators
- Unicode and ASCII symbol sets

## Options

```typescript
createReporterAdapter({
  plain: false, // Disable colors and spinners
});
```

## Exports

```typescript
// Main adapter
import { createReporterAdapter } from '@openpok/reporter-clack';

// Symbol customization
import { getSymbols, UNICODE_SYMBOLS, ASCII_SYMBOLS } from '@openpok/reporter-clack';
```

## Documentation

See the [full documentation](https://github.com/openpok/pok/blob/main/docs/packages/reporter-clack.md).
