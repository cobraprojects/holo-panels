import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shieldSetupCommand } from '../src/holo-commands'

const temporaryRoots: string[] = []

async function project(configuration?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'holo-panels-shield-command-'))
  temporaryRoots.push(root)
  if (configuration !== undefined) {
    await mkdir(join(root, 'config'), { recursive: true })
    await writeFile(join(root, 'config/panels-shield.ts'), configuration, 'utf8')
  }
  return root
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('Shield Holo command runtime', () => {
  it('runs only the approved Shield migration through the host runtime', async () => {
    const migrate = vi.fn(async () => ['2026_07_28_000001_create_panel_shield_tables'])
    const projectRoot = await project()

    await shieldSetupCommand.run({
      args: [],
      flags: {},
      loadProject: async () => ({}),
      projectRoot,
      withRuntime: operation => Promise.resolve(operation({
        holo: { loadedConfig: { app: { env: 'development' } } },
        migrate,
      })),
    })

    expect(migrate).toHaveBeenCalledOnce()
    expect(migrate).toHaveBeenCalledWith({ names: ['2026_07_28_000001_create_panel_shield_tables'] })
  })

  it('blocks production before migration unless application configuration opts in', async () => {
    const migrate = vi.fn(async () => [])
    const blockedRoot = await project()
    const allowedRoot = await project("export default { allowProductionMutations: true }\n")
    const runtime = { holo: { loadedConfig: { app: { env: 'production' } } }, migrate }
    const context = (projectRoot: string) => ({
      args: [],
      flags: {},
      loadProject: async () => ({}),
      projectRoot,
      withRuntime: async <TResult>(operation: (value: typeof runtime) => TResult | Promise<TResult>): Promise<TResult> => await operation(runtime),
    })

    await expect(shieldSetupCommand.run(context(blockedRoot))).rejects.toThrow('disabled in production')
    expect(migrate).not.toHaveBeenCalled()
    await expect(shieldSetupCommand.run(context(allowedRoot))).resolves.toBeUndefined()
    expect(migrate).toHaveBeenCalledOnce()
  })
})
