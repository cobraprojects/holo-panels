import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')

async function text(path) {
  return readFile(resolve(repositoryRoot, path), 'utf8')
}

async function manifest(path) {
  return JSON.parse(await text(path))
}

function localImports(source) {
  return [...source.matchAll(/(?:from\s+|import\s*)['"](\.\.?\/[^'"]+)['"]/gu)]
    .map(match => match[1])
    .filter(Boolean)
}

async function graph(entry) {
  const visited = new Map()
  const visit = async (relativePath) => {
    if (visited.has(relativePath)) return
    const source = await text(relativePath)
    visited.set(relativePath, source)
    for (const specifier of localImports(source)) {
      const target = resolve(dirname(resolve(repositoryRoot, relativePath)), specifier)
      const next = target.slice(repositoryRoot.length + 1)
      await visit(next)
    }
  }
  await visit(entry)
  return visited
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function joined(sources) {
  return [...sources.entries()].map(([path, source]) => `\n${path}\n${source}`).join('')
}

const core = await manifest('packages/core/package.json')
const client = await manifest('packages/client/package.json')
const react = await manifest('packages/react/package.json')
const next = await manifest('packages/next/package.json')

assert(core.exports['.'].browser.import === './dist/browser.mjs', 'Panels Core browser condition is missing')
assert(client.exports['.'].browser.import === './dist/browser.mjs', 'Panels Client browser condition is missing')
assert(react.exports['.']['react-server'].import === './dist/server.mjs', 'Panels React react-server condition is missing')
assert(next.exports['.']['react-server'].import === './dist/server.mjs', 'Panels Next react-server condition is missing')

const browserSources = joined(new Map([
  ...await graph('packages/core/dist/browser.mjs'),
  ...await graph('packages/client/dist/browser.mjs'),
]))
const browserBans = [
  ['Node built-ins', /from\s+['"]node:/u],
  ['Holo Auth', /from\s+['"]@holo-js\/auth(?:\/|['"])/u],
  ['Holo Authorization', /from\s+['"]@holo-js\/authorization(?:\/|['"])/u],
  ['Holo database', /from\s+['"]@holo-js\/db(?:\/|['"])/u],
  ['Holo queue', /from\s+['"]@holo-js\/queue(?:\/|['"])/u],
  ['Holo storage', /from\s+['"]@holo-js\/storage(?:\/|['"])/u],
  ['server-only Holo Security', /from\s+['"]@holo-js\/security\/(?!client(?:['"]|\/))/u],
]
for (const [label, pattern] of browserBans) {
  assert(!pattern.test(browserSources), `${label} entered a browser conditional graph`)
}

const reactServerSources = joined(await graph('packages/react/dist/server.mjs'))
const nextServerSources = joined(await graph('packages/next/dist/server.mjs'))
const hookImport = /import\s*\{[^}]*\buse[A-Z][^}]*\}\s*from\s*['"]react['"]/su

assert(!hookImport.test(reactServerSources), 'A React hook entered the Panels React server graph')
assert(!hookImport.test(nextServerSources), 'A React hook entered the Panels Next server graph')
assert(nextServerSources.includes('from "@holo-js/panels-next/client"'), 'The Next server page does not preserve the explicit client boundary')

process.stdout.write('Conditional export graphs are isolated.\n')
