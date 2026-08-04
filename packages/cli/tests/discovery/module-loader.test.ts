import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { componentDefault } from '@holo-js/panels-core'
import { isPanelDefinition, isPageDefinition } from '../../src/discovery/markers'
import { createProjectDiscoveryModuleLoader } from '../../src/discovery/module-loader'

const temporaryDirectories: string[] = []
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('project discovery module loader', () => {
  it('rejects modules outside the project boundary', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-loader-'))
    const outsideRoot = await mkdtemp(join(tmpdir(), 'holo-panels-loader-outside-'))
    temporaryDirectories.push(projectRoot, outsideRoot)
    const outsidePath = join(outsideRoot, 'Outside.ts')
    await writeFile(outsidePath, 'export default {}\n')

    await expect(createProjectDiscoveryModuleLoader(projectRoot)(outsidePath)).rejects.toThrow(
      /must stay within the project/,
    )
  })

  it('loads TypeScript and JavaScript definitions and cleans isolated bundles', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-loader-'))
    temporaryDirectories.push(projectRoot)
    await mkdir(join(projectRoot, 'server'), { recursive: true })
    await writeFile(join(projectRoot, 'server/AdminPanel.ts'), `
      const id: string = 'admin'
      export default {
        discoveryMarker: '@holo-js/panels/discovery/v1',
        kind: 'panel',
        id,
      } as const
    `)
    await writeFile(join(projectRoot, 'server/Dashboard.js'), `
      export const Dashboard = {
        discoveryMarker: '@holo-js/panels/discovery/v1',
        kind: 'page',
        id: 'dashboard',
      }
    `)
    const loadModule = createProjectDiscoveryModuleLoader(projectRoot)

    const panelModule = await loadModule(join(projectRoot, 'server/AdminPanel.ts'))
    const pageModule = await loadModule(join(projectRoot, 'server/Dashboard.js'))

    expect(isPanelDefinition(panelModule.default)).toBe(true)
    expect(isPageDefinition(pageModule.Dashboard)).toBe(true)
    expect(await readdir(join(projectRoot, '.holo-js/panels-runtime'))).toEqual([])
  })

  it('resolves project aliases without allowing them to escape the project', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-loader-'))
    temporaryDirectories.push(projectRoot)
    await mkdir(join(projectRoot, 'server/shared'), { recursive: true })
    await writeFile(join(projectRoot, 'server/shared/page.ts'), `
      export const page = {
        discoveryMarker: '@holo-js/panels/discovery/v1',
        kind: 'page',
        id: 'dashboard',
      }
    `)
    await writeFile(join(projectRoot, 'server/Dashboard.ts'), `
      export { page as default } from '~/server/shared/page'
    `)
    await writeFile(join(projectRoot, 'server/Outside.ts'), `
      export { default } from '~/../outside'
    `)
    const loadModule = createProjectDiscoveryModuleLoader(projectRoot)

    const pageModule = await loadModule(join(projectRoot, 'server/Dashboard.ts'))

    expect(isPageDefinition(pageModule.default)).toBe(true)
    await expect(loadModule(join(projectRoot, 'server/Outside.ts'))).rejects.toThrow(
      /must stay within the project/,
    )
  })

  it('evaluates modules inside the supplied component-default layers', async () => {
    const projectRoot = await mkdtemp(join(packageRoot, '.holo-panels-loader-'))
    temporaryDirectories.push(projectRoot)
    await mkdir(join(projectRoot, 'server'), { recursive: true })
    await writeFile(join(projectRoot, 'server/Columns.ts'), `
      import { columnsFor } from '@holo-js/panels-core'
      class Post { title = '' }
      export default columnsFor(Post).text('title').compile()
    `)
    const loadModule = createProjectDiscoveryModuleLoader(projectRoot)
    const application = componentDefault('column', 'text', builder => builder.label('Application'))
    const panel = componentDefault('column', 'text', builder => builder.label('Panel'))

    const moduleValue = await loadModule(join(projectRoot, 'server/Columns.ts'), {
      componentDefaults: { application: [application], panel: [panel] },
    })

    expect(moduleValue.default).toMatchObject({ manifest: { label: 'Panel', path: 'title', type: 'text' } })
  })
})
