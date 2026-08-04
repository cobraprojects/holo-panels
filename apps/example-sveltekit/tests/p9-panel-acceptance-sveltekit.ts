import type { SvelteKitPanelRegistry } from '@holo-js/panels-sveltekit'
import CreatePost from '../server/admin/pages/posts/CreatePost'
import EditPost from '../server/admin/pages/posts/EditPost'
import ListPosts from '../server/admin/pages/posts/ListPosts'
import ViewPost from '../server/admin/pages/posts/ViewPost'

export async function loadSvelteKitPanelRegistry(): Promise<SvelteKitPanelRegistry> {
  const registryPath = new URL('../src/lib/server/panels/registry.ts', import.meta.url).href
  const module: object = await import(registryPath)
  const registry = Reflect.get(module, 'panelsRegistry')
  if (!registry || typeof registry !== 'object' || !('resolvePage' in registry)) throw new Error('Missing exported SvelteKit panel registry')
  return registry as SvelteKitPanelRegistry
}

export const svelteKitPanelAcceptanceFixture = Object.freeze({
  framework: 'sveltekit',
  pages: Object.freeze([
    ListPosts.compile(),
    CreatePost.compile(),
    ViewPost.compile(),
    EditPost.compile(),
  ]),
  loadRegistry: loadSvelteKitPanelRegistry,
})
