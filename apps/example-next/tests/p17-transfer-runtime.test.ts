import { describe, expect, it } from 'vitest'
import PostExporter from '../server/admin/exports/PostExporter'
import PostImporter from '../server/admin/imports/PostImporter'

const actor = {
  createdAt: new Date(),
  email: 'admin@example.test',
  id: 'admin-1',
  name: 'Admin',
  password: 'hidden',
  role: 'admin',
  tenantId: 'tenant-acme',
  updatedAt: new Date(),
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

describe('Next P17 transfer runtime', () => {
  it('compiles the Post import and export definitions against the inferred resource', () => {
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
