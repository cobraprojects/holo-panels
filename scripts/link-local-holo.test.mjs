import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  catalogHoloPackageNames,
  createLocalHoloLinkPlan,
  linkLocalHolo,
  localHoloPackageNames,
  replaceNodeModulesEntry,
} from './link-local-holo.mjs'
import { validatePublishedDependencyRanges } from './published-manifest-policy.mjs'

const temporaryRoots = []
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

async function createFixture(options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'holo-panels-local-link-'))
  temporaryRoots.push(root)
  const repositoryRoot = join(root, 'holo-panels')
  const holoRoot = join(root, 'holo-js')
  const catalog = Object.fromEntries(localHoloPackageNames.map(name => [name, '^0.3.10']))
  await mkdir(join(repositoryRoot, 'node_modules'), { recursive: true })
  await mkdir(join(repositoryRoot, 'packages'), { recursive: true })
  await mkdir(join(repositoryRoot, 'apps'), { recursive: true })
  await mkdir(join(holoRoot, 'packages'), { recursive: true })
  await writeFile(join(repositoryRoot, 'package.json'), JSON.stringify({
    workspaces: { catalog, packages: ['packages/*', 'apps/*'] },
  }))

  for (const packageName of localHoloPackageNames) {
    const directory = packageName.slice('@holo-js/'.length)
    const packageRoot = join(holoRoot, 'packages', directory)
    const version = packageName === options.mismatchedPackage ? '0.4.0' : '0.3.10'
    const bin = packageName === '@holo-js/cli'
      ? { [options.binName ?? 'holo']: options.binPath ?? './dist/bin/holo.mjs' }
      : undefined
    await mkdir(join(packageRoot, 'dist', 'bin'), { recursive: true })
    await writeFile(join(packageRoot, 'package.json'), JSON.stringify({ name: packageName, version, ...(bin ? { bin } : {}) }))
    await writeFile(join(packageRoot, 'dist', 'bin', 'holo.mjs'), '')
  }

  return { holoRoot, repositoryRoot, root }
}

test('local Holo linker derives a sorted package set from every Holo catalog entry', async () => {
  const manifest = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
  const expected = Object.keys(manifest.workspaces.catalog)
    .filter(name => name.startsWith('@holo-js/'))
    .sort()
  assert.deepEqual(localHoloPackageNames, expected)
  assert.deepEqual(catalogHoloPackageNames({
    workspaces: {
      catalog: {
        zod: '^4.0.0',
        '@holo-js/storage': '^0.3.10',
        '@holo-js/auth': '^0.3.10',
      },
    },
  }), ['@holo-js/auth', '@holo-js/storage'])

  const fixture = await createFixture()
  await assert.rejects(
    createLocalHoloLinkPlan({
      ...fixture,
      packageNames: [...localHoloPackageNames, '@holo-js/storage-s3'],
    }),
    /package selection is derived from the Panels workspace catalog/,
  )
})

test('local Holo linker replaces only catalog Holo entries after complete validation', async () => {
  const fixture = await createFixture()
  const unrelatedRoot = join(fixture.repositoryRoot, 'node_modules', '@holo-js', 'unrelated')
  await mkdir(unrelatedRoot, { recursive: true })
  await writeFile(join(unrelatedRoot, 'sentinel'), 'preserved')
  const originalManifest = await readFile(join(fixture.repositoryRoot, 'package.json'), 'utf8')

  const result = await linkLocalHolo(fixture)

  assert.equal(result.packageCount, localHoloPackageNames.length)
  assert.equal(result.nodeModulesCount, 1)
  for (const packageName of localHoloPackageNames) {
    const directory = packageName.slice('@holo-js/'.length)
    assert.equal(
      await realpath(join(fixture.repositoryRoot, 'node_modules', '@holo-js', directory)),
      await realpath(join(fixture.holoRoot, 'packages', directory)),
    )
  }
  assert.equal(await readFile(join(unrelatedRoot, 'sentinel'), 'utf8'), 'preserved')
  assert.equal(await readFile(join(fixture.repositoryRoot, 'package.json'), 'utf8'), originalManifest)
  assert.equal(
    await realpath(join(fixture.repositoryRoot, 'node_modules', '.bin', 'holo')),
    await realpath(join(fixture.holoRoot, 'packages', 'cli', 'dist', 'bin', 'holo.mjs')),
  )
})

