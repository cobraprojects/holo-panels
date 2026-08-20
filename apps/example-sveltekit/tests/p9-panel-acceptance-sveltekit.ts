import { createGeneratedResourcePage, generatedResourcePageManifests } from '@holo-js/panels'
import type { SvelteKitPanelRegistry } from '@holo-js/panels-sveltekit'
import { createGeneratedSvelteKitPanelsRegistry } from '@holo-js/panels-sveltekit/server'
import '../.holo-js/generated/schema.generated'
import serverRegistry from '../.holo-js/generated/panels/server-registry'
import PostResource from '../server/admin/resources/posts/PostResource'

const manifests = generatedResourcePageManifests({ panelPath: '/admin', resource: PostResource })
const pagesByType = new Map(manifests.map(manifest => [manifest.pageType, createGeneratedResourcePage(PostResource, manifest)]))

export async function loadSvelteKitPanelRegistry(): Promise<SvelteKitPanelRegistry<object>> {
  return createGeneratedSvelteKitPanelsRegistry(serverRegistry)
}

export const svelteKitPanelAcceptanceFixture = Object.freeze({
  framework: 'sveltekit',
  pages: Object.freeze([
    pagesByType.get('list')!,
    pagesByType.get('create')!,
    pagesByType.get('view')!,
    pagesByType.get('edit')!,
  ]),
  loadRegistry: loadSvelteKitPanelRegistry,
})
