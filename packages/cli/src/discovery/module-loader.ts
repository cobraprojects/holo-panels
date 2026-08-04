import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { withComponentDefaults } from '@holo-js/panels-core'
import type { DiscoveryModuleLoader } from './types'

export function createProjectDiscoveryModuleLoader(projectRoot: string): DiscoveryModuleLoader {
  const root = resolve(projectRoot)

  function resolveProjectAlias(path: string): string {
    const resolvedPath = resolve(root, path.slice(2))
    const projectPath = relative(root, resolvedPath)
    if (projectPath === '..' || projectPath.startsWith(`..${sep}`)) {
      throw new Error(`[Holo Panels] Aliased definition import must stay within the project: ${path}.`)
    }
    return resolvedPath
  }

  return async (absolutePath, context) => {
    const sourcePath = resolve(absolutePath)
    const projectPath = relative(root, sourcePath)
    if (!projectPath || projectPath === '..' || projectPath.startsWith(`..${sep}`)) {
      throw new Error(`[Holo Panels] Definition module must stay within the project: ${absolutePath}.`)
    }
    const runtimeRoot = join(root, '.holo-js/panels-runtime')
    await mkdir(runtimeRoot, { recursive: true })
    const temporaryRoot = await mkdtemp(join(runtimeRoot, 'definition-'))
    const outputPath = join(temporaryRoot, 'definition.mjs')

    try {
      await build({
        absWorkingDir: root,
        bundle: true,
        entryPoints: [sourcePath],
        format: 'esm',
        logLevel: 'silent',
        outfile: outputPath,
        packages: 'external',
        platform: 'node',
        plugins: [{
          name: 'holo-panels-project-aliases',
          setup(pluginBuild) {
            pluginBuild.onResolve({ filter: /^[~@]\// }, async arguments_ => {
              return await pluginBuild.resolve(resolveProjectAlias(arguments_.path), {
                kind: arguments_.kind,
                resolveDir: root,
              })
            })
          },
        }],
        sourcemap: false,
        target: 'node20',
      })
      const load = async (): Promise<Readonly<Record<string, unknown>>> => await import(`${pathToFileURL(outputPath).href}?v=${randomUUID()}`) as Readonly<Record<string, unknown>>
      return context?.componentDefaults
        ? await withComponentDefaults(context.componentDefaults, load)
        : await load()
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  }
}
