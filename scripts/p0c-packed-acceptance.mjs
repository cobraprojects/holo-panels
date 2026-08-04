import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  access,
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, delimiter, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import {
  assertRegistryDependencyGraph,
  assertRegistryPackageVersion,
  minimumHoloPatch,
} from './registry-release-policy.mjs'

const execFileAsync = promisify(execFile)
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url))
const adjacentHoloRoot = resolve(repositoryRoot, '../holo-js')
const holoRoot = resolve(process.env.HOLO_PANELS_HOLO_JS_ROOT ?? adjacentHoloRoot)
const localHoloCliPath = join(holoRoot, 'packages/cli/dist/bin/holo.mjs')
const panelsPackagesRoot = join(repositoryRoot, 'packages')
const holoPackagesRoot = join(holoRoot, 'packages')
const bunExecutable = process.env.HOLO_PANELS_BUN_EXECUTABLE ?? 'bun'
const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const subprocessTimeout = 120_000
const registryMode = process.argv.includes('--registry')
const unsupportedArguments = process.argv.slice(2).filter(argument => argument !== '--registry')
const rootManifest = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
const panelsVersion = JSON.parse(await readFile(join(panelsPackagesRoot, 'panels/package.json'), 'utf8')).version
const holoCompatibilityRange = rootManifest.workspaces.catalog['@holo-js/core']

if (unsupportedArguments.length > 0) {
  throw new Error(`Unsupported P0-C acceptance arguments: ${unsupportedArguments.join(', ')}`)
}

minimumHoloPatch(holoCompatibilityRange)
const excludedSnapshotDirectories = new Set([
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  'build',
  'node_modules',
  'storage',
])

const fixtures = Object.freeze([
  Object.freeze({
    directory: 'next-app',
    framework: 'next',
    adapter: '@holo-js/panels-next',
  }),
  Object.freeze({
    directory: 'nuxt-app',
    framework: 'nuxt',
    adapter: '@holo-js/panels-nuxt',
  }),
  Object.freeze({
    directory: 'sveltekit-app',
    framework: 'sveltekit',
    adapter: '@holo-js/panels-sveltekit',
  }),
])

function toProjectPath(root, path) {
  return relative(root, path).split(sep).join('/')
}

async function run(command, args, cwd, environment = process.env) {
  try {
    return await execFileAsync(command, args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: subprocessTimeout,
      env: environment,
    })
  } catch (error) {
    const stdout = typeof error?.stdout === 'string' ? error.stdout : ''
    const stderr = typeof error?.stderr === 'string' ? error.stderr : ''
    throw new Error([
      `Command failed: ${command} ${args.join(' ')}`,
      stdout ? `stdout:\n${stdout}` : '',
      stderr ? `stderr:\n${stderr}` : '',
    ].filter(Boolean).join('\n'), { cause: error })
  }
}

