# Dynamic Menus with piq

This guide shows patterns for populating pok dynamic menus from piq content collections. These are userland patterns - glue code you implement in your CLI to connect the two systems.

## Prerequisites

- pok dynamic menus (provider-based `select()`)
- piq collection with search, meta, and/or body resolvers

## Basic: Collection to Menu

The simplest pattern loads all items from a piq collection into a menu.

```typescript
import { piq } from 'piqit';
import type { OptionsProvider } from '@pokit/core';

// Define the provider
const postsProvider: OptionsProvider<string> = async () => {
  const results = await piq
    .from<PostSearch, PostMeta>('posts')
    .search('*')
    .select({ meta: ['title'] })
    .exec();

  return {
    options: results.map((r) => ({
      value: r.path,
      label: r.meta?.title ?? r.search.slug,
      hint: r.search.date,
    })),
  };
};

// Use in command
const selected = await prompter.select({
  message: 'Select a post to edit',
  provider: postsProvider,
});
```

**Key points:**

- `search('*')` returns all items matching the collection pattern
- `select({ meta: ['title'] })` loads only the title field from frontmatter
- Map piq results to pok's `SelectOption<T>` shape

## Paginated: Cursor-Based Loading

For large collections, implement cursor-based pagination. piq doesn't have built-in pagination, but you can implement it with array slicing.

```typescript
import { piq } from 'piqit';
import type { OptionsProvider } from '@pokit/core';

const PAGE_SIZE = 25;

const paginatedProvider: OptionsProvider<string> = async ({ cursor }) => {
  // Fetch all results (piq caches the search layer)
  const results = await piq
    .from<PostSearch, PostMeta>('posts')
    .search('*')
    .select({ meta: ['title', 'date'] })
    .exec();

  // Parse cursor to get offset
  const offset = cursor ? parseInt(cursor, 10) : 0;
  const page = results.slice(offset, offset + PAGE_SIZE);
  const hasMore = offset + PAGE_SIZE < results.length;

  return {
    options: page.map((r) => ({
      value: r.path,
      label: r.meta?.title ?? r.search.slug,
      hint: r.meta?.date?.toLocaleDateString(),
    })),
    nextCursor: hasMore ? String(offset + PAGE_SIZE) : undefined,
    totalCount: results.length,
  };
};

const selected = await prompter.select({
  message: 'Select a post',
  provider: paginatedProvider,
  loadMoreLabel: 'Load 25 more posts...',
});
```

**Key points:**

- Use cursor as string-encoded offset
- Return `totalCount` for progress display ("25 of 150")
- `nextCursor: undefined` signals end of results

### Pre-Fetched Pagination

For better performance with large collections, fetch once and paginate in memory:

```typescript
// Cache results outside provider for multi-page efficiency
let cachedResults: QueryResult<PostSearch, PostMeta>[] | null = null;

const cachedProvider: OptionsProvider<string> = async ({ cursor }) => {
  // Fetch once, reuse across pages
  if (!cachedResults) {
    cachedResults = await piq
      .from<PostSearch, PostMeta>('posts')
      .search('*')
      .select({ meta: ['title'] })
      .exec();
  }

  const offset = cursor ? parseInt(cursor, 10) : 0;
  const page = cachedResults.slice(offset, offset + PAGE_SIZE);
  const hasMore = offset + PAGE_SIZE < cachedResults.length;

  return {
    options: page.map((r) => ({
      value: r.path,
      label: r.meta?.title ?? r.search.slug,
    })),
    nextCursor: hasMore ? String(offset + PAGE_SIZE) : undefined,
    totalCount: cachedResults.length,
  };
};
```

## Typeahead: Filtering via Constraints

piq's search constraints enable server-side filtering. Declare `supportsFilter` so pok calls your provider with the filter term.

```typescript
import { piq } from 'piqit';
import { withCapabilities, type OptionsProvider } from '@pokit/core';

// Collection schema: { tag: string, slug: string }
type PostSearch = { tag: string; slug: string };

const filterableProvider = withCapabilities(
  async ({ filter }) => {
    // Use piq search constraints when filter provided
    const query = piq.from<PostSearch, PostMeta>('posts');

    if (filter) {
      // Exact match on tag parameter from path pattern
      query.search({ tag: filter });
    } else {
      query.search('*');
    }

    const results = await query.select({ meta: ['title'] }).exec();

    return {
      options: results.map((r) => ({
        value: r.path,
        label: r.meta?.title ?? r.search.slug,
        hint: r.search.tag,
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

### Filter on Meta Fields

Filter using piq's `filter()` for frontmatter-based constraints:

```typescript
const statusFilterProvider = withCapabilities(
  async ({ filter }) => {
    const query = piq.from<PostSearch, PostMeta>('posts').search('*');

    // Filter by status in frontmatter
    if (filter && ['draft', 'published', 'archived'].includes(filter)) {
      query.filter({ status: filter as PostMeta['status'] });
    }

    const results = await query.select({ meta: ['title', 'status'] }).exec();

    return {
      options: results.map((r) => ({
        value: r.path,
        label: r.meta?.title ?? r.search.slug,
        hint: r.meta?.status,
      })),
    };
  },
  { supportsFilter: true }
);
```

## Layered Resolution: Efficient Loading

piq's three-layer model (search -> meta -> body) maps well to progressive menu loading. Load only what you need at each stage.

### Search-Only for Speed

When path parameters contain enough info for display:

```typescript
// Path pattern: posts/{year}/{month}/{slug}.md
type PostSearch = { year: string; month: string; slug: string };

