import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PageContext, PageManifest } from '../src/pages/contracts'
import { resolvePanelNavigationSeed } from '../src/panels/navigation'
import { createGeneratedResourcePage } from '../src/resources/generated-pages'

const can = vi.fn<(action: string, target: object) => Promise<boolean>>()

vi.mock('@holo-js/authorization', () => ({
  AuthorizationPolicyNotFoundError: class AuthorizationPolicyNotFoundError extends Error {},
  forUser: () => ({ can }),
}))

const model = {
  definition: { name: 'Post' },
  query: () => ({}),
}

const resource = {
  id: 'posts',
  kind: 'resource',
  model,
  navigation: { label: 'Posts' },
  routeKey: 'id',
}

const manifest: PageManifest = {
  actions: { footer: [], header: [] },
  body: null,
  id: 'posts.list',
  navigation: { badge: null, group: null, icon: null, label: 'Posts', parent: null, sort: 0 },
  pageType: 'list',
  path: '/admin/posts',
  renderer: null,
  schemaId: null,
  widgets: { footer: [], header: [] },
}

const context: PageContext<object, null, object> = {
  actor: { id: 'actor-1' },
  locale: 'en',
  panelId: 'admin',
  parameters: {},
  services: {},
  signal: new AbortController().signal,
  tenant: null,
}

describe('generated Resource navigation authorization', () => {
  beforeEach(() => {
    can.mockReset()
  })

  it('uses the Resource viewAny policy to decide navigation visibility', async () => {
    can.mockResolvedValue(false)
    const page = createGeneratedResourcePage(resource, manifest)

    await expect(page.server.authorize(context)).resolves.toBe(false)
    expect(can).toHaveBeenCalledWith('viewAny', model)
    await expect(resolvePanelNavigationSeed([], [page], context)).resolves.toEqual([])

    can.mockResolvedValue(true)
    await expect(resolvePanelNavigationSeed([], [page], context)).resolves.toEqual([
      expect.objectContaining({ id: 'posts.list', label: 'Posts' }),
    ])
  })
})
