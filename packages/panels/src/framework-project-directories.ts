import { lstat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { FrameworkArtifactDirectories, FrameworkId } from '@holo-js/panels-cli'
import { resolveNuxtProjectDirectories } from './nuxt-project-directories'

function containedRelativePath(projectRoot: string, target: string, name: string): string {
  const value = relative(projectRoot, target)
  if (value === '') return '.'
  if (value === '..' || value.startsWith(`..${sep}`) || isAbsolute(value)) {
    throw new Error(`[Holo Panels] ${name} resolves outside the project root.`)
  }
  return value.split(sep).join('/')
}

async function isDirectory(path: string): Promise<boolean> {
  const metadata = await lstat(path).catch(() => undefined)
  return metadata?.isDirectory() === true && !metadata.isSymbolicLink()
}

export async function resolveNextProjectDirectories(projectRoot: string): Promise<FrameworkArtifactDirectories> {
  const rootApp = resolve(projectRoot, 'app')
  const sourceApp = resolve(projectRoot, 'src/app')
  const rootAppExists = await isDirectory(rootApp)
  const sourceAppExists = await isDirectory(sourceApp)
  const pages = rootAppExists || !sourceAppExists ? 'app' : 'src/app'
  return Object.freeze({ pages, server: pages })
}

type SvelteKitConfig = Readonly<{
  kit?: Readonly<{ files?: Readonly<{ routes?: unknown }> }>
}>

type SvelteKitConfigResolver = (projectRoot: string) => Promise<SvelteKitConfig>

async function loadSvelteKitConfig(projectRoot: string): Promise<SvelteKitConfig> {
  const candidates = ['svelte.config.js', 'svelte.config.mjs']
  for (const candidate of candidates) {
    const path = resolve(projectRoot, candidate)
    const metadata = await lstat(path).catch(() => undefined)
    if (!metadata?.isFile() || metadata.isSymbolicLink()) continue
    const moduleValue = await import(`${pathToFileURL(path).href}?holo-panels=${metadata.mtimeMs}`) as Readonly<Record<string, unknown>>
    const config = moduleValue.default
    if (typeof config !== 'object' || config === null || Array.isArray(config)) {
      throw new Error('[Holo Panels] The SvelteKit configuration must export an object.')
    }
    return config as SvelteKitConfig
  }
  return {}
}

export async function resolveSvelteKitProjectDirectories(
  projectRoot: string,
  resolver: SvelteKitConfigResolver = loadSvelteKitConfig,
): Promise<FrameworkArtifactDirectories> {
  const config = await resolver(projectRoot)
  const configuredRoutes = config.kit?.files?.routes
  const routes = typeof configuredRoutes === 'string' && configuredRoutes.trim() ? configuredRoutes : 'src/routes'
  const path = containedRelativePath(projectRoot, resolve(projectRoot, routes), 'SvelteKit routes directory')
  return Object.freeze({ pages: path, server: path })
}

export async function resolveFrameworkProjectDirectories(
  framework: FrameworkId,
  projectRoot: string,
): Promise<FrameworkArtifactDirectories> {
  if (framework === 'next') return await resolveNextProjectDirectories(projectRoot)
  if (framework === 'nuxt') return await resolveNuxtProjectDirectories(projectRoot)
  return await resolveSvelteKitProjectDirectories(projectRoot)
}