test('local Holo linker replaces existing nested clones and redirects without creating missing entries', async () => {
  const fixture = await createFixture()
  const workspaceRoot = join(fixture.repositoryRoot, 'packages', 'consumer')
  const missingWorkspaceRoot = join(fixture.repositoryRoot, 'apps', 'without-installs')
  const nestedScope = join(workspaceRoot, 'node_modules', '@holo-js')
  const staleRedirect = join(fixture.root, 'stale-db')
  await mkdir(join(nestedScope, 'auth'), { recursive: true })
  await writeFile(join(nestedScope, 'auth', 'stale'), 'remove')
  await mkdir(staleRedirect)
  await symlink(staleRedirect, join(nestedScope, 'db'))
  await mkdir(join(workspaceRoot, 'node_modules', '.bin'), { recursive: true })
  await writeFile(join(workspaceRoot, 'node_modules', '.bin', 'holo'), 'stale')
  await mkdir(join(nestedScope, 'unrelated'), { recursive: true })
  await writeFile(join(nestedScope, 'unrelated', 'sentinel'), 'preserved')
  await writeFile(join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'consumer', private: true }))
  await mkdir(missingWorkspaceRoot, { recursive: true })
  await writeFile(join(missingWorkspaceRoot, 'package.json'), JSON.stringify({ name: 'without-installs', private: true }))

  const result = await linkLocalHolo(fixture)

  assert.equal(result.nodeModulesCount, 2)
  assert.equal(
    await realpath(join(nestedScope, 'auth')),
    await realpath(join(fixture.holoRoot, 'packages', 'auth')),
  )
  assert.equal(
    await realpath(join(nestedScope, 'db')),
    await realpath(join(fixture.holoRoot, 'packages', 'db')),
  )
  assert.equal(
    await realpath(join(workspaceRoot, 'node_modules', '.bin', 'holo')),
    await realpath(join(fixture.holoRoot, 'packages', 'cli', 'dist', 'bin', 'holo.mjs')),
  )
  assert.equal(await readFile(join(nestedScope, 'unrelated', 'sentinel'), 'utf8'), 'preserved')
  await assert.rejects(realpath(join(nestedScope, 'notifications')), { code: 'ENOENT' })
  await assert.rejects(realpath(join(missingWorkspaceRoot, 'node_modules')), { code: 'ENOENT' })
})

test('local Holo linker replaces catalog entries in contained Bun package trees', async () => {
  const fixture = await createFixture()
  const bunStoreRoot = join(fixture.repositoryRoot, 'node_modules', '.bun')
  const adapterNodeModules = join(bunStoreRoot, '@holo-js+adapter-next@0.3.10', 'node_modules')
  const sharedNodeModules = join(bunStoreRoot, 'node_modules')
  const adapterCore = join(adapterNodeModules, '@holo-js', 'core')
  const sharedAuth = join(sharedNodeModules, '@holo-js', 'auth')
  const unrelated = join(adapterNodeModules, '@holo-js', 'unrelated')
  await mkdir(adapterCore, { recursive: true })
  await mkdir(sharedAuth, { recursive: true })
  await mkdir(unrelated, { recursive: true })
  await writeFile(join(adapterCore, 'stale'), 'remove')
  await writeFile(join(sharedAuth, 'stale'), 'remove')
  await writeFile(join(unrelated, 'sentinel'), 'preserved')

  const result = await linkLocalHolo(fixture)

  assert.equal(result.nodeModulesCount, 3)
  assert.equal(await realpath(adapterCore), await realpath(join(fixture.holoRoot, 'packages', 'core')))
  assert.equal(await realpath(sharedAuth), await realpath(join(fixture.holoRoot, 'packages', 'auth')))
  assert.equal(await readFile(join(unrelated, 'sentinel'), 'utf8'), 'preserved')
  await assert.rejects(realpath(join(adapterNodeModules, '@holo-js', 'db')), { code: 'ENOENT' })
})

test('Bun package tree redirects reject the complete plan before replacement', async () => {
  const fixture = await createFixture()
  const rootTarget = join(fixture.repositoryRoot, 'node_modules', '@holo-js', 'auth')
  const bunStoreRoot = join(fixture.repositoryRoot, 'node_modules', '.bun')
  const escapedPackageTree = join(fixture.root, 'escaped-package-tree')
  await mkdir(rootTarget, { recursive: true })
  await writeFile(join(rootTarget, 'sentinel'), 'preserved')
  await mkdir(bunStoreRoot)
  await mkdir(join(escapedPackageTree, 'node_modules'), { recursive: true })
  await symlink(escapedPackageTree, join(bunStoreRoot, 'redirected-package'))

  await assert.rejects(linkLocalHolo(fixture), /Bun package node_modules must stay inside its store/)
  assert.equal(await readFile(join(rootTarget, 'sentinel'), 'utf8'), 'preserved')
})

