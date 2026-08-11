import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveNuxtProjectDirectories } from '../src/nuxt-project-directories'

describe('Nuxt project directories', () => {
  it('uses Nuxt-resolved source, pages, and server directory overrides', async () => {
    const directories = await resolveNuxtProjectDirectories('/project', async () => ({
      dir: { pages: 'screens' },
      rootDir: '/project',
      serverDir: '/project/backend',
      srcDir: '/project/frontend',
    }))

    expect(directories).toEqual({ pages: 'frontend/screens', server: 'backend' })
  })

  it('rejects resolved directories outside the project boundary', async () => {
    await expect(resolveNuxtProjectDirectories('/project', async () => ({
      dir: { pages: 'pages' },
      rootDir: '/project',
      serverDir: '/project/server',
      srcDir: '/outside',
    }))).rejects.toThrow('outside the project root')
  })

  it('loads directory overrides through the project-installed Nuxt configuration loader', async () => {
    const fixtureRoot = await mkdtemp(join(import.meta.dirname, '.nuxt-layout-'))
    try {
      await mkdir(join(fixtureRoot, 'frontend'), { recursive: true })
      await writeFile(join(fixtureRoot, 'package.json'), '{"type":"module"}\n')
      await writeFile(join(fixtureRoot, 'nuxt.config.ts'), `export default defineNuxtConfig({
  srcDir: 'frontend',
  dir: { pages: 'screens' },
  serverDir: 'backend',
})
`)

      await expect(resolveNuxtProjectDirectories(fixtureRoot)).resolves.toEqual({
        pages: 'frontend/screens',
        server: 'backend',
      })
    } finally {
      await rm(fixtureRoot, { force: true, recursive: true })
    }
  })
})
