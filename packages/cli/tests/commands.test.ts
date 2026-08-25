import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import commands from '../src/index'

const tempDirectories: string[] = []
const originalPath = process.env.PATH

type FixtureOptions = {
  readonly frameworkPackage?: string
  readonly adapter?: string
  readonly adapterPackageName?: string
  readonly adapterVersion?: string
  readonly activationCount?: number
  readonly packageManager?: 'bun' | 'npm' | 'pnpm' | 'yarn'
  readonly packageManagerExitCodes?: readonly number[]
  readonly omitPackageManager?: boolean
  readonly lockfile?: string
}

async function createFixture(options: FixtureOptions = {}): Promise<{ projectRoot: string, installLog: string }> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-cli-'))
  tempDirectories.push(projectRoot)
  const binPath = join(projectRoot, 'test-bin')
  const installLog = join(projectRoot, 'install.log')
  await mkdir(join(projectRoot, 'config'), { recursive: true })
  await mkdir(binPath, { recursive: true })
  await mkdir(join(projectRoot, 'node_modules/@holo-js/panels'), { recursive: true })
  const activations = Array.from({ length: options.activationCount ?? 1 }, () => "'@holo-js/panels'").join(', ')
  await writeFile(join(projectRoot, 'config/app.ts'), `export default { plugins: [${activations}] }\n`)
  await writeFile(join(projectRoot, 'package.json'), `${JSON.stringify({
    name: 'panels-command-fixture',
    private: true,
    ...(!options.omitPackageManager ? { packageManager: `${options.packageManager ?? 'bun'}@1.0.0` } : {}),
    dependencies: {
      '@holo-js/panels': '^1.2.3',
      [options.frameworkPackage ?? 'next']: '^16.0.0',
      ...(options.adapter ? { [options.adapter]: '^1.2.3' } : {}),
    },
  }, null, 2)}\n`)
  await writeFile(join(projectRoot, 'node_modules/@holo-js/panels/package.json'), '{"name":"@holo-js/panels","version":"1.2.3"}\n')
  if (options.adapter) {
    await mkdir(join(projectRoot, 'node_modules', ...options.adapter.split('/')), { recursive: true })
    await writeFile(join(projectRoot, 'node_modules', ...options.adapter.split('/'), 'package.json'), `${JSON.stringify({
      name: options.adapterPackageName ?? options.adapter,
      version: options.adapterVersion ?? '1.2.3',
    })}\n`)
  }
  if (options.lockfile) await writeFile(join(projectRoot, options.lockfile), 'original-lock\n')
  const runnerSource = `#!/usr/bin/env node
const { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { basename, join } = require('node:path')
const root = process.cwd()
const countPath = join(root, '.package-manager-count')
const count = existsSync(countPath) ? Number(readFileSync(countPath, 'utf8')) : 0
writeFileSync(countPath, String(count + 1))
appendFileSync(${JSON.stringify(installLog)}, basename(process.argv[1]) + ' ' + process.argv.slice(2).join(' ') + '\\n')
const exitCodes = ${JSON.stringify(options.packageManagerExitCodes ?? [0])}
const exitCode = exitCodes[count] ?? exitCodes[exitCodes.length - 1] ?? 0
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const dependencies = { ...manifest.devDependencies, ...manifest.dependencies }
const adapters = ['@holo-js/panels-next', '@holo-js/panels-nuxt', '@holo-js/panels-sveltekit']
for (const adapter of adapters) {
  const adapterRoot = join(root, 'node_modules', ...adapter.split('/'))
  rmSync(adapterRoot, { recursive: true, force: true })
  if (dependencies[adapter]) {
    mkdirSync(adapterRoot, { recursive: true })
    writeFileSync(join(adapterRoot, 'package.json'), JSON.stringify({ name: adapter, version: dependencies[adapter] }))
  }
}
const lockfiles = { bun: 'bun.lock', pnpm: 'pnpm-lock.yaml', yarn: 'yarn.lock', npm: 'package-lock.json' }
const lockfile = lockfiles[basename(process.argv[1])]
if (lockfile && existsSync(join(root, lockfile))) {
  const hasAdapter = adapters.some(adapter => dependencies[adapter])
  writeFileSync(join(root, lockfile), hasAdapter ? 'adapter-lock\\n' : 'original-lock\\n')
}
if (exitCode !== 0) process.exit(exitCode)
`
  for (const packageManager of ['bun', 'npm', 'pnpm', 'yarn']) {
    const executablePath = join(binPath, packageManager)
    await writeFile(executablePath, runnerSource)
    await chmod(executablePath, 0o755)
  }
  process.env.PATH = `${binPath}${delimiter}${originalPath ?? ''}`
  return { projectRoot, installLog }
}

