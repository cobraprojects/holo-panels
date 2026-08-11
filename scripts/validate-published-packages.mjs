import { execFileSync } from 'node:child_process'
import { access, cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { satisfiesVersionRange, validatePublishedDependencyRanges } from './published-manifest-policy.mjs'

const packagesRoot = new URL('../packages/', import.meta.url)
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const holoRoot = resolve(process.env.HOLO_PANELS_HOLO_JS_ROOT ?? resolve(repositoryRoot, '../holo-js'))
const holoPackagesRoot = join(holoRoot, 'packages')
const requireBuild = process.argv.includes('--require-build')
const requirePackedSmoke = process.argv.includes('--pack')
const rootManifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const rootLicense = await readFile(new URL('../LICENSE', import.meta.url), 'utf8')
const catalog = rootManifest.workspaces.catalog
const minimumPublishedHoloVersion = '0.3.10'
const manifests = new Map()
let workspaceVersion
const packageDirectories = (await readdir(packagesRoot, { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort()

function catalogRange(packageName) {
  const range = catalog[packageName]
  const expectedPattern = packageName.startsWith('@holo-js/') ? /^>=\d+\.\d+\.\d+$/u : /^\^\d+\.\d+\.\d+$/u
  if (typeof range !== 'string' || !expectedPattern.test(range)) {
    throw new Error(`Expected ${packageName} to use its approved semver catalog range`)
  }
  return range
}

function minimumCatalogVersion(packageName) {
  if (packageName.startsWith('@holo-js/')) return minimumPublishedHoloVersion
  return catalogRange(packageName).replace(/^(?:\^|>=)/u, '')
}

for (const directory of packageDirectories) {
  const packageRoot = new URL(`../packages/${directory}/`, import.meta.url)
  const manifest = JSON.parse(await readFile(new URL('package.json', packageRoot), 'utf8'))
  manifests.set(manifest.name, { directory, manifest, packageRoot })

  if (workspaceVersion === undefined) {
    workspaceVersion = manifest.version
  } else if (manifest.version !== workspaceVersion) {
    throw new Error(`${manifest.name} must use lockstep workspace version ${workspaceVersion}`)
  }

  if (!manifest.name?.startsWith('@holo-js/panels')) {
    throw new Error(`${directory} has an invalid package name`)
  }

  if (manifest.private === true) {
    throw new Error(`${manifest.name} must be publishable`)
  }

  if (manifest.license !== 'MIT' || manifest.type !== 'module') {
    throw new Error(`${manifest.name} must be an MIT-licensed ESM package`)
  }

  if (!manifest.exports?.['.'] || !manifest.files?.includes('dist')) {
    throw new Error(`${manifest.name} must publish its root export from dist`)
  }

  const packageLicense = await readFile(new URL('LICENSE', packageRoot), 'utf8')
  if (packageLicense !== rootLicense) {
    throw new Error(`${manifest.name} must include the canonical workspace license`)
  }

  await access(new URL('src/index.ts', packageRoot))
  await access(new URL('tsconfig.json', packageRoot))
  await access(new URL('tsup.config.ts', packageRoot))
  await access(new URL('vitest.config.ts', packageRoot))

  if (requireBuild) {
    const rootEntrypoint = new URL(manifest.exports['.'].import, packageRoot)
    const serverTarget = manifest.exports['.']['react-server']?.import ?? manifest.exports['./server']?.import ?? manifest.exports['.'].import
    const serverEntrypoint = new URL(serverTarget, packageRoot)
    await access(rootEntrypoint)
    await access(serverEntrypoint)
    await import(serverEntrypoint)
  }
}

console.log(`Validated publish metadata for ${packageDirectories.length} packages`)

function exportTargets(value) {
  if (typeof value === 'string') return [value]
  if (value === null || typeof value !== 'object') return []
  return Object.values(value).flatMap(exportTargets)
}

function nodeImportSpecifier(packageName) {
  const manifest = manifests.get(packageName)?.manifest
  return manifest?.exports?.['./server'] ? `${packageName}/server` : packageName
}

function validateTarball(packageName, sourceManifest, tarballPath) {
  const entries = execFileSync('tar', ['-tzf', tarballPath], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
  const entrySet = new Set(entries)
  const packedManifest = JSON.parse(execFileSync('tar', ['-xOf', tarballPath, 'package/package.json'], { encoding: 'utf8' }))
  const allowedRoots = (sourceManifest.files ?? []).map(value => `package/${value.replace(/^\.\//u, '').replace(/\/$/u, '')}`)

  if (packedManifest.name !== packageName || packedManifest.version !== sourceManifest.version || packedManifest.private === true) {
    throw new Error(`${packageName} packed identity does not match its publishable source manifest`)
  }

  for (const entry of entries) {
    if (entry !== 'package/package.json' && entry !== 'package/LICENSE' && !allowedRoots.some(root => entry === root || entry.startsWith(`${root}/`))) {
      throw new Error(`${packageName} tarball contains unexpected release artifact ${entry}`)
    }
    if (/(?:^|\/)(?:tests?|coverage|node_modules)(?:\/|$)/u.test(entry) || entry.endsWith('.map')) {
      throw new Error(`${packageName} tarball contains non-release content ${entry}`)
    }
  }

  if (!entrySet.has('package/LICENSE')) {
    throw new Error(`${packageName} tarball is missing its license`)
  }
  const packedLicense = execFileSync('tar', ['-xOf', tarballPath, 'package/LICENSE'], { encoding: 'utf8' })
  if (packedLicense !== rootLicense) {
    throw new Error(`${packageName} tarball license does not match the canonical workspace license`)
  }

  for (const target of exportTargets(packedManifest.exports)) {
    if (!target.startsWith('./') || target.split('/').includes('..')) throw new Error(`${packageName} export target is unsafe: ${target}`)
    if (!entrySet.has(`package/${target.slice(2)}`)) throw new Error(`${packageName} tarball is missing export target ${target}`)
  }

  validatePublishedDependencyRanges(packageName, packedManifest, new Set(manifests.keys()), catalog)
}

function packPackage(packageRoot, tarballRoot) {
  const output = execFileSync('bun', ['pm', 'pack', '--destination', tarballRoot, '--quiet'], {
    cwd: packageRoot,
    encoding: 'utf8',
  })
  const tarballPath = output.trim().split('\n').at(-1)

  if (!tarballPath) {
    throw new Error(`Packing ${packageRoot} did not return a tarball path`)
  }

  return tarballPath
}

async function packAdjacentHoloPackages(tarballRoot) {
  const dependencies = {}
  const packageEntries = (await readdir(holoPackagesRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))

  for (const entry of packageEntries) {
    const packageRoot = join(holoPackagesRoot, entry.name)
    const manifestPath = join(packageRoot, 'package.json')
    const manifest = await readFile(manifestPath, 'utf8')
      .then(contents => JSON.parse(contents))
      .catch(() => undefined)

    if (!manifest?.name?.startsWith('@holo-js/') || manifest.private === true) {
      continue
    }

    const expectedRange = catalog[manifest.name] === undefined
      ? undefined
      : catalogRange(manifest.name)
    if (expectedRange !== undefined && !satisfiesVersionRange(expectedRange, manifest.version)) {
      throw new Error(`Adjacent ${manifest.name}@${manifest.version} must satisfy catalog range ${expectedRange}`)
    }

    const tarballPath = packPackage(packageRoot, tarballRoot)
    const packedManifest = JSON.parse(execFileSync('tar', ['-xOf', tarballPath, 'package/package.json'], { encoding: 'utf8' }))
    if (packedManifest.name !== manifest.name || packedManifest.version !== manifest.version) {
      throw new Error(`${manifest.name} packed identity differs from its adjacent source manifest`)
    }
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const [dependencyName, range] of Object.entries(packedManifest[field] ?? {})) {
        if (['catalog:', 'workspace:', 'file:', 'link:'].some(prefix => range.startsWith(prefix))) {
          throw new Error(`${manifest.name} packed ${field}.${dependencyName} has unresolved range ${range}`)
        }
      }
    }

    dependencies[manifest.name] = `file:${tarballPath}`
  }

  for (const packageName of Object.keys(catalog).filter(name => name.startsWith('@holo-js/'))) {
    if (dependencies[packageName] === undefined) {
      throw new Error(`Adjacent Holo-JS does not provide required package ${packageName}`)
    }
  }

  return dependencies
}

async function createPanelsPackingWorkspace(root, holoDependencies) {
  const stagedPackagesRoot = join(root, 'packages')
  await mkdir(stagedPackagesRoot)

  for (const { directory } of manifests.values()) {
    await cp(join(repositoryRoot, 'packages', directory), join(stagedPackagesRoot, directory), {
      recursive: true,
      filter: source => basename(source) !== 'node_modules',
    })
  }

  const stagedManifest = structuredClone(rootManifest)
  stagedManifest.workspaces.packages = ['packages/*']
  stagedManifest.devDependencies = {}
  stagedManifest.overrides = {
    ...stagedManifest.overrides,
    ...holoDependencies,
  }
  for (const { directory, manifest } of manifests.values()) {
    const installManifest = structuredClone(manifest)
    installManifest.devDependencies = {}
    installManifest.peerDependencies = {}
    await writeFile(join(stagedPackagesRoot, directory, 'package.json'), `${JSON.stringify(installManifest, null, 2)}\n`)
  }
  await writeFile(join(root, 'package.json'), `${JSON.stringify(stagedManifest, null, 2)}\n`)
  await writeFile(join(root, 'bunfig.toml'), '[install]\nlinker = "isolated"\n')
  execFileSync('bun', ['install', '--ignore-scripts', '--omit=dev', '--omit=peer'], {
    cwd: root,
    stdio: 'pipe',
  })
  for (const { directory } of manifests.values()) {
    await cp(join(repositoryRoot, 'packages', directory, 'package.json'), join(stagedPackagesRoot, directory, 'package.json'))
  }

  return stagedPackagesRoot
}

if (requirePackedSmoke) {
  if (!requireBuild) {
    throw new Error('--pack requires --require-build')
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), 'holo-panels-published-smoke-'))
  const tarballRoot = join(temporaryRoot, 'packages')
  const holoTarballRoot = join(temporaryRoot, 'holo-packages')
  const packingWorkspaceRoot = join(temporaryRoot, 'packing-workspace')
  const consumerRoot = join(temporaryRoot, 'consumer')
  const frameworkConsumersRoot = join(temporaryRoot, 'framework-consumers')
  const isolationConsumersRoot = join(temporaryRoot, 'isolation-consumers')
  const pluginExamplesRoot = join(frameworkConsumersRoot, 'plugin-examples')
  const installedPluginRoot = join(frameworkConsumersRoot, 'installed-plugin')
  const standaloneRoot = await mkdtemp(join(tmpdir(), 'holo-panels-standalone-consumer-'))

  try {
    const dependencies = {}
    await mkdir(tarballRoot)
    await mkdir(holoTarballRoot)
    await mkdir(packingWorkspaceRoot)
    await mkdir(consumerRoot)
    await mkdir(frameworkConsumersRoot)
    await mkdir(isolationConsumersRoot)

    const holoDependencies = await packAdjacentHoloPackages(holoTarballRoot)
    const stagedPackagesRoot = await createPanelsPackingWorkspace(packingWorkspaceRoot, holoDependencies)

    for (const [packageName, { directory, manifest }] of manifests) {
      const tarballPath = packPackage(join(stagedPackagesRoot, directory), tarballRoot)

      validateTarball(packageName, manifest, tarballPath)
      dependencies[packageName] = `file:${tarballPath}`
    }

    const standalonePeers = {}
    for (const { manifest } of manifests.values()) {
      for (const [packageName, sourceRange] of Object.entries(manifest.peerDependencies ?? {})) {
        if (manifests.has(packageName)) continue
        const resolvedRange = sourceRange === 'catalog:' ? minimumCatalogVersion(packageName) : sourceRange
        if (!resolvedRange) throw new Error(`Missing standalone peer range for ${packageName}`)
        standalonePeers[packageName] = resolvedRange
      }
    }
    await writeFile(join(standaloneRoot, 'package.json'), JSON.stringify({
      name: 'holo-panels-standalone-packed-consumer',
      private: true,
      type: 'module',
      dependencies: { ...standalonePeers, ...dependencies },
      devDependencies: { typescript: minimumCatalogVersion('typescript') },
      overrides: { ...holoDependencies, ...dependencies },
    }, null, 2))
    await writeFile(join(standaloneRoot, 'bunfig.toml'), '[install]\nlinker = "isolated"\n')
    await writeFile(join(standaloneRoot, 'index.mjs'), [...manifests.keys()]
      .sort()
      .map(packageName => `await import('${nodeImportSpecifier(packageName)}')`)
      .join('\n'))
    await writeFile(join(standaloneRoot, 'inference.ts'), `import { column as databaseColumn, defineGeneratedTable, defineModel } from '@holo-js/db'
import { column, defineResource, field } from '@holo-js/panels'

const posts = defineGeneratedTable('posts', {
  id: databaseColumn.string().primaryKey(),
  published: databaseColumn.boolean(),
  title: databaseColumn.string(),
})

const Post = defineModel(posts, { fillable: ['published', 'title'], guarded: ['id'], timestamps: false })

defineResource(Post)
  .form([field.text('title').required(), field.boolean('published')])
  .table([column.text('title').sortable(), column.boolean('published')])

// @ts-expect-error title is not boolean
defineResource(Post).form([field.boolean('title')])
// @ts-expect-error missing is not a model attribute
defineResource(Post).form([field.text('missing')])
// @ts-expect-error title is not boolean
defineResource(Post).table([column.boolean('title')])
// @ts-expect-error missing is not a model attribute
defineResource(Post).table([column.text('missing')])
`)
    await writeFile(join(standaloneRoot, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: 'ES2022',
      },
      include: ['inference.ts'],
    }, null, 2))
    execFileSync('bun', ['install', '--ignore-scripts'], { cwd: standaloneRoot, stdio: 'pipe' })
    execFileSync('node', ['index.mjs'], { cwd: standaloneRoot, stdio: 'pipe' })
    execFileSync('bun', ['run', 'tsc', '--', '-p', 'tsconfig.json'], { cwd: standaloneRoot, stdio: 'pipe' })

    const pluginPackageRoot = join(repositoryRoot, 'examples', 'plugins')
    for (const script of ['typecheck', 'test', 'build']) {
      execFileSync('bun', ['run', script], {
        cwd: pluginPackageRoot,
        encoding: 'utf8',
        stdio: 'pipe',
      })
    }
    const pluginPackOutput = execFileSync('bun', ['pm', 'pack', '--destination', tarballRoot, '--quiet'], {
      cwd: pluginPackageRoot,
      encoding: 'utf8',
    })
    const pluginTarballPath = pluginPackOutput.trim().split('\n').at(-1)
    if (!pluginTarballPath) throw new Error('Packing the third-party plugin example did not return a tarball path')

    await writeFile(join(temporaryRoot, 'package.json'), JSON.stringify({
      name: 'holo-panels-published-smoke-root',
      private: true,
      workspaces: ['consumer', 'framework-consumers/*', 'isolation-consumers/*'],
      overrides: { ...holoDependencies, ...dependencies },
    }, null, 2))
    await cp(join(repositoryRoot, 'tsconfig.json'), join(temporaryRoot, 'tsconfig.json'))
    await writeFile(join(temporaryRoot, 'bunfig.toml'), '[install]\nlinker = "isolated"\n')
    await writeFile(join(temporaryRoot, 'consumer', 'package.json'), JSON.stringify({
      name: 'holo-panels-published-smoke-consumer',
      private: true,
      type: 'module',
      dependencies: { ...standalonePeers, ...dependencies },
    }, null, 2))
    await writeFile(join(temporaryRoot, 'consumer', 'index.mjs'), [...manifests.keys()]
      .sort()
      .map(packageName => `await import('${nodeImportSpecifier(packageName)}')`)
      .join('\n'))

    const frameworkFixtures = [
      {
        adapter: '@holo-js/panels-next',
        directory: 'example-next',
        renderer: '@holo-js/panels-react',
      },
      {
        adapter: '@holo-js/panels-nuxt',
        directory: 'example-nuxt',
        renderer: '@holo-js/panels-vue',
      },
      {
        adapter: '@holo-js/panels-sveltekit',
        directory: 'example-sveltekit',
        renderer: '@holo-js/panels-svelte',
      },
    ]
    const ignoredFixtureEntries = new Set([
      '.next',
      '.nuxt',
      '.output',
      '.svelte-kit',
      'build',
      'node_modules',
      'tests',
    ])

    for (const fixture of frameworkFixtures) {
      const sourceRoot = join(repositoryRoot, 'apps', fixture.directory)
      const targetRoot = join(frameworkConsumersRoot, fixture.directory)
      await cp(sourceRoot, targetRoot, {
        recursive: true,
        filter: source => !ignoredFixtureEntries.has(basename(source)),
      })

      const fixtureManifestPath = join(targetRoot, 'package.json')
      const fixtureManifest = JSON.parse(await readFile(fixtureManifestPath, 'utf8'))

      for (const dependencyGroup of ['dependencies', 'devDependencies']) {
        const fixtureDependencies = fixtureManifest[dependencyGroup]

        if (!fixtureDependencies) {
          continue
        }

        for (const [packageName, version] of Object.entries(fixtureDependencies)) {
          if (manifests.has(packageName)) {
            fixtureDependencies[packageName] = dependencies[packageName]
          } else if (version === 'catalog:') {
            const catalogVersion = catalog[packageName]

            if (!catalogVersion) {
              throw new Error(`${fixture.directory} references missing catalog dependency ${packageName}`)
            }

            fixtureDependencies[packageName] = minimumCatalogVersion(packageName)
          }
        }
      }

      await writeFile(fixtureManifestPath, JSON.stringify(fixtureManifest, null, 2))
      await writeFile(join(targetRoot, 'packed-smoke.mjs'), [
        "await import('@holo-js/panels')",
        `await import('${fixture.adapter}/server')`,
        ...frameworkFixtures
          .filter(candidate => candidate.adapter !== fixture.adapter)
          .map(candidate => [
            'try {',
            `  import.meta.resolve('${candidate.adapter}')`,
            `  throw new Error('${fixture.directory} unexpectedly installed ${candidate.adapter}')`,
            '} catch (error) {',
            `  if (error instanceof Error && error.message === '${fixture.directory} unexpectedly installed ${candidate.adapter}') {`,
            '    throw error',
            '  }',
            "  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ERR_MODULE_NOT_FOUND') {",
            '    throw error',
            '  }',
            '}',
          ].join('\n')),
        ...frameworkFixtures
          .filter(candidate => candidate.renderer !== fixture.renderer)
          .map(candidate => [
            'try {',
            `  import.meta.resolve('${candidate.renderer}')`,
            `  throw new Error('${fixture.directory} unexpectedly installed ${candidate.renderer}')`,
            '} catch (error) {',
            `  if (error instanceof Error && error.message === '${fixture.directory} unexpectedly installed ${candidate.renderer}') {`,
            '    throw error',
            '  }',
            "  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ERR_MODULE_NOT_FOUND') {",
            '    throw error',
            '  }',
            '}',
          ].join('\n')),
      ].join('\n'))
    }

    await cp(join(repositoryRoot, 'examples', 'plugins'), pluginExamplesRoot, {
      recursive: true,
      filter: source => !['package.json', 'tsconfig.json', 'tsup.config.ts', 'vitest.config.ts'].includes(basename(source)),
    })
    await writeFile(join(pluginExamplesRoot, 'package.json'), JSON.stringify({
      name: 'holo-panels-packed-plugin-examples',
      private: true,
      type: 'module',
      dependencies: {
        '@holo-js/forms': minimumCatalogVersion('@holo-js/forms'),
        '@holo-js/panels': dependencies['@holo-js/panels'],
        '@holo-js/panels-core': dependencies['@holo-js/panels-core'],
        typescript: minimumCatalogVersion('typescript'),
      },
    }, null, 2))
    await writeFile(join(pluginExamplesRoot, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        target: 'ES2022',
      },
      exclude: ['**/*.test.ts'],
      include: ['./*.ts'],
    }, null, 2))
    await mkdir(installedPluginRoot)
    await writeFile(join(installedPluginRoot, 'package.json'), JSON.stringify({
      name: 'holo-panels-installed-plugin-example',
      private: true,
      type: 'module',
      dependencies: {
        '@acme/panels-plugin-catalog': `file:${pluginTarballPath}`,
        '@holo-js/forms': minimumCatalogVersion('@holo-js/forms'),
        '@holo-js/panels': dependencies['@holo-js/panels'],
        '@holo-js/panels-core': dependencies['@holo-js/panels-core'],
      },
    }, null, 2))
    await writeFile(join(installedPluginRoot, 'index.mjs'), [
      "const plugin = await import('@acme/panels-plugin-catalog')",
      "const renderers = await import('@acme/panels-plugin-catalog/renderers')",
      "import.meta.resolve('@acme/panels-plugin-catalog/style.css')",
      "const installation = plugin.catalogPlugin.install({ guard: 'web', id: 'admin' })",
      "if (installation.id !== 'acme.catalog' || installation.contributions.length !== 18) throw new Error('Packed plugin did not install')",
      "if (typeof renderers.RatingField !== 'function') throw new Error('Packed plugin renderer is unavailable')",
    ].join('\n'))

    const minimumHoloPeers = {
      '@holo-js/auth': minimumCatalogVersion('@holo-js/auth'),
      '@holo-js/authorization': minimumCatalogVersion('@holo-js/authorization'),
      '@holo-js/config': minimumCatalogVersion('@holo-js/config'),
      '@holo-js/core': minimumCatalogVersion('@holo-js/core'),
      '@holo-js/db': minimumCatalogVersion('@holo-js/db'),
      '@holo-js/forms': minimumCatalogVersion('@holo-js/forms'),
      '@holo-js/kernel': minimumCatalogVersion('@holo-js/kernel'),
      '@holo-js/security': minimumCatalogVersion('@holo-js/security'),
      '@holo-js/validation': minimumCatalogVersion('@holo-js/validation'),
    }
    const optionalCorePeers = [
      '@holo-js/broadcast',
      '@holo-js/flux',
      '@holo-js/media',
      '@holo-js/notifications',
      '@holo-js/queue',
      '@holo-js/realtime',
      '@holo-js/storage',
    ]

    async function createIsolationConsumer(directory, consumerDependencies, entryLines) {
      const root = join(isolationConsumersRoot, directory)
      await mkdir(root)
      await writeFile(join(root, 'package.json'), JSON.stringify({
        name: `holo-panels-${directory}`,
        private: true,
        type: 'module',
        dependencies: consumerDependencies,
      }, null, 2))
      await writeFile(join(root, 'index.mjs'), entryLines.join('\n'))
    }

    function missingPackageAssertions(packageNames, label) {
      return packageNames.flatMap(packageName => [
        'try {',
        `  import.meta.resolve('${packageName}')`,
        `  throw new Error('${label} unexpectedly installed ${packageName}')`,
        '} catch (error) {',
        `  if (error instanceof Error && error.message === '${label} unexpectedly installed ${packageName}') {`,
        '    throw error',
        '  }',
        "  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ERR_MODULE_NOT_FOUND') {",
        '    throw error',
        '  }',
        '}',
      ])
    }

    await createIsolationConsumer('umbrella-alone', {
      ...minimumHoloPeers,
      '@holo-js/panels': dependencies['@holo-js/panels'],
    }, [
      "await import('@holo-js/panels')",
      ...missingPackageAssertions(
        frameworkFixtures.flatMap(fixture => [fixture.adapter, fixture.renderer]),
        'umbrella-alone',
      ),
    ])

    await createIsolationConsumer('testing-base', {
      ...minimumHoloPeers,
      '@holo-js/panels-testing': dependencies['@holo-js/panels-testing'],
    }, [
      "await import('@holo-js/panels-testing')",
      ...missingPackageAssertions(
        frameworkFixtures.map(fixture => fixture.renderer),
        'testing-base',
      ),
    ])

    const testingRendererFixtures = [
      {
        directory: 'testing-react',
        renderer: '@holo-js/panels-react',
        subpath: '@holo-js/panels-testing/react',
        frameworkPeers: {
          react: minimumCatalogVersion('react'),
          'react-dom': minimumCatalogVersion('react-dom'),
        },
      },
      {
        directory: 'testing-vue',
        renderer: '@holo-js/panels-vue',
        subpath: '@holo-js/panels-testing/vue',
        frameworkPeers: {
          vue: minimumCatalogVersion('vue'),
        },
      },
      {
        directory: 'testing-svelte',
        renderer: '@holo-js/panels-svelte',
        subpath: '@holo-js/panels-testing/svelte',
        frameworkPeers: {
          svelte: minimumCatalogVersion('svelte'),
        },
      },
    ]

    for (const fixture of testingRendererFixtures) {
      await createIsolationConsumer(fixture.directory, {
        ...minimumHoloPeers,
        ...fixture.frameworkPeers,
        '@holo-js/panels-testing': dependencies['@holo-js/panels-testing'],
        [fixture.renderer]: dependencies[fixture.renderer],
      }, [
        `await import('${fixture.subpath}')`,
        ...missingPackageAssertions(
          frameworkFixtures.map(candidate => candidate.renderer).filter(renderer => renderer !== fixture.renderer),
          fixture.directory,
        ),
      ])
    }

    await createIsolationConsumer('core-minimum', {
      ...minimumHoloPeers,
      '@holo-js/panels-core': dependencies['@holo-js/panels-core'],
    }, [
      "await import('@holo-js/panels-core')",
      ...Object.keys(minimumHoloPeers).map(packageName => `await import('${packageName}')`),
      ...missingPackageAssertions(optionalCorePeers, 'core-minimum'),
    ])

    for (const optionalPeer of optionalCorePeers) {
      const directory = `core-with-${optionalPeer.slice('@holo-js/'.length)}`
      await createIsolationConsumer(directory, {
        ...minimumHoloPeers,
        '@holo-js/panels-core': dependencies['@holo-js/panels-core'],
        [optionalPeer]: minimumCatalogVersion(optionalPeer),
      }, [
        "await import('@holo-js/panels-core')",
        `await import('${optionalPeer}')`,
      ])
    }

    execFileSync('bun', ['install', '--ignore-scripts'], {
      cwd: temporaryRoot,
      stdio: 'pipe',
    })
    execFileSync('node', ['index.mjs'], {
      cwd: consumerRoot,
      stdio: 'pipe',
    })

    for (const fixture of frameworkFixtures) {
      const targetRoot = join(frameworkConsumersRoot, fixture.directory)
      execFileSync('node', ['packed-smoke.mjs'], {
        cwd: targetRoot,
        stdio: 'pipe',
      })
      execFileSync('bun', ['run', 'typecheck'], {
        cwd: targetRoot,
        stdio: 'inherit',
      })
    }
    execFileSync('bun', ['run', 'tsc', '--', '-p', 'tsconfig.json'], {
      cwd: pluginExamplesRoot,
      stdio: 'inherit',
    })
    execFileSync('node', ['index.mjs'], {
      cwd: installedPluginRoot,
      stdio: 'pipe',
    })

    const isolationConsumers = await readdir(isolationConsumersRoot, { withFileTypes: true })
    for (const consumer of isolationConsumers.filter(entry => entry.isDirectory())) {
      execFileSync('node', ['index.mjs'], {
        cwd: join(isolationConsumersRoot, consumer.name),
        stdio: 'pipe',
      })
    }
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true })
    await rm(standaloneRoot, { recursive: true, force: true })
  }

  console.log(`Packed, installed, and imported ${manifests.size} packages`)
  console.log('Installed all packed packages into an independent non-workspace consumer')
  console.log('Installed and typechecked packed umbrella and matching adapters in Next, Nuxt, and SvelteKit fixtures')
  console.log('Typechecked public plugin examples against packed Holo Panels packages')
  console.log('Packed, installed, and imported the third-party full plugin example')
  console.log('Validated isolated umbrella, testing renderer, optional-core, and minimum Holo peer consumers')
}
