import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withResolvedReleaseManifests } from './resolved-release-manifests.mjs'

const packagesRoot = new URL('../packages/', import.meta.url)
const rootManifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const catalog = rootManifest.workspaces.catalog
const manifests = new Map()
const holoRanges = new Set(Object.entries(catalog)
  .filter(([packageName]) => packageName.startsWith('@holo-js/'))
  .map(([, range]) => range))

if (holoRanges.size !== 1) {
  throw new Error(`External Holo packages must use one compatibility range; received ${[...holoRanges].sort().join(', ')}`)
}

const holoRange = [...holoRanges][0]
const unresolvedRangePrefixes = ['catalog:', 'workspace:', 'file:', 'link:']
const packageDirectories = (await readdir(packagesRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()

for (const directory of packageDirectories) {
  const packageRoot = new URL(`../packages/${directory}/`, import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'))
  manifests.set(manifest.name, { manifest, packageRoot })
}

const expectedRuntime = new Map([
  ['@holo-js/panels', {
    dependencies: ['@holo-js/panels-cli', '@holo-js/panels-client', '@holo-js/panels-core'],
    peers: ['@holo-js/db', '@holo-js/forms', '@holo-js/kernel'],
  }],
  ['@holo-js/panels-cli', {
    dependencies: ['@holo-js/panels-core', 'esbuild'],
    peers: ['@holo-js/kernel'],
  }],
  ['@holo-js/panels-client', {
    dependencies: ['@holo-js/panels-core'],
    peers: ['@holo-js/flux', '@holo-js/security'],
    optional: ['@holo-js/flux'],
  }],
  ['@holo-js/panels-core', {
    dependencies: [],
    peers: [
      '@holo-js/auth',
      '@holo-js/authorization',
      '@holo-js/broadcast',
      '@holo-js/config',
      '@holo-js/core',
      '@holo-js/db',
      '@holo-js/flux',
      '@holo-js/forms',
      '@holo-js/media',
      '@holo-js/notifications',
      '@holo-js/queue',
      '@holo-js/realtime',
      '@holo-js/security',
      '@holo-js/storage',
      '@holo-js/validation',
    ],
    optional: [
      '@holo-js/broadcast',
      '@holo-js/flux',
      '@holo-js/media',
      '@holo-js/notifications',
      '@holo-js/queue',
      '@holo-js/realtime',
      '@holo-js/storage',
    ],
  }],
  ['@holo-js/panels-next', {
    dependencies: ['@holo-js/panels-react'],
    peers: ['@holo-js/adapter-next', '@holo-js/security', 'next', 'react', 'react-dom'],
  }],
  ['@holo-js/panels-nuxt', {
    dependencies: ['@holo-js/panels-vue'],
    peers: ['@holo-js/adapter-nuxt', '@holo-js/security', 'h3', 'nuxt', 'vue'],
  }],
  ['@holo-js/panels-plugin-money', {
    dependencies: ['@holo-js/panels-core'],
    peers: ['@holo-js/panels-react', '@holo-js/panels-svelte', '@holo-js/panels-vue', 'react', 'svelte', 'vue'],
    optional: ['@holo-js/panels-react', '@holo-js/panels-svelte', '@holo-js/panels-vue', 'react', 'svelte', 'vue'],
  }],
  ['@holo-js/panels-react', {
    dependencies: ['@holo-js/panels-client', '@holo-js/panels-core', '@holo-js/panels-ui'],
    peers: ['react', 'react-dom'],
  }],
  ['@holo-js/panels-shield', {
    dependencies: ['@holo-js/panels-cli', '@holo-js/panels-core'],
    peers: ['@holo-js/auth', '@holo-js/authorization', '@holo-js/db', '@holo-js/kernel'],
  }],
  ['@holo-js/panels-svelte', {
    dependencies: ['@holo-js/panels-client', '@holo-js/panels-core', '@holo-js/panels-ui'],
    peers: ['svelte'],
  }],
  ['@holo-js/panels-sveltekit', {
    dependencies: ['@holo-js/panels-svelte'],
    peers: ['@holo-js/adapter-sveltekit', '@holo-js/security', '@sveltejs/kit', 'svelte'],
  }],
  ['@holo-js/panels-testing', {
    dependencies: ['@holo-js/panels-client', '@holo-js/panels-core', '@holo-js/panels-ui'],
    peers: [
      '@holo-js/panels-react',
      '@holo-js/panels-svelte',
      '@holo-js/panels-vue',
      'react',
      'react-dom',
      'svelte',
      'vue',
    ],
    optional: [
      '@holo-js/panels-react',
      '@holo-js/panels-svelte',
      '@holo-js/panels-vue',
      'react',
      'react-dom',
      'svelte',
      'vue',
    ],
  }],
  ['@holo-js/panels-ui', {
    dependencies: [],
    peers: [],
  }],
  ['@holo-js/panels-vue', {
    dependencies: ['@holo-js/panels-client', '@holo-js/panels-core', '@holo-js/panels-ui'],
    peers: ['vue'],
  }],
])

function sortedKeys(value) {
  return Object.keys(value ?? {}).sort()
}

function assertSameNames(packageName, field, actual, expected) {
  const actualNames = sortedKeys(actual)
  const expectedNames = [...expected].sort()

  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error(`${packageName} ${field} must be ${expectedNames.join(', ') || 'empty'}; received ${actualNames.join(', ') || 'empty'}`)
  }
}

function assertSourceManifest(packageName, manifest, policy) {
  assertSameNames(packageName, 'dependencies', manifest.dependencies, policy.dependencies)
  assertSameNames(packageName, 'peerDependencies', manifest.peerDependencies, policy.peers)
  assertSameNames(packageName, 'optional peer metadata', manifest.peerDependenciesMeta, policy.optional ?? [])

  for (const dependencyName of policy.dependencies) {
    const expectedRange = manifests.has(dependencyName) ? 'workspace:*' : 'catalog:'
    if (manifest.dependencies[dependencyName] !== expectedRange) {
      throw new Error(`${packageName} must declare ${dependencyName} as ${expectedRange}`)
    }
  }

  for (const peerName of policy.peers) {
    const expectedRange = manifests.has(peerName) ? 'workspace:*' : 'catalog:'
    if (manifest.peerDependencies[peerName] !== expectedRange) {
      throw new Error(`${packageName} must declare peer ${peerName} as ${expectedRange}`)
    }

    const metadata = manifest.peerDependenciesMeta?.[peerName]
    if ((policy.optional ?? []).includes(peerName)) {
      if (metadata?.optional !== true || Object.keys(metadata).length !== 1) {
        throw new Error(`${packageName} optional peer ${peerName} must have only optional: true metadata`)
      }
    } else if (metadata !== undefined) {
      throw new Error(`${packageName} required peer ${peerName} must not be marked optional`)
    }
  }

  for (const [field, dependencies] of Object.entries({
    dependencies: manifest.dependencies,
    peerDependencies: manifest.peerDependencies,
  })) {
    for (const [dependencyName, range] of Object.entries(dependencies ?? {})) {
      if (range === 'catalog:' && catalog[dependencyName] === undefined) {
        throw new Error(`${packageName} ${field} references missing catalog entry ${dependencyName}`)
      }
      if (field === 'dependencies' && dependencyName.startsWith('@holo-js/') && !dependencyName.startsWith('@holo-js/panels')) {
        throw new Error(`${packageName} must declare external Holo package ${dependencyName} as a peer`)
      }
    }
  }
}

for (const [packageName, policy] of expectedRuntime) {
  const entry = manifests.get(packageName)
  if (!entry) {
    throw new Error(`Missing workspace package ${packageName}`)
  }
  assertSourceManifest(packageName, entry.manifest, policy)
}

if (expectedRuntime.size !== manifests.size) {
  const unexpected = [...manifests.keys()].filter(name => !expectedRuntime.has(name))
  throw new Error(`Dependency policy is missing packages: ${unexpected.join(', ')}`)
}

const frameworkNames = new Set(['next', 'nuxt', 'react', 'react-dom', 'svelte', 'vue', '@sveltejs/kit'])
for (const packageName of ['@holo-js/panels-core', '@holo-js/panels-client', '@holo-js/panels-ui']) {
  const manifest = manifests.get(packageName).manifest
  const declared = new Set([
    ...sortedKeys(manifest.dependencies),
    ...sortedKeys(manifest.peerDependencies),
  ])
  const leakedFramework = [...frameworkNames].find(name => declared.has(name))
  if (leakedFramework) {
    throw new Error(`${packageName} must not declare framework dependency ${leakedFramework}`)
  }
}

const umbrellaDependencies = new Set(expectedRuntime.get('@holo-js/panels').dependencies)
for (const forbidden of [
  '@holo-js/panels-shield',
  '@holo-js/panels-react',
  '@holo-js/panels-vue',
  '@holo-js/panels-svelte',
  '@holo-js/panels-next',
  '@holo-js/panels-nuxt',
  '@holo-js/panels-sveltekit',
  ...frameworkNames,
]) {
  if (umbrellaDependencies.has(forbidden)) {
    throw new Error(`@holo-js/panels must not install ${forbidden}`)
  }
}

const testingSource = await readFile(new URL('../packages/testing/src/index.ts', import.meta.url), 'utf8')
for (const optionalPeer of expectedRuntime.get('@holo-js/panels-testing').optional) {
  if (testingSource.includes(`'${optionalPeer}'`) || testingSource.includes(`"${optionalPeer}"`)) {
    throw new Error(`Base testing entry must not eagerly import optional peer ${optionalPeer}`)
  }
}

const testingRendererEntries = new Map([
  ['./react', '@holo-js/panels-react'],
  ['./vue', '@holo-js/panels-vue'],
  ['./svelte', '@holo-js/panels-svelte'],
])
const testingManifest = manifests.get('@holo-js/panels-testing').manifest
for (const [subpath, renderer] of testingRendererEntries) {
  const exported = testingManifest.exports?.[subpath]
  if (!exported?.types || !exported?.import || !exported?.default) {
    throw new Error(`@holo-js/panels-testing must export ${subpath} with types, import, and default entries`)
  }

  const source = await readFile(new URL(`../packages/testing/src/${subpath.slice(2)}.ts`, import.meta.url), 'utf8')
  if (!source.includes(`'${renderer}'`) && !source.includes(`"${renderer}"`)) {
    throw new Error(`@holo-js/panels-testing ${subpath} must load ${renderer}`)
  }

  for (const otherRenderer of testingRendererEntries.values()) {
    if (otherRenderer !== renderer && (source.includes(`'${otherRenderer}'`) || source.includes(`"${otherRenderer}"`))) {
      throw new Error(`@holo-js/panels-testing ${subpath} must not load ${otherRenderer}`)
    }
  }
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'holo-panels-dependency-policy-'))

try {
  await withResolvedReleaseManifests(async () => {
    for (const [packageName, { manifest, packageRoot }] of manifests) {
      const output = execFileSync('bun', ['pm', 'pack', '--destination', temporaryRoot, '--quiet'], {
        cwd: fileURLToPath(packageRoot),
        encoding: 'utf8',
      })
      const tarballPath = output.trim().split('\n').at(-1)

      if (!tarballPath) {
        throw new Error(`Packing ${packageName} did not return a tarball path`)
      }

      const packedManifest = JSON.parse(execFileSync('tar', ['-xOf', tarballPath, 'package/package.json'], {
        encoding: 'utf8',
      }))

      if (packedManifest.version !== manifest.version) {
        throw new Error(`${packageName} packed version differs from its source manifest`)
      }

      for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
        for (const [dependencyName, range] of Object.entries(packedManifest[field] ?? {})) {
          if (unresolvedRangePrefixes.some(prefix => range.startsWith(prefix)) || isAbsolute(range)) {
            throw new Error(`${packageName} packed ${field}.${dependencyName} has unresolved range ${range}`)
          }

          if (manifests.has(dependencyName) && range !== packedManifest.version) {
            throw new Error(`${packageName} packed internal dependency ${dependencyName} must equal lockstep version ${packedManifest.version}`)
          }

          if (dependencyName.startsWith('@holo-js/') && !dependencyName.startsWith('@holo-js/panels') && range !== holoRange) {
            throw new Error(`${packageName} packed Holo peer ${dependencyName} must use ${holoRange}`)
          }
        }
      }
    }
  })
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

console.log(`Validated dependency placement and packed manifest resolution for ${manifests.size} packages`)
