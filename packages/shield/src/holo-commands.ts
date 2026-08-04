import { access, realpath, stat } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadGeneratedPanelsRegistry } from '@holo-js/panels-cli'
import {
  diffShieldPermissions,
  makeShieldRole,
  seedShieldRoles,
  syncShieldPermissions,
  type ShieldCommandPolicy,
} from './commands'
import {
  defineShieldCommandConfiguration,
  permissionKeysFromPreparedRegistry,
  shieldPreparedRegistry,
  type ShieldCommandConfiguration,
} from './configuration'
import { createHoloShieldRepository } from './database/repository'

type CommandFlagValue = boolean | number | string | readonly string[]

interface ShieldCommandRuntime {
  readonly holo: {
    readonly loadedConfig: {
      readonly app: { readonly env: string }
    }
  }
  migrate(options: { readonly names: readonly string[], readonly pretend?: boolean }): Promise<readonly string[]>
}

interface ShieldCommandContext {
  readonly args: readonly string[]
  readonly flags: Readonly<Record<string, CommandFlagValue>>
  readonly projectRoot: string
  loadProject(): Promise<unknown>
  withRuntime<TResult>(operation: (runtime: ShieldCommandRuntime) => TResult | Promise<TResult>): Promise<TResult>
}

interface ShieldCommandDefinition {
  readonly description: string
  readonly name: string
  readonly usage: string
  run(context: ShieldCommandContext): Promise<void>
}

const SHIELD_MIGRATION = '2026_07_28_000001_create_panel_shield_tables'

function assertNoArguments(context: ShieldCommandContext, command: string): void {
  if (context.args.length > 0) throw new Error(`[Holo Panels Shield] ${command} does not accept positional arguments.`)
}

function assertAllowedFlags(context: ShieldCommandContext, command: string, allowed: ReadonlySet<string>): void {
  const unsupported = Object.keys(context.flags).filter(flag => !allowed.has(flag)).sort((left, right) => left.localeCompare(right))
  if (unsupported.length > 0) {
    throw new Error(`[Holo Panels Shield] ${command} does not accept ${unsupported.map(flag => `--${flag}`).join(', ')}.`)
  }
}

function booleanFlag(context: ShieldCommandContext, name: string): boolean {
  const value = context.flags[name]
  if (typeof value === 'undefined') return false
  if (typeof value !== 'boolean') throw new Error(`[Holo Panels Shield] --${name} must be a boolean flag.`)
  return value
}

async function optionalConfiguration(projectRoot: string): Promise<Readonly<ShieldCommandConfiguration>> {
  const root = await realpath(projectRoot)
  const configurationPath = resolve(root, 'config/panels-shield.ts')
  try {
    await access(configurationPath)
  } catch (error) {
    if (typeof error === 'object' && error !== null && Reflect.get(error, 'code') === 'ENOENT') {
      return defineShieldCommandConfiguration({})
    }
    throw error
  }
  const resolvedPath = await realpath(configurationPath)
  if (!resolvedPath.startsWith(`${root}${sep}`)) throw new Error('[Holo Panels Shield] Shield configuration must remain inside the project root.')
  const metadata = await stat(resolvedPath)
  const module = await import(`${pathToFileURL(resolvedPath).href}?mtime=${metadata.mtimeMs}`) as { readonly default?: unknown }
  return defineShieldCommandConfiguration(module.default as ShieldCommandConfiguration)
}

async function permissionKeys(projectRoot: string): Promise<readonly string[]> {
  const registry = await loadGeneratedPanelsRegistry(projectRoot)
  return permissionKeysFromPreparedRegistry(shieldPreparedRegistry(registry))
}

function policy(runtime: ShieldCommandRuntime, configuration: Readonly<ShieldCommandConfiguration>): ShieldCommandPolicy {
  return Object.freeze({
    allowProduction: configuration.allowProductionMutations,
    environment: runtime.holo.loadedConfig.app.env,
  })
}

