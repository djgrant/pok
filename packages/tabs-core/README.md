# @pokjs/tabs-core

Shared logic for pok tabbed terminal UI adapters.

## Purpose

This package provides framework-agnostic types, state management, and process handling used by tabs adapter implementations like `@pokjs/tabs-ink`.

## Installation

```bash
bun add @pokjs/tabs-core
```

Note: This is typically a dependency of adapter packages, not installed directly.

## Exports

### State Management

```typescript
import { createInitialState, reducer } from '@pokjs/tabs-core';
```

### Process Manager

```typescript
import { ProcessManager } from '@pokjs/tabs-core';
```

### Types

```typescript
import type { TabStatus, TabProcess, EventDrivenState } from '@pokjs/tabs-core';
```

### Status Indicators

```typescript
import { STATUS_INDICATORS, getStatusIndicator } from '@pokjs/tabs-core';
```

## Documentation

See the [full documentation](https://github.com/openpok/pok/blob/main/docs/packages/tabs-core.md).