test('nested parent redirects reject the complete plan before root replacement', async () => {
  const fixture = await createFixture()
  const rootTarget = join(fixture.repositoryRoot, 'node_modules', '@holo-js', 'auth')
  const workspaceRoot = join(fixture.repositoryRoot, 'packages', 'consumer')
  const escapedScope = join(fixture.root, 'escaped-scope')
  await mkdir(rootTarget, { recursive: true })
  await writeFile(join(rootTarget, 'sentinel'), 'preserved')
  await mkdir(join(workspaceRoot, 'node_modules'), { recursive: true })
  await writeFile(join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'consumer', private: true }))
  await mkdir(escapedScope)
  await symlink(escapedScope, join(workspaceRoot, 'node_modules', '@holo-js'))
  await mkdir(join(escapedScope, 'auth'))

  await assert.rejects(linkLocalHolo(fixture), /parent outside node_modules/)
  assert.equal(await readFile(join(rootTarget, 'sentinel'), 'utf8'), 'preserved')
})

test('local Holo linker rejects incompatible versions before replacing any package', async () => {
  const fixture = await createFixture({ mismatchedPackage: '@holo-js/storage' })
  const existingTarget = join(fixture.repositoryRoot, 'node_modules', '@holo-js', 'auth')
  await mkdir(existingTarget, { recursive: true })
  await writeFile(join(existingTarget, 'sentinel'), 'preserved')

  await assert.rejects(linkLocalHolo(fixture), /@holo-js\/storage 0\.4\.0 does not match Panels catalog \^0\.3\.10/)
  assert.equal(await readFile(join(existingTarget, 'sentinel'), 'utf8'), 'preserved')
})

test('local Holo linker rejects escaped catalog package sources before replacing any package', async () => {
  const fixture = await createFixture()
  const existingTarget = join(fixture.repositoryRoot, 'node_modules', '@holo-js', 'auth')
  const escapedPackage = join(fixture.root, 'escaped-storage')
  const storagePackage = join(fixture.holoRoot, 'packages', 'storage')
  await mkdir(existingTarget, { recursive: true })
  await writeFile(join(existingTarget, 'sentinel'), 'preserved')
  await mkdir(escapedPackage)
  await writeFile(join(escapedPackage, 'package.json'), JSON.stringify({ name: '@holo-js/storage', version: '0.3.10' }))
  await rm(storagePackage, { force: true, recursive: true })
  await symlink(escapedPackage, storagePackage)

  await assert.rejects(linkLocalHolo(fixture), /source must stay inside the Holo packages directory/)
  assert.equal(await readFile(join(existingTarget, 'sentinel'), 'utf8'), 'preserved')
})

test('node_modules replacement rejects traversal and symlinked-parent escapes', async () => {
  const fixture = await createFixture()
  const nodeModulesRoot = await realpath(join(fixture.repositoryRoot, 'node_modules'))
  const source = join(fixture.holoRoot, 'packages', 'auth')
  const outsideTarget = join(fixture.root, 'outside-target')
  await mkdir(outsideTarget)
  await writeFile(join(outsideTarget, 'sentinel'), 'preserved')

  await assert.rejects(
    replaceNodeModulesEntry(source, outsideTarget, nodeModulesRoot),
    /outside node_modules/,
  )
  assert.equal(await readFile(join(outsideTarget, 'sentinel'), 'utf8'), 'preserved')

  const escapedParent = join(fixture.root, 'escaped-parent')
  await mkdir(escapedParent)
  await symlink(escapedParent, join(nodeModulesRoot, '@holo-js'))
  await assert.rejects(
    replaceNodeModulesEntry(source, join(nodeModulesRoot, '@holo-js', 'auth'), nodeModulesRoot),
    /parent outside node_modules/,
  )
})

test('local Holo linker rejects unsafe executable targets', async () => {
  const fixture = await createFixture({ binName: '../outside' })
  await assert.rejects(createLocalHoloLinkPlan(fixture), /unsafe executable name/)
})

test('published manifest policy rejects local dependency specifications', () => {
  for (const range of ['catalog:', 'workspace:*', 'file:../holo-js', 'link:../holo-js']) {
    assert.throws(
      () => validatePublishedDependencyRanges('@holo-js/panels-core', {
        name: '@holo-js/panels-core',
        version: '0.1.0',
        peerDependencies: { '@holo-js/core': range },
      }, new Set(), { '@holo-js/core': '^0.3.10' }),
      /has unresolved range/,
    )
  }
})

test('development linker configuration preserves registry-backed release metadata', async () => {
  const rootManifest = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
  const bunConfiguration = await readFile(join(repositoryRoot, 'bunfig.toml'), 'utf8')
  const lockfile = await readFile(join(repositoryRoot, 'bun.lock'), 'utf8')

  assert.equal(rootManifest.scripts['link:holo'], 'node scripts/link-local-holo.mjs')
  assert.match(bunConfiguration, /^\[install\]\nlinker = "hoisted"\n?$/u)

  for (const packageName of localHoloPackageNames) {
    const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    assert.doesNotMatch(lockfile, new RegExp(`${escapedName}@(file:|link:|workspace:)`, 'u'))
  }
})
