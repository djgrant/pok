# @openpok/tabs-core

Shared logic for pok tabbed terminal UI adapters.

## Purpose

This package provides framework-agnostic types, state management, and process handling used by tabs adapter implementations like `@openpok/tabs-ink`.

## Installation

```bash
bun add @openpok/tabs-core
```

Note: This is typically a dependency of adapter packages, not installed directly.

## Exports

### State Management

```typescript
import { createInitialState, reducer } from '@openpok/tabs-core';
```

### Process Manager

```typescript
import { ProcessManager } from '@openpok/tabs-core';
```

### Types

```typescript
import type { TabStatus, TabProcess, EventDrivenState } from '@openpok/tabs-core';
```

### Status Indicators

```typescript
import { STATUS_INDICATORS, getStatusIndicator } from '@openpok/tabs-core';
```

## Documentation

See the [full documentation](https://github.com/openpok/pok/blob/main/docs/packages/tabs-core.md).
