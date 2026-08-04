import { describe, expect, it } from 'vitest'
import PostExporter from '../server/admin/exports/PostExporter'
import PostImporter from '../server/admin/imports/PostImporter'
import { AdminActor } from '../server/admin/pages/posts/access'
import { createAdminPanelsRuntime } from '../server/admin/runtime'

const actor = Object.assign(new AdminActor(), { id: 1, role: 'admin' })
const context = {
  actor,
  guard: 'web',
  panelId: 'admin',
  provider: null,
  resourceId: 'posts',
  signal: new AbortController().signal,
  tenant: 'tenant-acme',
}

describe('Next P17 transfer runtime', () => {
  it('registers the app-owned Post import and export definitions', async () => {
    const registry = createAdminPanelsRuntime({ auth: { guard: () => ({ provider: async () => 'web', user: async () => actor }) } }).registry
    expect(await registry['admin:import:post-import']?.()).toBe(PostImporter)
    expect(await registry['admin:export:post-export']?.()).toBe(PostExporter)
    expect(PostImporter.compile().client).toMatchObject({ id: 'post-import', resourceId: 'posts' })
    expect(PostExporter.compile().client).toMatchObject({ id: 'post-export', resourceId: 'posts' })
  })

  it('retains durable execution metadata and binds invocation identity to tenant metadata', async () => {
    const importer = PostImporter.compile()
    const exporter = PostExporter.compile()
    expect(await importer.server.authorize(context)).toBe(true)
    expect(exporter.server.queue).toMatchObject({ connection: 'database', queue: 'panels-transfers', tries: 3 })
    expect(exporter.server.storage).toEqual({ directory: 'panels/exports', disk: 'private' })
    expect(await importer.server.mutation.duplicateKey({ slug: 'launch' }, { ...context, operationId: 'import-1', row: 1 })).toBe('tenant-acme:launch')
  })
})
