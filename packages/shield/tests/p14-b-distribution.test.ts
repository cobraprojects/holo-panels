import type { MigrationDefinition } from '@holo-js/db'
import { describe, expect, expectTypeOf, it } from 'vitest'
import commands, {
  shieldDiffCommand,
  shieldMakeRoleCommand,
  shieldSeedCommand,
  shieldSetupCommand,
  shieldSyncCommand,
} from '../src/holo-commands'
import plugin from '../src/holo-plugin'
import migrations, { migrations as namedMigrations } from '../src/migrations'

describe('Shield Holo plugin distribution', () => {
  it('publishes the stable Shield migration through the Holo plugin manifest', () => {
    expect(plugin).toEqual({
      id: 'panels-shield',
      name: 'Holo Panels Shield',
      description: 'Role and permission management for Holo Panels',
      contributes: {
        cli: { commands: './dist/holo-commands.mjs' },
        migrations: { publish: './dist/migrations.mjs' },
      },
    })
    expect(namedMigrations).toBe(migrations)
    expect(namedMigrations.map(migration => migration.name)).toEqual([
      '2026_07_28_000001_create_panel_shield_tables',
    ])
    expectTypeOf(namedMigrations).toMatchTypeOf<readonly MigrationDefinition[]>()
  })

  it('publishes the five approved Shield command definitions in stable order', () => {
    expect(commands).toEqual([
      shieldSetupCommand,
      shieldDiffCommand,
      shieldSyncCommand,
      shieldMakeRoleCommand,
      shieldSeedCommand,
    ])
    expect(commands.map(command => command.name)).toEqual([
      'shield:setup',
      'shield:diff',
      'shield:sync',
      'shield:make-role',
      'shield:seed',
    ])
    expect(Object.isFrozen(commands)).toBe(true)
    expect(commands.every(command => Object.isFrozen(command))).toBe(true)
  })

  it('enforces destructive sync confirmation before reaching unavailable host services', async () => {
    const loadProject = async (): Promise<unknown> => ({})
    const projectRoot = process.cwd()
    const withRuntime = async (): Promise<never> => { throw new Error('not reached') }

    await expect(shieldSyncCommand.run({ args: [], flags: { 'remove-stale': true }, loadProject, projectRoot, withRuntime }))
      .rejects.toThrow('requires both --remove-stale and --confirm')
    await expect(shieldSyncCommand.run({ args: [], flags: { confirm: true }, loadProject, projectRoot, withRuntime }))
      .rejects.toThrow('--confirm is valid only with --remove-stale')
  })

  it('validates role arguments before reaching unavailable host services', async () => {
    const loadProject = async (): Promise<unknown> => ({})
    const projectRoot = process.cwd()
    const withRuntime = async (): Promise<never> => { throw new Error('not reached') }

    await expect(shieldMakeRoleCommand.run({ args: [], flags: {}, loadProject, projectRoot, withRuntime }))
      .rejects.toThrow('requires exactly one role ID')
    await expect(shieldMakeRoleCommand.run({ args: ['invalid role'], flags: {}, loadProject, projectRoot, withRuntime }))
      .rejects.toThrow('stable identifier')
  })
})
