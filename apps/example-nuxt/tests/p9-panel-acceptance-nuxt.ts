import type { NuxtPanelRuntime } from '@holo-js/panels-nuxt'
import CreatePost from '../server/admin/pages/posts/CreatePost'
import EditPost from '../server/admin/pages/posts/EditPost'
import ListPosts from '../server/admin/pages/posts/ListPosts'
import ViewPost from '../server/admin/pages/posts/ViewPost'

const adminRuntimeModulePath = ['..', 'server', 'admin', 'runtime.ts'].join('/')
const panelsRuntimeModulePath = ['..', 'server', 'panels', 'runtime.ts'].join('/')

export async function loadNuxtPanelRuntime(): Promise<NuxtPanelRuntime> {
  const module: object = await import(panelsRuntimeModulePath)
  const runtime = Reflect.get(module, 'panelsRuntime')
  if (!runtime || typeof runtime !== 'object' || !('execute' in runtime)) throw new Error('Missing exported Nuxt panel runtime')
  return runtime as NuxtPanelRuntime
}

export async function loadNuxtResourceSchema(): Promise<object> {
  const module: object = await import(adminRuntimeModulePath)
  const schema = Reflect.get(module, 'adminResourceRenderSchema')
  if (!schema || typeof schema !== 'object' || Reflect.get(schema, 'kind') !== 'resource') throw new Error('Missing compiled Nuxt resource render schema')
  return schema
}

export const nuxtPanelAcceptanceFixture = Object.freeze({
  framework: 'nuxt',
  pages: Object.freeze([
    ListPosts.compile(),
    CreatePost.compile(),
    ViewPost.compile(),
    EditPost.compile(),
  ]),
  loadResourceSchema: loadNuxtResourceSchema,
  loadRuntime: loadNuxtPanelRuntime,
})
