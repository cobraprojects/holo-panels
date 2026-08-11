import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  resolveNextProjectDirectories,
  resolveSvelteKitProjectDirectories,
} from '../src/framework-project-directories'

describe('framework project directories', () => {
  it('uses the Next src app directory when the root app directory is absent', async () => {
    const projectRoot = await mkdtemp(join(import.meta.dirname, '.next-layout-'))
    try {
      await mkdir(join(projectRoot, 'src/app'), { recursive: true })
      await expect(resolveNextProjectDirectories(projectRoot)).resolves.toEqual({ pages: 'src/app', server: 'src/app' })
      await mkdir(join(projectRoot, 'app'))
      await expect(resolveNextProjectDirectories(projectRoot)).resolves.toEqual({ pages: 'app', server: 'app' })
    } finally {
      await rm(projectRoot, { force: true, recursive: true })
    }
  })

  it('uses the SvelteKit configured routes directory', async () => {
    await expect(resolveSvelteKitProjectDirectories('/project', async () => ({
      kit: { files: { routes: 'frontend/screens' } },
    }))).resolves.toEqual({ pages: 'frontend/screens', server: 'frontend/screens' })
  })

  it('loads the project SvelteKit configuration', async () => {
    const projectRoot = await mkdtemp(join(import.meta.dirname, '.sveltekit-layout-'))
    try {
      await writeFile(join(projectRoot, 'svelte.config.js'), "export default { kit: { files: { routes: 'frontend/screens' } } }\n")
      await expect(resolveSvelteKitProjectDirectories(projectRoot)).resolves.toEqual({
        pages: 'frontend/screens',
        server: 'frontend/screens',
      })
    } finally {
      await rm(projectRoot, { force: true, recursive: true })
    }
  })

  it('rejects a SvelteKit routes directory outside the project', async () => {
    await expect(resolveSvelteKitProjectDirectories('/project', async () => ({
      kit: { files: { routes: '../outside' } },
    }))).rejects.toThrow('outside the project root')
  })
})
