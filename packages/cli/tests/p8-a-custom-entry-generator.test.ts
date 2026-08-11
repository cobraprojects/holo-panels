import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { generate, type FrameworkId } from '../src/generators'

const temporaryDirectories: string[] = []

async function projectRoot(framework: FrameworkId): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'holo-panels-entry-generator-'))
  temporaryDirectories.push(root)
  await writeFile(join(root, 'package.json'), '{}\n')
  return root
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

describe('P8-A custom infolist entry generator', () => {
  it.each([
    ['next', '.tsx', 'defineReactEntryRenderer'],
    ['nuxt', '.vue', '<template>'],
    ['sveltekit', '.svelte', '<script lang="ts">'],
  ] as const)('generates one definition and only the detected %s renderer', async (framework, extension, marker) => {
    const root = await projectRoot(framework)
    const files = await generate({
      args: ['RatingEntry'],
      flags: { panel: 'admin' },
      kind: 'infolist-entry',
      project: { framework },
      projectRoot: root,
    }, { prepare: async () => undefined })

    expect(files).toEqual([
      'server/admin/entries/RatingEntry.ts',
      `resources/panels/renderers/${framework}/entries/RatingEntry${extension}`,
    ])
    expect(await readFile(join(root, files[0]!), 'utf8')).toBe("import { defineEntry } from '@holo-js/panels'\n\nexport default defineEntry('app:entry:rating', String)\n  .label('RatingEntry')\n  .renderer('app:entry:rating')\n")
    const renderer = await readFile(join(root, files[1]!), 'utf8')
    expect(renderer).toContain(marker)
    expect(renderer).not.toContain('unknown')
  })
})
