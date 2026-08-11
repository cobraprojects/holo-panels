import { createRequire } from 'node:module'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { FrameworkArtifactDirectories } from '@holo-js/panels-cli'

type NuxtConfig = Readonly<{
  dir?: Readonly<{ pages?: unknown }>
  rootDir?: unknown
  serverDir?: unknown
  srcDir?: unknown
}>

type LoadNuxtConfig = (options: Readonly<{ cwd: string }>) => Promise<NuxtConfig>
type NuxtConfigResolver = (projectRoot: string) => Promise<NuxtConfig>

function directory(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function containedRelativePath(projectRoot: string, target: string, name: string): string {
  const value = relative(projectRoot, target)
  if (value === '') return '.'
  if (value === '..' || value.startsWith(`..${sep}`) || isAbsolute(value)) {
    throw new Error(`[Holo Panels] Nuxt resolved ${name} outside the project root.`)
  }
  return value.split(sep).join('/')
}

async function loadNuxtConfig(projectRoot: string): Promise<NuxtConfig> {
  const require = createRequire(resolve(projectRoot, 'package.json'))
  const entry = ['nuxt/kit', '@nuxt/kit'].flatMap((specifier) => {
    try {
      return [require.resolve(specifier)]
    } catch {
      return []
    }
  })[0]
  if (!entry) {
    throw new Error('[Holo Panels] Nuxt project preparation requires the project-installed nuxt package.')
  }
  const moduleValue = await import(pathToFileURL(entry).href) as Readonly<Record<string, unknown>>
  const loader = moduleValue.loadNuxtConfig
  if (typeof loader !== 'function') throw new Error('[Holo Panels] The project-installed Nuxt Kit module does not export loadNuxtConfig().')
  return await (loader as LoadNuxtConfig)({ cwd: projectRoot })
}

export async function resolveNuxtProjectDirectories(
  projectRoot: string,
  resolver: NuxtConfigResolver = loadNuxtConfig,
): Promise<FrameworkArtifactDirectories> {
  const config = await resolver(projectRoot)
  const rootDirectory = resolve(directory(config.rootDir, projectRoot))
  const sourceDirectory = resolve(rootDirectory, directory(config.srcDir, 'app'))
  const pagesDirectory = resolve(sourceDirectory, directory(config.dir?.pages, 'pages'))
  const serverDirectory = resolve(rootDirectory, directory(config.serverDir, 'server'))
  return Object.freeze({
    pages: containedRelativePath(projectRoot, pagesDirectory, 'pages directory'),
    server: containedRelativePath(projectRoot, serverDirectory, 'server directory'),
  })
}
