import { lstat, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { FrameworkId } from '@holo-js/panels-cli'

export async function applicationWidgetRenderers(projectRoot: string, framework: FrameworkId): Promise<{ imports: string[], registrations: string[] }> {
  const directory = `resources/panels/renderers/${framework}/widgets`
  const path = resolve(projectRoot, directory)
  const metadata = await lstat(path).catch(() => undefined)
  if (!metadata?.isDirectory() || metadata.isSymbolicLink()) return { imports: [], registrations: [] }
  const extension = framework === 'next' ? '.tsx' : framework === 'nuxt' ? '.vue' : '.svelte'
  const entries = (await readdir(path, { withFileTypes: true })).filter(entry => entry.isFile() && entry.name.endsWith(extension)).sort((left, right) => left.name.localeCompare(right.name))
  const imports: string[] = []
  const registrations: string[] = []
  for (const [index, entry] of entries.entries()) {
    const id = entry.name.slice(0, -extension.length)
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u.test(id)) throw new Error(`Application widget renderer requires a stable file name: ${entry.name}`)
    const component = `ApplicationWidget${index}`
    const module = `../../../${directory}/${framework === 'next' ? id : entry.name}`
    imports.push(`import ${component} from '${module}'`)
    registrations.push(framework === 'sveltekit'
      ? `  registry.register({ component: ${component}, source: 'application', typeId: 'app.widgets.${id}' })`
      : `  registry.register('widget.app.widgets.${id}', ${component}, 'application')`)
  }
  return { imports, registrations }
}