async function createControlledPackageManager(temporaryRoot, packedPackages) {
  const binaryRoot = join(temporaryRoot, 'bin')
  const binaryPath = join(binaryRoot, 'npm')
  const packedPackagesPath = join(temporaryRoot, 'packed-packages.json')
  await mkdir(binaryRoot)
  await writeFile(packedPackagesPath, JSON.stringify(packedPackages))
  await writeFile(binaryPath, `#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const mapping = JSON.parse(readFileSync(process.env.HOLO_PANELS_PACKED_PACKAGES, 'utf8'))
const projectRoot = process.cwd()
const manifest = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
const installed = new Set()

function installPackage(packageName) {
  if (installed.has(packageName) || typeof mapping[packageName] !== 'string') return
  installed.add(packageName)
  const tarballPath = mapping[packageName].replace(/^file:/, '')
  const extractionRoot = mkdtempSync(join(tmpdir(), 'holo-panels-package-'))
  const destination = join(projectRoot, 'node_modules', ...packageName.split('/'))
  try {
    execFileSync('tar', ['-xzf', tarballPath, '-C', extractionRoot])
    rmSync(destination, { recursive: true, force: true })
    mkdirSync(dirname(destination), { recursive: true })
    cpSync(join(extractionRoot, 'package'), destination, { recursive: true })
    const packageManifest = JSON.parse(readFileSync(join(destination, 'package.json'), 'utf8'))
    const requiredPeers = Object.fromEntries(Object.entries(packageManifest.peerDependencies ?? {})
      .filter(([peerName]) => packageManifest.peerDependenciesMeta?.[peerName]?.optional !== true))
    for (const dependencyName of Object.keys({
      ...packageManifest.dependencies,
      ...packageManifest.optionalDependencies,
      ...requiredPeers,
    })) {
      installPackage(dependencyName)
    }
  } finally {
    rmSync(extractionRoot, { recursive: true, force: true })
  }
}

for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
  installPackage(dependencyName)
}

for (const packageName of Object.keys(mapping)) {
  if (!installed.has(packageName)) {
    rmSync(join(projectRoot, 'node_modules', ...packageName.split('/')), {
      recursive: true,
      force: true,
    })
  }
}
`)
  await chmod(binaryPath, 0o755)

  return {
    binaryPath,
    environment: {
      ...process.env,
      HOLO_PANELS_PACKED_PACKAGES: packedPackagesPath,
      PATH: `${binaryRoot}${delimiter}${process.env.PATH ?? ''}`,
    },
  }
}

async function packPackage(packageRoot, tarballRoot) {
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  const { stdout } = await run(bunExecutable, [
    'pm',
    'pack',
    '--destination',
    tarballRoot,
    '--quiet',
  ], packageRoot)
  const tarballPath = stdout.trim().split('\n').at(-1)

  if (!tarballPath) {
    throw new Error(`Packing ${manifest.name} did not report a tarball path`)
  }

  return [manifest.name, `file:${tarballPath}`]
}

async function archiveInstalledPackage(packageRoot, tarballRoot) {
  const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
  const archiveName = `${manifest.name.replaceAll('@', '').replaceAll('/', '-')}-${manifest.version}.tgz`
  const archivePath = join(tarballRoot, archiveName)
  const stagingRoot = await mkdtemp(join(tarballRoot, 'external-package-'))

  try {
    await cp(packageRoot, join(stagingRoot, 'package'), {
      recursive: true,
      dereference: true,
      filter: source => basename(source) !== 'node_modules',
    })
    await run('tar', ['-czf', archivePath, '-C', stagingRoot, 'package'], repositoryRoot)
  } finally {
    await rm(stagingRoot, { recursive: true, force: true })
  }

  return [manifest.name, `file:${archivePath}`]
}

