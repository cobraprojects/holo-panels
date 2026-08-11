import { describe, expect, it } from 'vitest'
import PostExporter from '../server/admin/exports/PostExporter'
import PostImporter from '../server/admin/imports/PostImporter'

const actor = {
  email: 'admin@example.test',
  id: 'admin-1',
  name: 'Admin',
  password: 'hidden',
  role: 'tenant-admin',
  tenantId: 'tenant-acme',
}
const context = {
  actor,
  guard: 'web',
  panelId: 'admin',
  provider: null,
  resourceId: 'posts',
  signal: new AbortController().signal,
  tenant: 'tenant-acme',
}

describe('Nuxt P17 transfer runtime', () => {
  it('registers discoverable app-owned Post import and export definitions', () => {
    expect(PostImporter.compileDiscoveryDefinition()).toMatchObject({ id: 'post-import', kind: 'import', resourceId: 'posts' })
    expect(PostExporter.compileDiscoveryDefinition()).toMatchObject({ id: 'post-export', kind: 'export', resourceId: 'posts' })
  })

  it('retains durable execution metadata and binds invocation identity to tenant metadata', async () => {
    const importer = PostImporter.compile()
    const exporter = PostExporter.compile()
    expect(await importer.server.authorize(context)).toBe(true)
    expect(await exporter.server.authorize(context)).toBe(true)
    expect(importer.server.queue).toMatchObject({ connection: 'database', queue: 'panels-transfers', tries: 3 })
    expect(exporter.server.queue).toMatchObject({ connection: 'database', queue: 'panels-transfers', tries: 3 })
    expect(importer.server.storage).toEqual({ directory: 'panels/imports', disk: 'private' })
    expect(exporter.server.storage).toEqual({ directory: 'panels/exports', disk: 'private' })
    expect(await importer.server.mutation.duplicateKey({ slug: 'launch' }, { ...context, operationId: 'import-1', row: 1 })).toBe('tenant-acme:launch')
  })
})
