import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

const packageRoot = path.resolve(import.meta.dirname, '..')
const distRoot = path.join(packageRoot, 'dist')
const textExtensions = new Set(['.js', '.d.ts'])

async function collectFiles(root) {
  const entries = await readdir(root, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath))
      continue
    }

    if (!entry.isFile()) continue

    const extension = entry.name.endsWith('.d.ts')
      ? '.d.ts'
      : path.extname(entry.name)

    if (textExtensions.has(extension)) {
      files.push(fullPath)
    }
  }

  return files
}

async function resolvePatchedSpecifier(filePath, specifier, extension) {
  if (!specifier.startsWith('.')) return specifier

  const resolvedBase = path.resolve(path.dirname(filePath), specifier)
  const fileCandidate = `${resolvedBase}${extension}`

  try {
    const fileStats = await stat(fileCandidate)
    if (fileStats.isFile()) return `${specifier}${extension}`
  } catch {
    // Ignore and try index file next.
  }

  const indexCandidate = path.join(resolvedBase, `index${extension}`)
  try {
    const indexStats = await stat(indexCandidate)
    if (indexStats.isFile()) return `${specifier}/index${extension}`
  } catch {
    // Leave the specifier unchanged if no concrete target exists.
  }

  return specifier
}

async function patchFile(filePath) {
  const extension = filePath.endsWith('.d.ts') ? '.d.ts' : '.js'
  const source = await readFile(filePath, 'utf8')

  const rewriteMatches = async (input, pattern) => {
    const matches = Array.from(input.matchAll(pattern))
    if (matches.length === 0) return input

    const replacements = await Promise.all(
      matches.map(async (match) => {
        const [, prefix, specifier, suffix] = match
        const patchedSpecifier = await resolvePatchedSpecifier(filePath, specifier, extension)
        return {
          original: match[0],
          replacement: `${prefix}${patchedSpecifier}${suffix}`,
        }
      }),
    )

    let output = input
    for (const { original, replacement } of replacements) {
      output = output.replace(original, replacement)
    }
    return output
  }

  let patched = source
  patched = await rewriteMatches(patched, /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g)
  patched = await rewriteMatches(patched, /(import\s*\(\s*['"])(\.\.?\/[^'"]+)(['"]\s*\))/g)

  if (patched !== source) {
    await writeFile(filePath, patched, 'utf8')
  }
}

const files = await collectFiles(distRoot)
await Promise.all(files.map((filePath) => patchFile(filePath)))

console.log(`Patched relative dist imports in ${files.length} files`)
