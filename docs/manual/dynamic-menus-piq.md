# Dynamic Menus with piq

This guide shows practical patterns for driving pok dynamic menus from piq queries.

## The provider contract

A dynamic `select` takes a `provider`: a single async function that receives the
current type-ahead `filter` and an `AbortSignal`, and resolves to the **full
array** of options to display. The UI adapter owns loading, debounce, and
filtering presentation — those are not part of the contract.

```typescript
type OptionsProvider<T> = (
  filter: string | undefined,
  signal: AbortSignal
) => Promise<SelectOption<T>[]>;

type SelectOption<T> = {
  value: T;
  label: string;
  hint?: string;
  group?: string; // optional visual grouping
};
```

For piq markdown resolvers, use the current namespaces: `params.*`,
`frontmatter.*`, `body.*`.

## Prerequisites

- pok dynamic menus (`provider` on `prompter.select()`)
- piq collection/resolver configured in your app

## Basic: Collection to Menu

```typescript
import { piq } from 'piqit';
import type { OptionsProvider } from '@pokit/core';

const postsProvider: OptionsProvider<string> = async (filter, signal) => {
  const results = await piq
    .from(posts)
    .scan({})
    .select('params.slug', 'frontmatter.title', 'params.year')
    .exec();

  return results.map((r) => ({
    value: r.slug,
    label: r.title ?? r.slug,
    hint: r.year,
  }));
};

const selected = await prompter.select({
  message: 'Select a post to edit',
  provider: postsProvider,
});
```

## Typeahead: Server-Side Filtering

The provider is re-invoked with the current `filter`. Use piq's `scan()` for param
constraints and `filter()` for frontmatter constraints, and forward the `signal`
so in-flight queries are cancelled.

```typescript
import { piq } from 'piqit';
import type { OptionsProvider } from '@pokit/core';

const filterableProvider: OptionsProvider<string> = async (filter, signal) => {
  const query = piq.from(posts).scan({});

  if (filter) {
    query.scan({ tag: filter });
  }

  const results = await query
    .select('params.slug', 'params.tag', 'frontmatter.title')
    .exec();

  return results.map((r) => ({
    value: r.slug,
    label: r.title ?? r.slug,
    hint: r.tag,
  }));
};

const selected = await prompter.select({
  message: 'Search posts by tag',
  provider: filterableProvider,
});
```

Frontmatter-driven filter example:

```typescript
type PostStatus = 'draft' | 'published' | 'archived';

const statusFilterProvider: OptionsProvider<string> = async (filter) => {
  const query = piq.from(posts).scan({});

  if (filter && ['draft', 'published', 'archived'].includes(filter)) {
    query.filter({ status: filter as PostStatus });
  }

  const results = await query
    .select('params.slug', 'frontmatter.title', 'frontmatter.status')
    .exec();

  return results.map((r) => ({
    value: r.slug,
    label: r.title ?? r.slug,
    hint: r.status,
  }));
};
```

## Grouping

Use the `group` field to visually cluster options (like an `<optgroup>`):

```typescript
const groupedProvider: OptionsProvider<string> = async () => {
  const rows = await piq
    .from(posts)
    .scan({})
    .select('params.slug', 'frontmatter.title', 'params.year')
    .exec();

  return rows.map((r) => ({
    value: r.slug,
    label: r.title ?? r.slug,
    group: r.year, // options with the same group render together
  }));
};
```

## Layered Resolution Pattern

Load only what the menu needs. Pull heavier fields later, after selection.

```typescript
const selected = await prompter.select({
  message: 'Select a post',
  provider: async () => {
    const rows = await piq
      .from(posts)
      .scan({ year: '2026' })
      .select('params.slug', 'frontmatter.title')
      .exec();

    return rows.map((r) => ({ value: r.slug, label: r.title ?? r.slug }));
  },
});

// Follow-up query: heavier body fields only for the selected row
const post = await piq
  .from(posts)
  .scan({ slug: selected })
  .select('params.slug', 'frontmatter.title', 'body.html', 'body.headings')
  .single()
  .exec();
```

## Hierarchical Menus from Path Params

```typescript
const categoryProvider: OptionsProvider<string> = async () => {
  const rows = await piq.from(docs).scan({}).select('params.category').exec();
  const categories = [...new Set(rows.map((r) => r.category))];

  return categories.map((category) => ({
    value: category,
    label: category.replace(/-/g, ' '),
  }));
};

const docsInCategoryProvider =
  (category: string): OptionsProvider<string> =>
  async () => {
    const rows = await piq
      .from(docs)
      .scan({ category })
      .select('params.slug', 'frontmatter.title')
      .exec();

    return rows.map((r) => ({ value: r.slug, label: r.title ?? r.slug }));
  };
```

## Error Handling

A provider that throws surfaces the configured `errorMessage`. Return a sentinel
option for the empty case:

```typescript
const resilientProvider: OptionsProvider<string> = async () => {
  const rows = await piq
    .from(posts)
    .scan({})
    .select('params.slug', 'frontmatter.title')
    .exec();

  if (rows.length === 0) {
    return [{ value: '__empty__', label: 'No posts found', hint: 'Create a post first' }];
  }

  return rows.map((r) => ({ value: r.slug, label: r.title ?? r.slug }));
};
```

## Pagination

The prompter provider resolves the full option set in one call; the UI adapter
handles scrolling. If a data source is genuinely paginated, page through it
inside the provider before returning, or use **command-level `resolve()`** on a
context field, which additionally accepts a single page (`{ options, nextCursor }`)
or an async iterator of pages. See [defineCommand](../api/define-command.md).

## Related

- [Prompter API](../api/prompter.md)
- piq API reference (`piq/docs/reference/api.md` in the piq repo)
