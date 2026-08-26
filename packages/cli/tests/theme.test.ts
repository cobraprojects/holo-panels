import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { buildPanelTheme, PANEL_THEME_CUSTOMIZATION_PATH } from '../src/theme'

const temporaryDirectories: string[] = []

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'holo-panels-theme-test-'))
  temporaryDirectories.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('panel theme compiler', () => {
  it('builds isolated prefixed utilities without Tailwind preflight', async () => {
    const projectRoot = await project()
    const customization = join(projectRoot, PANEL_THEME_CUSTOMIZATION_PATH)
    await mkdir(join(customization, '..'), { recursive: true })
    await writeFile(customization, '@source inline("hp:bg-red-500");\n', 'utf8')

    const css = await buildPanelTheme({ projectRoot })

    expect(css).toContain('.hp\\:bg-red-500')
    expect(css).not.toMatch(/\*,:after,:before/)
    expect(css.length).toBeLessThan(150_000)
  })

  it('includes registered panel extensions without scanning the consumer frontend source tree', async () => {
    const projectRoot = await project()
    const frontend = join(projectRoot, 'src')
    const extension = join(projectRoot, 'resources/panels/extensions')
    await mkdir(frontend, { recursive: true })
    await mkdir(extension, { recursive: true })
    await writeFile(join(frontend, 'page.tsx'), '<div className="hp:bg-fuchsia-950" />\n', 'utf8')
    await writeFile(join(extension, 'summary.tsx'), '<div className="hp:bg-emerald-600" />\n', 'utf8')

    const css = await buildPanelTheme({ projectRoot })

    expect(css).toContain('.hp\\:bg-emerald-600')
    expect(css).not.toContain('.hp\\:bg-fuchsia-950')
    expect(await readFile(join(frontend, 'page.tsx'), 'utf8')).toContain('hp:bg-fuchsia-950')
  })
})