function assertMutationAllowed(runtime: ShieldCommandRuntime, configuration: Readonly<ShieldCommandConfiguration>): void {
  if (runtime.holo.loadedConfig.app.env === 'production' && configuration.allowProductionMutations !== true) {
    throw new Error('Shield mutation commands are disabled in production')
  }
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

async function runSetup(context: ShieldCommandContext): Promise<void> {
  assertNoArguments(context, 'shield:setup')
  assertAllowedFlags(context, 'shield:setup', new Set())
  const configuration = await optionalConfiguration(context.projectRoot)
  await context.withRuntime(async (runtime) => {
    assertMutationAllowed(runtime, configuration)
    await runtime.migrate({ names: [SHIELD_MIGRATION] })
  })
}

async function runDiff(context: ShieldCommandContext): Promise<void> {
  assertNoArguments(context, 'shield:diff')
  assertAllowedFlags(context, 'shield:diff', new Set())
  const configuration = await optionalConfiguration(context.projectRoot)
  const keys = await permissionKeys(context.projectRoot)
  await context.withRuntime(async () => {
    print(await diffShieldPermissions(createHoloShieldRepository(configuration.connection), keys))
  })
}

async function runSync(context: ShieldCommandContext): Promise<void> {
  assertNoArguments(context, 'shield:sync')
  assertAllowedFlags(context, 'shield:sync', new Set(['confirm', 'remove-stale']))
  const removeStale = booleanFlag(context, 'remove-stale')
  const confirmed = booleanFlag(context, 'confirm')
  if (confirmed && !removeStale) throw new Error('[Holo Panels Shield] --confirm is valid only with --remove-stale.')
  if (removeStale && !confirmed) throw new Error('[Holo Panels Shield] Removing stale Shield permissions requires both --remove-stale and --confirm.')
  const configuration = await optionalConfiguration(context.projectRoot)
  const keys = await permissionKeys(context.projectRoot)
  await context.withRuntime(async (runtime) => {
    print(await syncShieldPermissions({
      ...policy(runtime, configuration),
      confirmed,
      permissionKeys: keys,
      removeStale,
      repository: createHoloShieldRepository(configuration.connection),
    }))
  })
}

async function runMakeRole(context: ShieldCommandContext): Promise<void> {
  assertAllowedFlags(context, 'shield:make-role', new Set())
  if (context.args.length !== 1 || !context.args[0]?.trim()) throw new Error('[Holo Panels Shield] shield:make-role requires exactly one role ID.')
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(context.args[0])) throw new Error('[Holo Panels Shield] Shield role IDs require a stable identifier.')
  const roleId = context.args[0]
  const configuration = await optionalConfiguration(context.projectRoot)
  await context.withRuntime(async (runtime) => {
    print(await makeShieldRole(createHoloShieldRepository(configuration.connection), roleId, policy(runtime, configuration)))
  })
}

async function runSeed(context: ShieldCommandContext): Promise<void> {
  assertNoArguments(context, 'shield:seed')
  assertAllowedFlags(context, 'shield:seed', new Set())
  const configuration = await optionalConfiguration(context.projectRoot)
  await context.withRuntime(async (runtime) => {
    await seedShieldRoles(
      createHoloShieldRepository(configuration.connection),
      configuration.seeds ?? [],
      policy(runtime, configuration),
    )
  })
}

function defineShieldCommand(definition: ShieldCommandDefinition): Readonly<ShieldCommandDefinition> {
  return Object.freeze({ ...definition })
}

export const shieldSetupCommand = defineShieldCommand({
  name: 'shield:setup',
  description: 'Set up Shield storage through Holo migrations.',
  usage: 'holo shield:setup',
  run: runSetup,
})

export const shieldDiffCommand = defineShieldCommand({
  name: 'shield:diff',
  description: 'Show the difference between prepared and stored Shield permissions.',
  usage: 'holo shield:diff',
  run: runDiff,
})

export const shieldSyncCommand = defineShieldCommand({
  name: 'shield:sync',
  description: 'Synchronize prepared Shield permissions.',
  usage: 'holo shield:sync [--remove-stale --confirm]',
  run: runSync,
})

export const shieldMakeRoleCommand = defineShieldCommand({
  name: 'shield:make-role',
  description: 'Create a Shield role.',
  usage: 'holo shield:make-role <id>',
  run: runMakeRole,
})

export const shieldSeedCommand = defineShieldCommand({
  name: 'shield:seed',
  description: 'Seed configured Shield roles and permissions.',
  usage: 'holo shield:seed',
  run: runSeed,
})

export const commands = Object.freeze([
  shieldSetupCommand,
  shieldDiffCommand,
  shieldSyncCommand,
  shieldMakeRoleCommand,
  shieldSeedCommand,
] as const)

export default commands
