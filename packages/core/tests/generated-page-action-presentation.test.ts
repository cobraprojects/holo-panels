import { describe, expect, it, vi } from 'vitest'
import type { ActionPresentationContext } from '../src/actions'
import { resolvePageData } from '../src/pages'
import { createGeneratedResourcePage, generatedResourcePageManifests } from '../src/resources/generated-pages'

describe('generated page action presentation', () => {
  it.each(['create', 'list'] as const)('resolves %s page callbacks for the requesting actor without serializing server callbacks', async (pageType) => {
    const label = vi.fn(({ actor, data, record }: ActionPresentationContext<object, { title: string }, { name: string }, null, object>) => {
      expect(record).toBeNull()
      expect(data).toBeUndefined()
      return `Create for ${actor.name}`
    })
    const action = {
      authorize: () => true,
      color: 'success',
      disabled: () => true,
      handle: () => null,
      icon: 'plus',
      id: 'create-post',
      kind: 'custom',
      label,
      modal: { heading: ({ actor }: { actor: { name: string } }) => `New post for ${actor.name}` },
      mount: 'page',
      source: pageType,
      visible: () => false,
    }
    const query = {
      orderBy: () => query,
      paginate: async () => ({ data: [], meta: { currentPage: 1, hasMorePages: false, lastPage: 1, perPage: 25, total: 0 } }),
    }
    const resource = {
      actions: [action, { ...action, label: 'Bulk create', mount: 'bulk' }],
      baseQuery: (value: typeof query) => value,
      form: { fields: [] },
      id: 'posts',
      kind: 'resource',
      model: { definition: { name: 'Post', primaryKey: 'id', softDeletes: false }, query: () => query },
      pages: [{
        actions: {
          footer: [],
          header: [{ manifest: () => ({
            buttonStyle: 'link',
            extraAttributes: { 'data-custom': 'kept' },
            iconPosition: 'after',
            id: action.id,
            kind: action.kind,
            label: 'Create post',
            mount: 'page',
            scope: 'header',
            url: '/posts',
            urlInNewTab: true,
          }) }],
        },
        pageType,
        path: pageType === 'create' ? '/create' : '/',
      }],
      shared: true,
      table: { columns: [] },
    }
    const [manifest] = generatedResourcePageManifests({ panelPath: '/admin', resource })
    if (!manifest) throw new Error('Expected a generated page')
    const page = createGeneratedResourcePage(resource, manifest)
    const result = await resolvePageData(page, {
      actor: { name: 'Ada' },
      locale: 'en',
      panelId: 'admin',
      parameters: {},
      services: {},
      signal: new AbortController().signal,
      tenant: null,
    })
    expect(result.manifest.body?.properties.resource).toMatchObject({
      actions: [{
        buttonStyle: 'link',
        disabled: true,
        extraAttributes: { 'data-custom': 'kept' },
        iconPosition: 'after',
        label: 'Create for Ada',
        modal: { heading: 'New post for Ada' },
        mount: 'page',
        scope: 'header',
        url: '/posts',
        urlInNewTab: true,
        visible: false,
      }],
    })
    expect(label).toHaveBeenCalledOnce()
    expect(JSON.stringify(result)).not.toContain('authorize')
    expect(manifest.body?.properties.resource).not.toEqual(result.manifest.body?.properties.resource)
  })
})
