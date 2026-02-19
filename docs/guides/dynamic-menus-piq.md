# Dynamic Menus with piq

This guide shows practical patterns for driving pok dynamic menus from piq queries.

The key contract is:

- `scan()` narrows by path params (cheap)
- `filter()` narrows by frontmatter fields (metadata read)
- `select()` declares exactly what fields are returned

For markdown resolvers, use current piq namespaces:

- `params.*`
- `frontmatter.*`
- `body.*`

## Prerequisites

- pok dynamic menus (`provider` on `prompter.select()`)
- piq collection/resolver configured in your app

## Basic: Collection to Menu

```typescript
import { piq } from 'piqit';
import type { OptionsProvider } from '@pokit/core';

const postsProvider: OptionsProvider<string> = async () => {
  const results = await piq
    .from(posts)
    .scan({})
    .select('params.slug', 'frontmatter.title', 'params.year')
    .exec();

  return {
    options: results.map((r) => ({
      value: r.slug,
      label: r.title ?? r.slug,
      hint: r.year,
    })),
  };
};

const selected = await prompter.select({
  message: 'Select a post to edit',
  provider: postsProvider,
});
```

## Paginated: Cursor-Based Loading

```typescript
import { piq } from 'piqit';
import type { OptionsProvider } from '@pokit/core';

const PAGE_SIZE = 25;

const paginatedProvider: OptionsProvider<string> = async ({ cursor }) => {
  const results = await piq
    .from(posts)
    .scan({})
    .select('params.slug', 'frontmatter.title')
    .exec();

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const page = results.slice(offset, offset + PAGE_SIZE);
  const hasMore = offset + PAGE_SIZE < results.length;

  return {
    options: page.map((r) => ({
      value: r.slug,
      label: r.title ?? r.slug,
    })),
    nextCursor: hasMore ? String(offset + PAGE_SIZE) : undefined,
    totalCount: results.length,
  };
};
```

## Typeahead: Server-Side Filtering

When the provider supports filtering, use piq's `scan()` for param constraints and `filter()` for frontmatter constraints.

```typescript
import { piq } from 'piqit';
import { withCapabilities, type OptionsProvider } from '@pokit/core';

type PostParams = { tag: string; slug: string };
type PostFrontmatter = { title: string; status: 'draft' | 'published' | 'archived' };

const filterableProvider: OptionsProvider<string> = withCapabilities(
  async ({ filter }) => {
    const query = piq.from(posts).scan({});

    if (filter) {
      query.scan({ tag: filter });
    }

    const results = await query
      .select('params.slug', 'params.tag', 'frontmatter.title')
      .exec();

    return {
      options: results.map((r) => ({
        value: r.slug,
        label: r.title ?? r.slug,
        hint: r.tag,
      })),
    };
  },
  { supportsFilter: true, filterDebounceMs: 150 }
);

const selected = await prompter.select({
  message: 'Search posts by tag',
  provider: filterableProvider,
});
```

Frontmatter-driven filter example:

```typescript
const statusFilterProvider = withCapabilities(
  async ({ filter }) => {
    const query = piq.from(posts).scan({});

    if (filter && ['draft', 'published', 'archived'].includes(filter)) {
      query.filter({ status: filter as PostFrontmatter['status'] });
    }

    const results = await query
      .select('params.slug', 'frontmatter.title', 'frontmatter.status')
      .exec();

    return {
      options: results.map((r) => ({
        value: r.slug,
        label: r.title ?? r.slug,
        hint: r.status,
      })),
    };
  },
  { supportsFilter: true }
);
```

## Layered Resolution Pattern

Load only what the menu needs. Pull heavier fields later.

```typescript
// Menu query: cheap fields only
const selected = await prompter.select({
  message: 'Select a post',
  provider: async () => {
    const rows = await piq
      .from(posts)
      .scan({ year: '2026' })
      .select('params.slug', 'frontmatter.title')
      .exec();

    return {
      options: rows.map((r) => ({
        value: r.slug,
        label: r.title ?? r.slug,
      })),
    };
  },
});

// Follow-up query: heavier body fields only for selected row
const post = await piq
  .from(posts)
  .scan({ slug: selected })
  .select('params.slug', 'frontmatter.title', 'body.html', 'body.headings')
  .single()
  .exec();
```

## Hierarchical Menus from Path Params

```typescript
type DocParams = { category: string; slug: string };

const categoryProvider: OptionsProvider<string> = async () => {
  const rows = await piq.from(docs).scan({}).select('params.category').exec();
  const categories = [...new Set(rows.map((r) => r.category))];

  return {
    options: categories.map((category) => ({
      value: category,
      label: category.replace(/-/g, ' '),
    })),
  };
};

const docsInCategoryProvider = (category: string): OptionsProvider<string> => {
  return async () => {
    const rows = await piq
      .from(docs)
      .scan({ category })
      .select('params.slug', 'frontmatter.title')
      .exec();

    return {
      options: rows.map((r) => ({
        value: r.slug,
        label: r.title ?? r.slug,
      })),
    };
  };
};
```

## Error Handling

```typescript
const resilientProvider: OptionsProvider<string> = async () => {
  try {
    const rows = await piq
      .from(posts)
      .scan({})
      .select('params.slug', 'frontmatter.title')
      .exec();

    if (rows.length === 0) {
      return {
        options: [{ value: '__empty__', label: 'No posts found', hint: 'Create a post first' }],
      };
    }

    return {
      options: rows.map((r) => ({
        value: r.slug,
        label: r.title ?? r.slug,
      })),
    };
  } catch (error) {
    throw new Error(`Failed to load posts: ${(error as Error).message}`);
  }
};
```

## Related

- [Prompter API](../api/prompter.md)
- piq API reference (`piq/docs/reference/api.md` in the piq repo)
