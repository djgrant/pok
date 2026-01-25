# @pokit/playground

Interactive learning website for pok CLI framework. Features a real terminal running in the browser via WebContainers.

## Features

- **In-browser Terminal**: Full Node.js environment running via WebContainers
- **Interactive Lessons**: Step-by-step tutorials with runnable code examples
- **Progress Tracking**: Lesson completion stored locally in the browser
- **Dark Mode**: Optimized dark theme matching the terminal aesthetic

## Development

```bash
# Install dependencies (from repo root)
pnpm install

# Start dev server
pnpm --filter @pokit/playground dev
```

The dev server runs at `http://localhost:5173`.

## Build

```bash
pnpm --filter @pokit/playground build
```

Output is generated in the `dist/` directory.

## Deployment

The site is configured for Vercel deployment. The `vercel.json` file includes the required headers for WebContainers (Cross-Origin-Embedder-Policy and Cross-Origin-Opener-Policy).

### Manual Deployment

1. Build the site: `pnpm build`
2. Deploy the `dist/` directory to any static host
3. Ensure the server sets these headers:
   - `Cross-Origin-Embedder-Policy: require-corp`
   - `Cross-Origin-Opener-Policy: same-origin`

## Browser Support

| Browser | Status                                  |
| ------- | --------------------------------------- |
| Chrome  | Full support                            |
| Firefox | Full support                            |
| Edge    | Full support (Chromium-based)           |
| Safari  | Not supported (WebContainer limitation) |
| Mobile  | Shows "best on desktop" message         |

## Adding Lessons

Lessons are Markdown files in the `lessons/` directory:

1. Create a new file: `lessons/XX-lesson-name.md`
2. Add frontmatter with title and category
3. Use fenced code blocks for examples
4. Add `file="path/to/file.ts"` to code blocks to create files
5. Bash code blocks are automatically runnable

Example:

````markdown
---
title: My Lesson
category: Getting Started
---

# My Lesson

Create a file:

```typescript file="commands/hello.ts"
export default {
  name: 'hello',
  run: () => console.log('Hello!'),
};
```

Run it:

```bash
npx pok hello
```
````

## Known Limitations

- WebContainers require Chrome or Firefox (Safari not supported)
- First load takes 3-5 seconds to boot the Node.js environment
- Mobile browsers show a "best on desktop" message
- Requires stable internet connection for initial package installation

## License

MIT