async function listPackageDirectories(packagesRoot) {
  return (await readdir(packagesRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function collectRequiredPackageRoots() {
  const manifests = new Map()
  for (const entry of await listPackageDirectories(holoPackagesRoot)) {
    const packageRoot = join(holoPackagesRoot, entry.name)
    const manifestPath = join(packageRoot, 'package.json')
    const manifest = await readFile(manifestPath, 'utf8')
      .then(contents => JSON.parse(contents))
      .catch(() => undefined)
    if (manifest?.name?.startsWith('@holo-js/')) {
      manifests.set(manifest.name, { manifest, packageRoot })
    }
  }

  const pending = [
    '@holo-js/adapter-next',
    '@holo-js/adapter-nuxt',
    '@holo-js/adapter-sveltekit',
    '@holo-js/auth',
    '@holo-js/authorization',
    '@holo-js/cli',
    '@holo-js/config',
    '@holo-js/core',
    '@holo-js/db',
    '@holo-js/db-sqlite',
    '@holo-js/forms',
    '@holo-js/kernel',
    '@holo-js/security',
    '@holo-js/validation',
    'bindings',
  ]
  const required = new Map()

  while (pending.length > 0) {
    const candidate = pending.shift()
    const packageName = typeof candidate === 'string' ? candidate : candidate?.packageName
    if (!packageName || required.has(packageName)) {
      continue
    }

    const holoEntry = manifests.get(packageName)
    const localDependencyRoot = join(
      candidate?.parentRoot ?? '',
      'node_modules',
      ...packageName.split('/'),
    )
    const hoistedDependencyRoot = join(
      holoRoot,
      'node_modules/.bun/node_modules',
      ...packageName.split('/'),
    )
    const packageRoot = holoEntry?.packageRoot
      ?? await realpath(localDependencyRoot).catch(async () => {
        return await realpath(hoistedDependencyRoot).catch(() => undefined)
      })

    if (!packageRoot) {
      if (candidate?.optional === true) {
        continue
      }
      throw new Error(`Missing local package source for ${packageName}`)
    }

    const manifest = holoEntry?.manifest
      ?? JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
    required.set(packageName, packageRoot)
    if (holoEntry || candidate?.includeDependencies !== false) {
      for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
        pending.push(dependencyName.startsWith('@holo-js/')
          ? dependencyName
          : {
              packageName: dependencyName,
              parentRoot: packageRoot,
              includeDependencies: packageName === '@holo-js/cli'
                || candidate?.includeDependencies === true,
            })
      }
      for (const dependencyName of Object.keys(manifest.optionalDependencies ?? {})) {
        pending.push({
          packageName: dependencyName,
          parentRoot: packageRoot,
          includeDependencies: packageName === '@holo-js/cli'
            || candidate?.includeDependencies === true,
          optional: true,
        })
      }
      for (const dependencyName of Object.keys(manifest.peerDependencies ?? {})) {
        if (dependencyName.startsWith('@holo-js/') && manifest.peerDependenciesMeta?.[dependencyName]?.optional !== true) {
          pending.push(dependencyName)
        }
      }
    }
  }

  return required
}

async function packLocalPackages(tarballRoot) {
  const packageDirectories = (await readdir(panelsPackagesRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))

  const entries = []
  for (const entry of packageDirectories) {
    entries.push(await packPackage(join(panelsPackagesRoot, entry.name), tarballRoot))
  }

  for (const packageRoot of (await collectRequiredPackageRoots()).values()) {
    entries.push(packageRoot.startsWith(`${holoPackagesRoot}${sep}`)
      ? await packPackage(packageRoot, tarballRoot)
      : await archiveInstalledPackage(packageRoot, tarballRoot))
  }

  return Object.fromEntries(entries)
}

async function createFixture(temporaryRoot, fixture, packageManagerEnvironment, holoCliPath) {
  await run(bunExecutable, [
    holoCliPath,
    'new',
    fixture.directory,
    '--framework',
    fixture.framework,
    '--database',
    'sqlite',
    '--package-manager',
    'npm',
    '--no-interactive',
  ], temporaryRoot, packageManagerEnvironment)

  return join(temporaryRoot, fixture.directory)
}

async function installRegistryCli(temporaryRoot) {
  const bootstrapRoot = join(temporaryRoot, 'registry-cli')
  await mkdir(bootstrapRoot)
  await writeFile(join(bootstrapRoot, 'package.json'), `${JSON.stringify({
    private: true,
    dependencies: {
      '@holo-js/cli': holoCompatibilityRange,
    },
  }, null, 2)}\n`)
  await run(npmExecutable, ['install', '--no-audit', '--no-fund'], bootstrapRoot)
  return join(bootstrapRoot, 'node_modules/@holo-js/cli/dist/bin/holo.mjs')
}

async function installPackedPanels(projectRoot, packedPackages, controlledPackageManager) {
  const manifestPath = join(projectRoot, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.dependencies = {
    ...manifest.dependencies,
    '@holo-js/panels': packedPackages['@holo-js/panels'],
    '@holo-js/panels-plugin-money': packedPackages['@holo-js/panels-plugin-money'],
    '@holo-js/panels-shield': packedPackages['@holo-js/panels-shield'],
  }
  manifest.overrides = {
    ...manifest.overrides,
    ...packedPackages,
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await run(controlledPackageManager.binaryPath, ['install'], projectRoot, controlledPackageManager.environment)
}

async function installRegistryPanels(projectRoot) {
  const manifestPath = join(projectRoot, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.dependencies = {
    ...manifest.dependencies,
    '@holo-js/panels': panelsVersion,
    '@holo-js/panels-plugin-money': panelsVersion,
    '@holo-js/panels-shield': panelsVersion,
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await run(npmExecutable, ['install', '--no-audit', '--no-fund'], projectRoot)
}

async function runHolo(projectRoot, packageManagerEnvironment, ...args) {
  const packedCliPath = join(projectRoot, 'node_modules/@holo-js/cli/dist/bin/holo.mjs')
  return await run(bunExecutable, [packedCliPath, ...args], projectRoot, packageManagerEnvironment)
}

async function runHoloDatabaseCommand(projectRoot, packageManagerEnvironment, ...args) {
  const packedCliPath = join(projectRoot, 'node_modules/@holo-js/cli/dist/bin/holo.mjs')
  return await run(process.execPath, [packedCliPath, ...args], projectRoot, packageManagerEnvironment)
}

async function validateGeneratedPanelArtifacts(projectRoot, packageManagerEnvironment, fixture) {
  const modelRoot = join(projectRoot, 'server/models')
  await mkdir(modelRoot, { recursive: true })
  await writeFile(join(modelRoot, 'Post.ts'), [
    "import { column, defineGeneratedTable, defineModel } from '@holo-js/db'",
    '',
    "const posts = defineGeneratedTable('posts', {",
    '  id: column.id(),',
    '  name: column.string(),',
    '})',
    '',
    'export default defineModel(posts, {',
    "  fillable: ['name'],",
    '})',
    '',
  ].join('\n'))

  await runHolo(projectRoot, packageManagerEnvironment, 'make:panel', 'admin', '--path', '/admin', '--default')
  const panelPath = join(projectRoot, 'server/admin/AdminPanel.ts')
  const panelSource = await readFile(panelPath, 'utf8')
  await writeFile(panelPath, panelSource
    .replace(
      "import { definePanel } from '@holo-js/panels'\n",
      "import { definePanel } from '@holo-js/panels'\nimport { moneyPlugin } from '@holo-js/panels-plugin-money'\n",
    )
    .replace('.discoverClusters()\n', '.discoverClusters()\n  .plugin(moneyPlugin)\n'))
  await runHolo(projectRoot, packageManagerEnvironment, 'make:resource', 'Post', '--panel', 'admin')
  await runHolo(projectRoot, packageManagerEnvironment, 'prepare')
  await writeFile(join(projectRoot, 'tsconfig.panels.json'), `${JSON.stringify({
    compilerOptions: {
      baseUrl: '.',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      noEmit: true,
      paths: {
        '~/*': ['./*'],
      },
      skipLibCheck: true,
      strict: true,
      target: 'ES2022',
      types: [],
    },
    include: [
      '.holo-js/generated/panels/**/*.ts',
      'server/admin/**/*.ts',
      'server/models/Post.ts',
    ],
  }, null, 2)}\n`)
  await run(bunExecutable, ['run', 'tsc', '--', '-p', 'tsconfig.panels.json'], projectRoot, packageManagerEnvironment)

  const registry = JSON.parse(await readFile(
    join(projectRoot, '.holo-js/generated/panels/registry.json'),
    'utf8',
  ))
  const kinds = new Set(registry.definitions?.map(definition => definition.kind))
  if (!kinds.has('panel') || !kinds.has('resource')) {
    throw new Error(`Generated Panels registry is incomplete in ${basename(projectRoot)}`)
  }

  const rendererSubpath = fixture.framework === 'next'
    ? 'react'
    : fixture.framework === 'nuxt'
      ? 'vue'
      : 'svelte'
  const rendererModule = await readFile(
    join(projectRoot, '.holo-js/generated/panels/plugin-renderers.ts'),
    'utf8',
  )
  if (!rendererModule.includes(`from '@holo-js/panels-plugin-money/${rendererSubpath}'`)) {
    throw new Error(`Packed money plugin did not generate its ${rendererSubpath} renderer registry`)
  }

  const pluginManifest = JSON.parse(await readFile(
    join(projectRoot, '.holo-js/generated/panels/plugins.json'),
    'utf8',
  ))
  const moneyAsset = pluginManifest.assets?.find(asset => asset.id === 'holo.money.money-style')
  if (!moneyAsset?.publicPath || !/^\/_holo\/panels\/plugins\/holo\.money\/[a-f0-9]{16}-money\.css$/u.test(moneyAsset.publicPath)) {
    throw new Error('Packed money plugin did not generate a fingerprinted stylesheet asset')
  }
  if (!pluginManifest.translations?.some(translation => translation.namespace === 'holo.money')) {
    throw new Error('Packed money plugin did not generate its translation metadata')
  }
  if (!pluginManifest.icons?.some(icon => icon.id === 'holo.money.currency')) {
    throw new Error('Packed money plugin did not generate its icon metadata')
  }
  await access(join(projectRoot, `public${moneyAsset.publicPath}`))
}

async function validatePackedShieldCommands(projectRoot, packageManagerEnvironment) {
  await mkdir(join(projectRoot, 'storage'), { recursive: true })
  await runHoloDatabaseCommand(projectRoot, packageManagerEnvironment, 'shield:setup')
  const before = await runHoloDatabaseCommand(projectRoot, packageManagerEnvironment, 'shield:diff')
  const beforePayload = JSON.parse(before.stdout.trim().split('\n').at(-1))
  if (!Array.isArray(beforePayload.missing) || beforePayload.missing.length === 0) {
    throw new Error('Packed shield:diff did not discover prepared permissions')
  }
  await runHoloDatabaseCommand(projectRoot, packageManagerEnvironment, 'shield:sync')
  const after = await runHoloDatabaseCommand(projectRoot, packageManagerEnvironment, 'shield:diff')
  const afterPayload = JSON.parse(after.stdout.trim().split('\n').at(-1))
  if (afterPayload.missing.length !== 0 || afterPayload.stale.length !== 0) {
    throw new Error('Packed Shield commands did not synchronize prepared permissions')
  }
}

async function collectSnapshot(root, directory = root, snapshot = new Map()) {
  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isDirectory() && excludedSnapshotDirectories.has(entry.name)) {
      continue
    }

    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectSnapshot(root, path, snapshot)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const contents = await readFile(path)
    snapshot.set(toProjectPath(root, path), createHash('sha256').update(contents).digest('hex'))
  }

  return snapshot
}

function assertEqualSnapshots(before, after, label) {
  const beforeEntries = JSON.stringify([...before.entries()])
  const afterEntries = JSON.stringify([...after.entries()])
  if (beforeEntries !== afterEntries) {
    throw new Error(`${label} changed the project on its second run`)
  }
}

async function assertAdapterSelection(projectRoot, expectedAdapter) {
  const manifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies }
  const umbrellaManifest = JSON.parse(await readFile(
    join(projectRoot, 'node_modules/@holo-js/panels/package.json'),
    'utf8',
  ))

  if (dependencies[expectedAdapter] !== umbrellaManifest.version) {
    throw new Error(`${expectedAdapter} does not use the installed umbrella version`)
  }

  for (const { adapter } of fixtures) {
    const installed = typeof dependencies[adapter] === 'string'
    const installedManifest = join(projectRoot, 'node_modules', ...adapter.split('/'), 'package.json')
    const resolvable = await stat(installedManifest).then(() => true).catch(() => false)
    if (adapter === expectedAdapter && !installed) {
      throw new Error(`${expectedAdapter} was not added to ${basename(projectRoot)}`)
    }
    if (adapter === expectedAdapter && !resolvable) {
      throw new Error(`${expectedAdapter} was not installed in ${basename(projectRoot)}`)
    }
    if (adapter === expectedAdapter && resolvable) {
      const adapterManifest = JSON.parse(await readFile(installedManifest, 'utf8'))
      if (adapterManifest.name !== expectedAdapter) {
        throw new Error(`${expectedAdapter} resolved to the wrong packed package`)
      }
    }
    if (adapter !== expectedAdapter && installed) {
      throw new Error(`${adapter} was unexpectedly added to ${basename(projectRoot)}`)
    }
    if (adapter !== expectedAdapter && resolvable) {
      throw new Error(`${adapter} was unexpectedly installed in ${basename(projectRoot)}`)
    }
  }
}

async function assertOwnershipManifest(projectRoot, expectedAdapter) {
  const projectManifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
  const ownershipManifest = JSON.parse(await readFile(
    join(projectRoot, '.holo-js/panels/install.json'),
    'utf8',
  ))
  if (
    ownershipManifest.version !== 1
    || ownershipManifest.adapter !== expectedAdapter
    || ownershipManifest.adapterSpecifier !== projectManifest.dependencies?.[expectedAdapter]
    || ownershipManifest.dependencySection !== 'dependencies'
    || ownershipManifest.dependencyOwned !== true
    || !Array.isArray(ownershipManifest.managedArtifacts)
    || ownershipManifest.managedArtifacts.length !== 0
  ) {
    throw new Error(`Unexpected installer ownership state for ${expectedAdapter}`)
  }
}

async function writePreservedFiles(projectRoot) {
  const files = new Map([
    ['server/admin/AdminPanel.ts', "export const adminPanel = 'preserved'\n"],
    ['server/admin/resources/posts/PostResource.ts', "export const postResource = 'preserved'\n"],
    ['resources/panels/custom-field.ts', "export const customField = 'preserved'\n"],
  ])

  for (const [path, contents] of files) {
    const absolutePath = join(projectRoot, path)
    await mkdir(resolve(absolutePath, '..'), { recursive: true })
    await writeFile(absolutePath, contents)
  }

  return files
}

async function assertPreservedFiles(projectRoot, files) {
  for (const [path, contents] of files) {
    const actual = await readFile(join(projectRoot, path), 'utf8')
    if (actual !== contents) {
      throw new Error(`panels:uninstall did not preserve ${path}`)
    }
  }
}

async function assertOwnedAdapterRemoved(projectRoot, adapter) {
  const manifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
  if (typeof manifest.dependencies?.[adapter] !== 'undefined') {
    throw new Error(`panels:uninstall left its owned ${adapter} dependency`)
  }

  const installedManifest = join(projectRoot, 'node_modules', ...adapter.split('/'), 'package.json')
  if (await stat(installedManifest).then(() => true).catch(() => false)) {
    throw new Error(`panels:uninstall left its owned ${adapter} package installed`)
  }
}

async function assertPluginActivation(projectRoot) {
  const config = await readFile(join(projectRoot, 'config/app.ts'), 'utf8')
    .catch(async () => await readFile(join(projectRoot, 'config/app.mjs'), 'utf8'))

  if (!config.includes('@holo-js/panels')) {
    throw new Error(`plugin:add did not activate @holo-js/panels in ${basename(projectRoot)}`)
  }
}

async function assertPackedHoloPackages(projectRoot, packedPackages) {
  const projectManifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
  const pending = Object.keys({
    ...projectManifest.dependencies,
    ...projectManifest.devDependencies,
  }).filter(packageName => packageName.startsWith('@holo-js/'))
  const checked = new Set()

  while (pending.length > 0) {
    const packageName = pending.shift()
    if (!packageName || checked.has(packageName)) {
      continue
    }
    checked.add(packageName)

    if (typeof packedPackages[packageName] !== 'string') {
      throw new Error(`${packageName} was not sourced from a local packed artifact`)
    }

    const packageRoot = join(projectRoot, 'node_modules', ...packageName.split('/'))
    const packageStats = await lstat(packageRoot)
    if (packageStats.isSymbolicLink()) {
      throw new Error(`${packageName} resolved through a source-directory symlink`)
    }

    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
    if (manifest.name !== packageName) {
      throw new Error(`${packageName} resolved to the wrong packed package identity`)
    }

    for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
      if (dependencyName.startsWith('@holo-js/')) {
        pending.push(dependencyName)
      }
    }
  }
}

async function assertRegistryPackages(projectRoot) {
  const projectManifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'))
  const lockfile = await readFile(join(projectRoot, 'package-lock.json'), 'utf8')
  assertRegistryDependencyGraph(basename(projectRoot), lockfile, projectManifest.overrides)

  const pending = Object.keys({
    ...projectManifest.dependencies,
    ...projectManifest.devDependencies,
  }).filter(packageName => packageName.startsWith('@holo-js/'))
  const checked = new Set()

  while (pending.length > 0) {
    const packageName = pending.shift()
    if (!packageName || checked.has(packageName)) {
      continue
    }
    checked.add(packageName)

    const packageRoot = join(projectRoot, 'node_modules', ...packageName.split('/'))
    const packageStats = await lstat(packageRoot)
    if (packageStats.isSymbolicLink()) {
      throw new Error(`${packageName} resolved through a source-directory symlink`)
    }

    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
    if (manifest.name !== packageName) {
      throw new Error(`${packageName} resolved to the wrong registry package identity`)
    }
    assertRegistryPackageVersion(packageName, manifest.version, panelsVersion, holoCompatibilityRange)

    for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
      if (dependencyName.startsWith('@holo-js/')) {
        pending.push(dependencyName)
      }
    }
  }
}

async function assertPackedContributions(projectRoot) {
  const registry = JSON.parse(await readFile(
    join(projectRoot, '.holo-js/generated/panels/registry.json'),
    'utf8',
  ))
  if (registry.version !== 1 || !Array.isArray(registry.definitions) || registry.definitions.length !== 0) {
    throw new Error('Packed Panels prepare did not generate the empty panel registry')
  }

  const kernelPath = join(projectRoot, 'node_modules/@holo-js/kernel/dist/index.mjs')
  const kernel = await import(pathToFileURL(kernelPath).href)
  const plugins = await kernel.loadHoloPluginDefinitions(projectRoot, ['@holo-js/panels'])
  const plugin = plugins[0]

  if (!plugin || plugin.definition.id !== 'panels') {
    throw new Error('The public Holo loader did not resolve the packed Panels manifest')
  }

  const packageRoot = join(projectRoot, 'node_modules/@holo-js/panels')
  const installedPackageRoot = await realpath(packageRoot)
  const installedEntryPath = await realpath(plugin.entryPath)
  if (!installedEntryPath.startsWith(`${installedPackageRoot}${sep}`)) {
    throw new Error(`The public Holo loader resolved Panels at ${installedEntryPath} outside ${installedPackageRoot}`)
  }

  const bootModules = await kernel.loadHoloPluginBootModules(projectRoot, plugins)
  const boot = bootModules[0]
  if (!boot || boot.runtime !== './dist/runtime.mjs' || typeof boot.module.default !== 'function') {
    throw new Error('The public Holo loader did not resolve the packed Panels runtime contribution')
  }
  boot.module.default()

  const migrationsSpecifier = plugin.definition.contributes?.migrations?.publish
  if (typeof migrationsSpecifier !== 'string') {
    throw new Error('The packed Panels manifest did not declare migrations')
  }
  const migrationsPath = kernel.resolveHoloPluginModulePath(projectRoot, plugin, migrationsSpecifier)
  const migrationsModule = await import(pathToFileURL(migrationsPath).href)
  if (!Array.isArray(migrationsModule.default)) {
    throw new Error('The packed Panels migrations contribution did not export a migration list')
  }

  const prepareSpecifier = plugin.definition.contributes?.project?.prepare
  if (typeof prepareSpecifier !== 'string') {
    throw new Error('The packed Panels manifest did not declare project preparation')
  }
  const preparePath = kernel.resolveHoloPluginModulePath(projectRoot, plugin, prepareSpecifier)
  const prepareModule = await import(pathToFileURL(preparePath).href)
  if (typeof prepareModule.default?.prepare !== 'function') {
    throw new Error('The packed Panels prepare contribution was not loadable')
  }
}

async function validateInstalledFixture(projectRoot, fixture, packageManagerEnvironment, sourceLabel) {
  await runHolo(projectRoot, packageManagerEnvironment, 'plugin:add', '@holo-js/panels')
  await runHolo(projectRoot, packageManagerEnvironment, 'plugin:add', '@holo-js/panels-shield')
  await assertPluginActivation(projectRoot)
  await runHolo(projectRoot, packageManagerEnvironment, 'prepare')
  await assertPackedContributions(projectRoot)

  const firstInstall = await runHolo(projectRoot, packageManagerEnvironment, 'panels:install')
  if (!/install/i.test(`${firstInstall.stdout}\n${firstInstall.stderr}`)) {
    throw new Error(`panels:install did not report its result for ${fixture.framework}`)
  }
  await assertAdapterSelection(projectRoot, fixture.adapter)
  await assertOwnershipManifest(projectRoot, fixture.adapter)
  await validateGeneratedPanelArtifacts(projectRoot, packageManagerEnvironment, fixture)
  await validatePackedShieldCommands(projectRoot, packageManagerEnvironment)

  const beforeSecondInstall = await collectSnapshot(projectRoot)
  await runHolo(projectRoot, packageManagerEnvironment, 'panels:install')
  const afterSecondInstall = await collectSnapshot(projectRoot)
  assertEqualSnapshots(beforeSecondInstall, afterSecondInstall, `${fixture.framework} panels:install`)

  const preservedFiles = await writePreservedFiles(projectRoot)
  const uninstall = await runHolo(projectRoot, packageManagerEnvironment, 'panels:uninstall')
  await assertPreservedFiles(projectRoot, preservedFiles)
  await assertOwnedAdapterRemoved(projectRoot, fixture.adapter)
  await assertPluginActivation(projectRoot)

  const uninstallOutput = `${uninstall.stdout}\n${uninstall.stderr}`
  if (!/preserv|user-authored|published ui/i.test(uninstallOutput)) {
    throw new Error(`panels:uninstall did not report preserved user files for ${fixture.framework}`)
  }

  const ownershipManifestPath = join(projectRoot, '.holo-js/panels/install.json')
  if (await stat(ownershipManifestPath).then(() => true).catch(() => false)) {
    throw new Error(`panels:uninstall left its ownership manifest in ${fixture.framework}`)
  }

  console.log(`Validated ${sourceLabel} P0-C lifecycle for ${fixture.framework}`)
}

async function validatePackedFixture(temporaryRoot, fixture, packedPackages, controlledPackageManager) {
  const projectRoot = await createFixture(
    temporaryRoot,
    fixture,
    controlledPackageManager.environment,
    localHoloCliPath,
  )
  await installPackedPanels(projectRoot, packedPackages, controlledPackageManager)
  await assertPackedHoloPackages(projectRoot, packedPackages)
  await validateInstalledFixture(projectRoot, fixture, controlledPackageManager.environment, 'packed')
}

async function validateRegistryFixture(temporaryRoot, fixture, registryCliPath) {
  const projectRoot = await createFixture(temporaryRoot, fixture, process.env, registryCliPath)
  await installRegistryPanels(projectRoot)
  await assertRegistryPackages(projectRoot)
  await validateInstalledFixture(projectRoot, fixture, process.env, 'registry')
}

const temporaryRoot = await mkdtemp(join(tmpdir(), 'holo-panels-p0c-'))

try {
  const fixturesRoot = join(temporaryRoot, 'fixtures')
  await mkdir(fixturesRoot)
  if (registryMode) {
    const registryCliPath = await installRegistryCli(temporaryRoot)
    for (const fixture of fixtures) {
      await validateRegistryFixture(fixturesRoot, fixture, registryCliPath)
    }
  } else {
    const tarballRoot = join(temporaryRoot, 'packages')
    await mkdir(tarballRoot)
    const packedPackages = await packLocalPackages(tarballRoot)
    const controlledPackageManager = await createControlledPackageManager(temporaryRoot, packedPackages)
    for (const fixture of fixtures) {
      await validatePackedFixture(fixturesRoot, fixture, packedPackages, controlledPackageManager)
    }
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true })
}

console.log(`Validated ${registryMode ? 'registry' : 'packed'} Holo Panels installation across Next, Nuxt, and SvelteKit`)