const fastProvider: OptionsProvider<string> = async () => {
  // Search layer only - no file I/O
  const results = await piq.from<PostSearch>('posts').search('*').exec();

  return {
    options: results.map((r) => ({
      value: r.path,
      label: r.search.slug.replace(/-/g, ' '),
      hint: `${r.search.year}/${r.search.month}`,
    })),
  };
};
```

### Meta for Rich Display

Add frontmatter for better labels:

```typescript
const richProvider: OptionsProvider<string> = async () => {
  const results = await piq
    .from<PostSearch, PostMeta>('posts')
    .search('*')
    .select({ meta: ['title', 'description'] })
    .exec();

  return {
    options: results.map((r) => ({
      value: r.path,
      label: r.meta?.title ?? r.search.slug,
      hint: r.meta?.description?.slice(0, 50),
    })),
  };
};
```

### Body On-Demand

Load body content only after selection:

```typescript
// Menu uses search + meta
const selected = await prompter.select({
  message: 'Select a post',
  provider: richProvider,
});

// Load body only for selected item
const post = await piq
  .from<PostSearch, PostMeta, PostBody>('posts')
  .search('*')
  .select({ body: ['html', 'headings'] })
  .single()
  .exec();
// Use post.body.html, post.body.headings
```

## Content Structure Mapping

Mirror your content directory structure as a command tree with nested menus.

### Directory Pattern

Content structure:

```
content/
  docs/
    getting-started/
      installation.md
      configuration.md
    guides/
      deployment.md
```

Collection pattern: `docs/{category}/{slug}.md`

```typescript
type DocSearch = { category: string; slug: string };

// First-level menu: categories
const categoryProvider: OptionsProvider<string> = async () => {
  const results = await piq.from<DocSearch>('docs').search('*').exec();

  // Extract unique categories
  const categories = [...new Set(results.map((r) => r.search.category))];

  return {
    options: categories.map((cat) => ({
      value: cat,
      label: cat.replace(/-/g, ' '),
      hint: `${results.filter((r) => r.search.category === cat).length} docs`,
    })),
  };
};

// Second-level menu: docs in category
const docsInCategoryProvider = (category: string): OptionsProvider<string> => {
  return async () => {
    const results = await piq
      .from<DocSearch, DocMeta>('docs')
      .search({ category })
      .select({ meta: ['title'] })
      .exec();

    return {
      options: results.map((r) => ({
        value: r.path,
        label: r.meta?.title ?? r.search.slug,
      })),
    };
  };
};

// Usage in command
const category = await prompter.select({
  message: 'Select category',
  provider: categoryProvider,
});

const doc = await prompter.select({
  message: `Select doc in ${category}`,
  provider: docsInCategoryProvider(category),
});
```

### Hierarchical Navigation Helper

Build a reusable pattern for navigating content hierarchies:

```typescript
type ContentPath = {
  collection: string;
  segments: string[];
  final: string | null;
};

async function navigateContent<TSearch extends Record<string, string>>(
  prompter: Prompter,
  collection: string,
  segmentKeys: (keyof TSearch)[]
): Promise<ContentPath> {
  const segments: string[] = [];

  for (const key of segmentKeys) {
    // Build constraints from selected segments
    const constraints: Partial<TSearch> = {};
    segmentKeys.slice(0, segments.length).forEach((k, i) => {
      constraints[k] = segments[i] as TSearch[typeof k];
    });

    const results = await piq
      .from<TSearch>(collection)
      .search(segments.length === 0 ? '*' : constraints)
      .exec();

    // Extract unique values for current segment
    const values = [...new Set(results.map((r) => r.search[key] as string))];

    const selected = await prompter.select({
      message: `Select ${String(key)}`,
      provider: async () => ({
        options: values.map((v) => ({ value: v, label: v })),
      }),
    });

    segments.push(selected);
  }

  // Get final item
  const finalConstraints: Partial<TSearch> = {};
  segmentKeys.forEach((k, i) => {
    finalConstraints[k] = segments[i] as TSearch[typeof k];
  });

  const results = await piq.from<TSearch>(collection).search(finalConstraints).exec();

  return {
    collection,
    segments,
    final: results[0]?.path ?? null,
  };
}

// Usage
const path = await navigateContent<DocSearch>(prompter, 'docs', ['category', 'slug']);
```

## Error Handling

Wrap piq queries with error handling for better UX:

```typescript
const resilientProvider: OptionsProvider<string> = async ({ signal }) => {
  try {
    const results = await piq
      .from<PostSearch, PostMeta>('posts')
      .search('*')
      .select({ meta: ['title'] })
      .exec();

    if (results.length === 0) {
      return {
        options: [
          {
            value: '__empty__',
            label: 'No posts found',
            hint: 'Create a post first',
          },
        ],
      };
    }

    return {
      options: results.map((r) => ({
        value: r.path,
        label: r.meta?.title ?? r.search.slug,
      })),
    };
  } catch (error) {
    // Re-throw for pok's error recovery UI
    throw new Error(`Failed to load posts: ${error.message}`);
  }
};

const selected = await prompter.select({
  message: 'Select a post',
  provider: resilientProvider,
  errorMessage: 'Could not load posts. Check your content directory.',
});

// Handle empty state
if (selected === '__empty__') {
  console.log('No posts to select');
  return;
}
```

## Related

- [Prompter API](../api/prompter.md) - Full dynamic options reference
- [piq documentation](https://github.com/yourusername/piq) - Collection query API
