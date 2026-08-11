import { readFile } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAdaptedExampleScaffolds, nextOperationRoutePath } from './generate-example-fixtures.mjs'

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const ignoredDirectories = new Set([
  '.holo-js',
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  'build',
  'node_modules',
  'storage',
])

function toProjectPath(root, location) {
  return relative(root, location).split(sep).join('/')
}

async function collectFiles(root, directory = root) {
  const { readdir } = await import('node:fs/promises')
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const location = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue
      }
      files.push(...await collectFiles(root, location))
      continue
    }

    const path = toProjectPath(root, location)
    if (
      path !== '.env'
      && path !== 'bun.lock'
      && path !== 'next-env.d.ts'
      && path !== 'package-lock.json'
      && path !== 'pnpm-lock.yaml'
      && path !== 'yarn.lock'
    ) {
      files.push(path)
    }
  }

  return files
}

const generated = await createAdaptedExampleScaffolds()
const differences = []

try {
  for (const example of generated.examples) {
    const expectedRoot = generated.scaffolds.get(example.directory)
    if (!expectedRoot) {
      throw new Error(`Missing generated scaffold for ${example.directory}`)
    }

    const actualRoot = resolve(repositoryRoot, 'apps', example.directory)
    if (example.framework === 'next') {
      const operationRoute = await readFile(join(actualRoot, nextOperationRoutePath)).catch(() => undefined)
      const encodedOperationRoute = await readFile(join(actualRoot, 'app/%5Fholo/panels/[panelId]/[operation]/route.ts')).catch(() => undefined)
      const privateOperationRoute = await readFile(join(actualRoot, 'app/_holo/panels/[panelId]/[operation]/route.ts')).catch(() => undefined)
      if (!operationRoute) differences.push(`${example.directory}/${nextOperationRoutePath}: missing clean Next operation route`)
      if (encodedOperationRoute) differences.push(`${example.directory}/app/%5Fholo/panels/[panelId]/[operation]/route.ts: encoded Next route must not exist`)
      if (privateOperationRoute) differences.push(`${example.directory}/app/_holo/panels/[panelId]/[operation]/route.ts: private Next route must not exist`)
    }
    const expectedManifest = JSON.parse(await readFile(join(expectedRoot, 'package.json'), 'utf8'))
    if (expectedManifest.dependencies?.['@holo-js/security'] !== 'catalog:') {
      differences.push(`${example.directory}/package.json: missing the scaffold-owned security dependency`)
    }
    for (const path of ['config/security.ts', 'config/cors.ts']) {
      const expected = await readFile(join(expectedRoot, path)).catch(() => undefined)
      if (!expected) {
        differences.push(`${example.directory}/${path}: missing from the adapted Holo security scaffold`)
      }
    }
    for (const path of await collectFiles(expectedRoot)) {
      const expectedPath = join(expectedRoot, path)
      const actualPath = join(actualRoot, path)
      const expected = await readFile(expectedPath)
      const actual = await readFile(actualPath).catch(() => undefined)

      if (!actual) {
        differences.push(`${example.directory}/${path}: missing`)
        continue
      }

      if (!actual.equals(expected)) {
        differences.push(`${example.directory}/${path}: differs from the adapted Holo scaffold`)
      }
    }
  }
} finally {
  await generated.cleanup()
}

if (differences.length > 0) {
  throw new Error([
    'Example scaffold parity failed:',
    ...differences.map(difference => `  - ${difference}`),
    'Run node scripts/generate-example-fixtures.mjs after reviewing adjacent Holo scaffold changes.',
  ].join('\n'))
}

console.log(`Validated Holo scaffold parity for ${generated.examples.length} example applications`)
