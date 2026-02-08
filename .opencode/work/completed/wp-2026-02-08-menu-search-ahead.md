# Menu Search-Ahead

## Goal/Problem

When a parent command is invoked interactively, `showParentSubmenu` displays a flat list of child commands via `prompter.select()`. For CLIs with many commands, users must scroll through the full list. There's no way to type-to-filter.

## Scope

- `packages/prompter-clack/src/prompter.ts` — add `autocompleteMultiselect` method
- `packages/core/src/config/prompter.ts` — `Prompter` interface, new `AutocompleteMultiselectOptions`
- `packages/core/src/lib/router.ts` — `showParentSubmenu` (switch to autocompleteMultiselect)
- `packages/core/src/prompter/prompter.raw.ts` — raw prompter (test mock)

## Design

### Upgrade `@clack/prompts`

`@clack/prompts` v1.0.0 ships built-in `autocomplete` and `autocompleteMultiselect` prompts. The project is currently on `^0.11.0`. Upgrading is a prerequisite.

Use `autocompleteMultiselect` — clack's integrated autocomplete multiselect that combines type-ahead filtering with multiselect in one UI:

```ts
import { autocompleteMultiselect } from '@clack/prompts';

const selected = await autocompleteMultiselect({
  message: 'Select commands:',
  options: [
    { value: 'deploy', label: 'deploy - Deploy to production' },
    { value: 'db.migrate', label: 'db migrate - Run migrations' },
    { value: 'dev', label: 'dev - Start development' },
  ],
  placeholder: 'Type to search...',
  maxItems: 10,
});
```

### Prompter interface

Add an `autocompleteMultiselect` method to the `Prompter` interface:

```ts
autocompleteMultiselect<T>(opts: AutocompleteMultiselectOptions<T>): Promise<T[]>;
```

Where `AutocompleteMultiselectOptions` extends `MultiselectOptions` with `placeholder?: string` and `maxItems?: number`.

### Router change

In `showParentSubmenu`, switch from `prompter.select()` to `prompter.autocompleteMultiselect()`. This enables both type-to-filter and multi-command selection (complementing the existing `enableRunAllChildren` concept — users can now pick exactly which commands to run).

When a single command is selected, execute it as today. When multiple are selected, execute them in sequence (or parallel, depending on config).

### Raw prompter

The test mock should handle the new method — it can return pre-configured values like the existing `multiselect` mock.

## Approach

1. Upgrade `@clack/prompts` to `^1.0.0` in `packages/prompter-clack`
2. Check for breaking changes in the upgrade (review clack changelog)
3. Add `autocompleteMultiselect` to the `Prompter` interface with `AutocompleteMultiselectOptions` type
4. Implement in `prompter-clack` using clack's `autocompleteMultiselect`
5. Implement in `prompter.raw.ts` as a passthrough to `multiselect` logic
6. Update `showParentSubmenu` to use the new method
7. Handle single vs multiple selection in router execution
8. Test interactively

## Hypothesis

Clack's built-in `autocompleteMultiselect` provides both search-ahead and batch-selection without needing a custom enquirer plugin. The main risk is the `@clack/prompts` upgrade — v0.11 to v1.0 may have breaking changes.

## Open Questions

- Does the upgrade from `@clack/prompts` 0.11 to 1.0 break the existing reporter-clack or prompter-clack code?
- When multiple commands are selected, should they run in sequence or parallel?
- Should search-ahead always be on, or only when the command list exceeds a threshold?