function command(name: string) {
  return commands.find(candidate => candidate.name === name)!
}

function context(projectRoot: string) {
  return {
    projectRoot,
    cwd: projectRoot,
    args: [],
    flags: {},
    loadProject: async () => ({}),
  }
}

async function readManifest(projectRoot: string): Promise<{ dependencies?: Record<string, string> }> {
  return JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>
  }
}

beforeEach(() => {
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
})

afterEach(async () => {
  process.env.PATH = originalPath
  vi.restoreAllMocks()
  await Promise.all(tempDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Holo Panels commands', () => {
  it('exports the command module shape consumed by Holo', () => {
    expect(commands.map(item => item.name)).toEqual([
      'panels:install',
      'panels:uninstall',
      'panels:theme:build',
      'panels:theme:watch',
      'panels:publish-ui',
      'make:panel',
      'make:resource',
      'make:page',
      'make:resource-page',
      'make:relation-manager',
      'make:form-field',
      'make:infolist-entry',
      'make:table-column',
      'make:filter',
      'make:action',
      'make:widget',
      'make:cluster',
      'make:importer',
      'make:exporter',
    ])
    expect(Object.isFrozen(commands)).toBe(true)
  })

  it.each([
    ['next', '@holo-js/panels-next'],
    ['nuxt', '@holo-js/panels-nuxt'],
    ['@sveltejs/kit', '@holo-js/panels-sveltekit'],
  ])('installs only the adapter matching %s and is idempotent', async (frameworkPackage, adapter) => {
    const { projectRoot, installLog } = await createFixture({ frameworkPackage })

    await command('panels:install').run(context(projectRoot))

    const installed = await readManifest(projectRoot)
    expect(installed.dependencies?.[adapter]).toBe('1.2.3')
    expect(Object.keys(installed.dependencies ?? {}).filter(name => name.startsWith('@holo-js/panels-'))).toEqual([adapter])
    expect(await readFile(installLog, 'utf8')).toBe('bun install\n')
    const ownership = JSON.parse(await readFile(join(projectRoot, '.holo-js/panels/install.json'), 'utf8'))
    expect(ownership).toEqual({
      version: 1,
      adapter,
      adapterSpecifier: '1.2.3',
      dependencySection: 'dependencies',
      dependencyOwned: true,
      managedArtifacts: [],
    })

    await command('panels:install').run(context(projectRoot))

    expect(await readFile(installLog, 'utf8')).toBe('bun install\n')
    expect(process.stdout.write).toHaveBeenLastCalledWith(expect.stringContaining('no changes'))
  })

  it('requires exactly one plugin:add-owned activation', async () => {
    const missing = await createFixture({ activationCount: 0 })
    await expect(command('panels:install').run(context(missing.projectRoot))).rejects.toThrow('appear exactly once')

    const duplicate = await createFixture({ activationCount: 2 })
    await expect(command('panels:install').run(context(duplicate.projectRoot))).rejects.toThrow('appear exactly once')
  })

  it('does not mistake package references outside the plugins property for activation', async () => {
    const { projectRoot } = await createFixture({ activationCount: 0 })
    await writeFile(join(projectRoot, 'config/app.ts'), "const packageName = '@holo-js/panels'\nexport default { plugins: [] }\n")

    await expect(command('panels:install').run(context(projectRoot))).rejects.toThrow('appear exactly once')
  })

  it('rejects ambiguous framework dependencies', async () => {
    const { projectRoot } = await createFixture()
    const manifest = await readManifest(projectRoot)
    manifest.dependencies = { ...manifest.dependencies, nuxt: '^4.0.0' }
    await writeFile(join(projectRoot, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)

    await expect(command('panels:install').run(context(projectRoot))).rejects.toThrow('Multiple frameworks detected')
  })

  it('rolls back package.json when dependency installation fails', async () => {
    const { projectRoot, installLog } = await createFixture({
      packageManagerExitCodes: [7, 0],
      lockfile: 'bun.lock',
    })
    const original = await readFile(join(projectRoot, 'package.json'), 'utf8')

    await expect(command('panels:install').run(context(projectRoot))).rejects.toThrow('exit code 7')

    expect(await readFile(join(projectRoot, 'package.json'), 'utf8')).toBe(original)
    expect(await readFile(join(projectRoot, 'bun.lock'), 'utf8')).toBe('original-lock\n')
    await expect(readFile(join(projectRoot, 'node_modules/@holo-js/panels-next/package.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(installLog, 'utf8')).toBe('bun install\nbun install\n')
    await expect(readFile(join(projectRoot, '.holo-js/panels/install.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('reports an explicit recovery failure when the original dependency state cannot be reconciled', async () => {
    const { projectRoot } = await createFixture({ packageManagerExitCodes: [7, 8] })

    await expect(command('panels:install').run(context(projectRoot))).rejects.toThrow('dependency recovery failed')
  })

  it('uninstalls owned dependency while preserving activation and user files', async () => {
    const { projectRoot, installLog } = await createFixture()
    await command('panels:install').run(context(projectRoot))
    const panelFile = join(projectRoot, 'server/admin/AdminPanel.ts')
    const publishedUi = join(projectRoot, 'resources/panels/ui.ts')
    await mkdir(join(projectRoot, 'server/admin'), { recursive: true })
    await mkdir(join(projectRoot, 'resources/panels'), { recursive: true })
    await writeFile(panelFile, 'panel\n')
    await writeFile(publishedUi, 'published ui\n')

    await command('panels:uninstall').run(context(projectRoot))

    const manifest = await readManifest(projectRoot)
    expect(manifest.dependencies?.['@holo-js/panels-next']).toBeUndefined()
    expect(manifest.dependencies?.['@holo-js/panels']).toBe('^1.2.3')
    expect(await readFile(join(projectRoot, 'config/app.ts'), 'utf8')).toContain("'@holo-js/panels'")
    expect(await readFile(panelFile, 'utf8')).toBe('panel\n')
    expect(await readFile(publishedUi, 'utf8')).toBe('published ui\n')
    expect(await readFile(installLog, 'utf8')).toBe('bun install\nbun install\n')
    expect(process.stdout.write).toHaveBeenLastCalledWith(expect.stringContaining('Preserved @holo-js/panels activation'))
  })

  it('does not remove a pre-existing adapter dependency', async () => {
    const { projectRoot } = await createFixture({ adapter: '@holo-js/panels-next' })
    await command('panels:install').run(context(projectRoot))

    await command('panels:uninstall').run(context(projectRoot))

    expect((await readManifest(projectRoot)).dependencies?.['@holo-js/panels-next']).toBe('^1.2.3')
  })

  it.each([
    ['bun', 'bun.lock'],
    ['pnpm', 'pnpm-lock.yaml'],
    ['yarn', 'yarn.lock'],
    ['npm', 'package-lock.json'],
  ] as const)('uses Holo package-manager convention for %s', async (packageManager, lockfile) => {
    const { projectRoot, installLog } = await createFixture({ packageManager, lockfile })

    await command('panels:install').run(context(projectRoot))

    expect(await readFile(installLog, 'utf8')).toBe(`${packageManager} install\n`)
  })

  it.each([
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['package-lock.json', 'npm'],
  ] as const)('falls back to %s according to Holo lockfile priority', async (lockfile, packageManager) => {
    const { projectRoot, installLog } = await createFixture({ omitPackageManager: true, lockfile })

    await command('panels:install').run(context(projectRoot))

    expect(await readFile(installLog, 'utf8')).toBe(`${packageManager} install\n`)
  })

  it('rejects an unsupported explicit package manager before mutation', async () => {
    const { projectRoot, installLog } = await createFixture()
    const manifestPath = join(projectRoot, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>
    manifest.packageManager = 'deno@2.0.0'
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

    await expect(command('panels:install').run(context(projectRoot))).rejects.toThrow('Unsupported package manager')
    await expect(readFile(installLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a predeclared adapter whose installed package name is invalid', async () => {
    const { projectRoot } = await createFixture({
      adapter: '@holo-js/panels-next',
      adapterPackageName: '@holo-js/not-panels-next',
    })

    await expect(command('panels:install').run(context(projectRoot))).rejects.toThrow('invalid name or version')
  })

  it('rejects a predeclared adapter whose installed version is not lockstep', async () => {
    const { projectRoot } = await createFixture({
      adapter: '@holo-js/panels-next',
      adapterVersion: '1.2.4',
    })

    await expect(command('panels:install').run(context(projectRoot))).rejects.toThrow('does not match')
  })

  it('rejects ownership state tampering before package-manager execution', async () => {
    const { projectRoot, installLog } = await createFixture()
    await command('panels:install').run(context(projectRoot))
    const ownershipPath = join(projectRoot, '.holo-js/panels/install.json')
    const ownership = JSON.parse(await readFile(ownershipPath, 'utf8')) as Record<string, unknown>
    ownership.adapterSpecifier = '1.2.4'
    await writeFile(ownershipPath, `${JSON.stringify(ownership, null, 2)}\n`)

    await expect(command('panels:uninstall').run(context(projectRoot))).rejects.toThrow('Invalid install ownership state')
    expect(await readFile(installLog, 'utf8')).toBe('bun install\n')
  })

  it('rejects a malformed exact-version value in ownership state', async () => {
    const { projectRoot } = await createFixture()
    await command('panels:install').run(context(projectRoot))
    const ownershipPath = join(projectRoot, '.holo-js/panels/install.json')
    const ownership = JSON.parse(await readFile(ownershipPath, 'utf8')) as Record<string, unknown>
    ownership.adapterSpecifier = '1.2.3-..'
    await writeFile(ownershipPath, `${JSON.stringify(ownership, null, 2)}\n`)

    await expect(command('panels:uninstall').run(context(projectRoot))).rejects.toThrow('Invalid install ownership state')
  })

  it('rejects a symlinked ownership parent before package-manager execution', async () => {
    const { projectRoot, installLog } = await createFixture()
    const externalRoot = await mkdtemp(join(tmpdir(), 'holo-panels-external-'))
    tempDirectories.push(externalRoot)
    await writeFile(join(externalRoot, 'sentinel'), 'safe\n')
    await symlink(externalRoot, join(projectRoot, '.holo-js'))

    await expect(command('panels:install').run(context(projectRoot))).rejects.toThrow('Refusing symlinked project path')
    await expect(readFile(installLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readFile(join(externalRoot, 'sentinel'), 'utf8')).toBe('safe\n')
  })

  it('rejects a symlinked ownership target without modifying its destination', async () => {
    const { projectRoot, installLog } = await createFixture()
    await command('panels:install').run(context(projectRoot))
    const externalRoot = await mkdtemp(join(tmpdir(), 'holo-panels-external-'))
    tempDirectories.push(externalRoot)
    const externalOwnership = join(externalRoot, 'install.json')
    await writeFile(externalOwnership, 'external\n')
    const ownershipPath = join(projectRoot, '.holo-js/panels/install.json')
    await rm(ownershipPath)
    await symlink(externalOwnership, ownershipPath)

    await expect(command('panels:uninstall').run(context(projectRoot))).rejects.toThrow('Refusing symlinked project path')
    expect(await readFile(installLog, 'utf8')).toBe('bun install\n')
    expect(await readFile(externalOwnership, 'utf8')).toBe('external\n')
  })

  it('rejects a symlinked package manifest before mutating dependencies', async () => {
    const { projectRoot, installLog } = await createFixture()
    const externalRoot = await mkdtemp(join(tmpdir(), 'holo-panels-external-'))
    tempDirectories.push(externalRoot)
    const externalManifest = join(externalRoot, 'package.json')
    await writeFile(externalManifest, await readFile(join(projectRoot, 'package.json'), 'utf8'))
    await rm(join(projectRoot, 'package.json'))
    await symlink(externalManifest, join(projectRoot, 'package.json'))

    await expect(command('panels:install').run(context(projectRoot))).rejects.toThrow('Refusing symlinked project path')
    await expect(readFile(installLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('preserves an owned adapter dependency after the user changes its specifier', async () => {
    const { projectRoot } = await createFixture()
    await command('panels:install').run(context(projectRoot))
    const manifest = await readManifest(projectRoot)
    manifest.dependencies = { ...manifest.dependencies, '@holo-js/panels-next': '^2.0.0' }
    await writeFile(join(projectRoot, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)

    await command('panels:uninstall').run(context(projectRoot))

    expect((await readManifest(projectRoot)).dependencies?.['@holo-js/panels-next']).toBe('^2.0.0')
    expect(process.stdout.write).toHaveBeenLastCalledWith(expect.stringContaining('Preserved modified'))
  })

  it('uses the loaded project manifest path for supported config module variants', async () => {
    const { projectRoot } = await createFixture()
    const customConfig = join(projectRoot, 'config/custom-app.mjs')
    await writeFile(customConfig, "export default { plugins: ['@holo-js/panels'] }\n")
    await writeFile(join(projectRoot, 'config/app.ts'), 'export default { plugins: [] }\n')
    const customContext = {
      ...context(projectRoot),
      loadProject: async () => ({ manifestPath: customConfig }),
    }

    await command('panels:install').run(customContext)

    expect((await readManifest(projectRoot)).dependencies?.['@holo-js/panels-next']).toBe('1.2.3')
  })

  it('prefers a valid generated framework descriptor over dependency heuristics', async () => {
    const { projectRoot } = await createFixture({ frameworkPackage: 'unrelated-framework-runtime' })
    await mkdir(join(projectRoot, '.holo-js/framework'), { recursive: true })
    await writeFile(join(projectRoot, '.holo-js/framework/project.json'), '{"framework":"nuxt"}\n')

    await command('panels:install').run(context(projectRoot))

    expect((await readManifest(projectRoot)).dependencies?.['@holo-js/panels-nuxt']).toBe('1.2.3')
  })

  it('rejects a stale framework descriptor that conflicts with project dependencies', async () => {
    const { projectRoot, installLog } = await createFixture()
    await mkdir(join(projectRoot, '.holo-js/framework'), { recursive: true })
    await writeFile(join(projectRoot, '.holo-js/framework/project.json'), '{"framework":"nuxt"}\n')

    await expect(command('panels:install').run(context(projectRoot))).rejects.toThrow('conflicts with detected next')
    await expect(readFile(installLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects an invalid generated framework descriptor instead of trusting dependency fallback', async () => {
    const { projectRoot, installLog } = await createFixture()
    await mkdir(join(projectRoot, '.holo-js/framework'), { recursive: true })
    await writeFile(join(projectRoot, '.holo-js/framework/project.json'), '{"framework":"unknown"}\n')

    await expect(command('panels:install').run(context(projectRoot))).rejects.toThrow('Invalid framework descriptor')
    await expect(readFile(installLog, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
