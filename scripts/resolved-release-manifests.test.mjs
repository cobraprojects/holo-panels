import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'
import {
  resolveReleaseManifest,
  withResolvedReleaseManifests,
} from './resolved-release-manifests.mjs'

const temporaryRoots = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), 'holo-panels-release-manifests-'))
  temporaryRoots.push(root)
  await mkdir(join(root, 'packages', 'core'), { recursive: true })
  await mkdir(join(root, 'packages', 'panels'), { recursive: true })
  await writeFile(join(root, 'package.json'), `${JSON.stringify({
    private: true,
    workspaces: {
      catalog: {
        '@holo-js/kernel': '^0.3.10',
        typescript: '^5.7.2',
      },
    },
  }, null, 2)}\n`)
  await writeFile(join(root, 'packages', 'core', 'package.json'), `${JSON.stringify({
    name: '@holo-js/panels-core',
    version: '0.1.0-next.0',
    peerDependencies: {
      '@holo-js/kernel': 'catalog:',
    },
    devDependencies: {
      typescript: 'catalog:',
    },
  }, null, 4)}\n`)
  await writeFile(join(root, 'packages', 'panels', 'package.json'), `${JSON.stringify({
    name: '@holo-js/panels',
    version: '0.1.0-next.0',
    dependencies: {
      '@holo-js/panels-core': 'workspace:*',
    },
  }, null, 4)}\n`)
  return root
}

test('release manifest resolution materializes catalog and workspace ranges', () => {
  const manifest = resolveReleaseManifest({
    name: '@holo-js/panels',
    version: '0.1.0-next.0',
    dependencies: {
      '@holo-js/panels-core': 'workspace:*',
      '@holo-js/kernel': 'catalog:',
      external: '^1.2.3',
    },
    optionalDependencies: {
      '@holo-js/panels-renderer': 'workspace:*',
    },
    peerDependencies: {
      '@holo-js/forms': 'catalog:',
    },
    devDependencies: {
      typescript: 'catalog:',
    },
  }, {
    '@holo-js/forms': '^0.3.10',
    '@holo-js/kernel': '^0.3.10',
    typescript: '^5.7.2',
  }, new Map([
    ['@holo-js/panels', '0.1.0-next.0'],
    ['@holo-js/panels-core', '0.1.0-next.0'],
    ['@holo-js/panels-renderer', '0.1.0-next.1'],
  ]))

  assert.deepEqual(manifest.dependencies, {
    '@holo-js/panels-core': '0.1.0-next.0',
    '@holo-js/kernel': '^0.3.10',
    external: '^1.2.3',
  })
  assert.deepEqual(manifest.optionalDependencies, {
    '@holo-js/panels-renderer': '0.1.0-next.1',
  })
  assert.deepEqual(manifest.peerDependencies, {
    '@holo-js/forms': '^0.3.10',
  })
  assert.deepEqual(manifest.devDependencies, {
    typescript: '^5.7.2',
  })
})

test('release manifest transaction restores exact source contents after success', async () => {
  const root = await createFixture()
  const corePath = join(root, 'packages', 'core', 'package.json')
  const panelsPath = join(root, 'packages', 'panels', 'package.json')
  const originalCore = await readFile(corePath, 'utf8')
  const originalPanels = await readFile(panelsPath, 'utf8')

  const result = await withResolvedReleaseManifests(async () => {
    const core = JSON.parse(await readFile(corePath, 'utf8'))
    const panels = JSON.parse(await readFile(panelsPath, 'utf8'))
    assert.equal(core.peerDependencies['@holo-js/kernel'], '^0.3.10')
    assert.equal(core.devDependencies.typescript, '^5.7.2')
    assert.equal(panels.dependencies['@holo-js/panels-core'], '0.1.0-next.0')
    return 'released'
  }, { root })

  assert.equal(result, 'released')
  assert.equal(await readFile(corePath, 'utf8'), originalCore)
  assert.equal(await readFile(panelsPath, 'utf8'), originalPanels)
})

test('release manifest transaction restores exact source contents after callback failure', async () => {
  const root = await createFixture()
  const corePath = join(root, 'packages', 'core', 'package.json')
  const panelsPath = join(root, 'packages', 'panels', 'package.json')
  const originalCore = await readFile(corePath, 'utf8')
  const originalPanels = await readFile(panelsPath, 'utf8')

  await assert.rejects(
    withResolvedReleaseManifests(async () => {
      assert.equal(
        JSON.parse(await readFile(corePath, 'utf8')).peerDependencies['@holo-js/kernel'],
        '^0.3.10',
      )
      throw new Error('publication failed')
    }, { root }),
    /publication failed/,
  )

  assert.equal(await readFile(corePath, 'utf8'), originalCore)
  assert.equal(await readFile(panelsPath, 'utf8'), originalPanels)
})

test('release manifest transaction leaves every source untouched when resolution fails', async () => {
  const root = await createFixture()
  const rootManifestPath = join(root, 'package.json')
  const rootManifest = JSON.parse(await readFile(rootManifestPath, 'utf8'))
  delete rootManifest.workspaces.catalog['@holo-js/kernel']
  await writeFile(rootManifestPath, JSON.stringify(rootManifest))
  const corePath = join(root, 'packages', 'core', 'package.json')
  const panelsPath = join(root, 'packages', 'panels', 'package.json')
  const originalCore = await readFile(corePath, 'utf8')
  const originalPanels = await readFile(panelsPath, 'utf8')

  await assert.rejects(
    withResolvedReleaseManifests(() => undefined, { root }),
    /Cannot resolve catalog range for @holo-js\/panels-core peerDependencies\.@holo-js\/kernel/,
  )

  assert.equal(await readFile(corePath, 'utf8'), originalCore)
  assert.equal(await readFile(panelsPath, 'utf8'), originalPanels)
})
