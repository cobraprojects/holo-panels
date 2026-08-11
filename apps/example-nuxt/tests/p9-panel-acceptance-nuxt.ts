import { createGeneratedResourcePage, generatedResourcePageManifests } from '@holo-js/panels'
import type { NuxtPanelRuntime } from '@holo-js/panels-nuxt'
import { createGeneratedNuxtPanelsRuntime } from '@holo-js/panels-nuxt/server'
import type {} from '../.holo-js/generated/auth'
import type {} from '../.holo-js/generated/schema.generated'
import serverRegistry from '../.holo-js/generated/panels/server-registry'
import PostResource from '../server/admin/resources/posts/PostResource'

const manifests = generatedResourcePageManifests({ panelPath: '/admin', resource: PostResource })
const pagesByType = new Map(manifests.map(manifest => [manifest.pageType, createGeneratedResourcePage(PostResource, manifest)]))

export async function loadNuxtPanelRuntime(): Promise<NuxtPanelRuntime<object>> {
  return createGeneratedNuxtPanelsRuntime(serverRegistry)
}

export async function loadNuxtResourceSchema(): Promise<object> {
  const manifest = manifests.find(item => item.pageType === 'list')
  const resource = manifest?.body?.properties.resource
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) throw new Error('Missing generated Nuxt resource schema')
  const form = resource.form && typeof resource.form === 'object' && !Array.isArray(resource.form) ? resource.form : {}
  const table = resource.table && typeof resource.table === 'object' && !Array.isArray(resource.table) ? resource.table : {}
  return {
    actions: table.actions ?? [],
    basePath: '/admin/posts',
    columns: Array.isArray(table.columns) ? table.columns.map(column => ({ manifest: column })) : [],
    fields: form.fields ?? [],
    kind: 'resource',
  }
}

export const nuxtPanelAcceptanceFixture = Object.freeze({
  framework: 'nuxt',
  pages: Object.freeze([
    pagesByType.get('list')!,
    pagesByType.get('create')!,
    pagesByType.get('view')!,
    pagesByType.get('edit')!,
  ]),
  loadResourceSchema: loadNuxtResourceSchema,
  loadRuntime: loadNuxtPanelRuntime,
})
