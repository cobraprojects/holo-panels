import { describe, expect, it } from 'vitest'
import type { PanelActor } from '../server/fixtures/access'
import PostExporter from '../server/admin/exports/PostExporter'
import PostImporter from '../server/admin/imports/PostImporter'

const actor = {
  createdAt: new Date(),
  email: 'admin@example.test',
  id: 'admin-1',
  name: 'Admin',
  password: 'hidden',
  roleKey: 'tenant-admin' as const,
  tenantId: 'tenant-acme',
  tenantIds: ['tenant-acme'],
  updatedAt: new Date(),
} satisfies PanelActor
const context = {
  actor,
  guard: 'web',
  panelId: 'admin',
  provider: null,
  resourceId: 'posts',
  signal: new AbortController().signal,
  tenant: 'tenant-acme',
}

describe('SvelteKit P17 transfer runtime', () => {
  it('registers discoverable app-owned Post import and export definitions', () => {
    expect(PostImporter.compileDiscoveryDefinition()).toMatchObject({ id: 'post-import', kind: 'import', resourceId: 'posts' })
    expect(PostExporter.compileDiscoveryDefinition()).toMatchObject({ id: 'post-export', kind: 'export', resourceId: 'posts' })
  })

  it('retains durable execution metadata and binds invocation identity to tenant metadata', async () => {
    const importer = PostImporter.compile()
    const exporter = PostExporter.compile()
    expect(await exporter.server.authorize(context)).toBe(true)
    expect(exporter.server.queue).toMatchObject({ connection: 'database', queue: 'panels-transfers', tries: 3 })
    expect(exporter.server.storage).toEqual({ directory: 'panels/exports', disk: 'private' })
    expect(await importer.server.mutation.duplicateKey({ slug: 'launch' }, { ...context, operationId: 'import-1', row: 1 })).toBe('tenant-acme:launch')
  })
})
