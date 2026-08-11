import { createGeneratedResourcePage, generatedResourcePageManifests, type JsonObject } from '@holo-js/panels'
import { createGeneratedNextPanelsRuntime, type NextPanelOperationInput, type NextPanelsRuntime } from '@holo-js/panels-next'
import serverRegistry from '../.holo-js/generated/panels/server-registry'
import PostResource from '../server/admin/resources/posts/PostResource'
import '../server/policies/PostPolicy'

const pageKeys = Object.freeze([
  'admin:page:posts',
  'admin:page:posts-create',
  'admin:page:posts-view',
  'admin:page:posts-edit',
] as const)

const generatedPages = generatedResourcePageManifests({ panelPath: '/admin', resource: PostResource })
const pagesByType = new Map(generatedPages.map(manifest => [manifest.pageType, createGeneratedResourcePage(PostResource, manifest)]))
const acceptanceRecords = Object.freeze([
  Object.freeze({ category: 'News', city: 'Cairo', id: 1, slug: 'first-post', title: 'First post' }),
  Object.freeze({ category: 'Guides', city: 'Giza', id: 2, slug: 'city-guide', title: 'City guide' }),
])

interface AcceptanceOverrides {
  readonly auth?: NextPanelsRuntime['auth']
  readonly mutatePost?: (mutation: {
    readonly context: object
    readonly intent: string
    readonly recordId: number | string | null
    readonly values: Readonly<Record<string, string>>
  }) => Promise<void>
  readonly resolveServices?: NextPanelsRuntime['resolveServices']
  readonly resolveTenant?: NextPanelsRuntime['resolveTenant']
}

export async function loadNextPanelsRuntime(): Promise<NextPanelsRuntime> {
  return createGeneratedNextPanelsRuntime(serverRegistry)
}

export async function createNextPanelsAcceptanceRuntime(overrides: AcceptanceOverrides): Promise<NextPanelsRuntime> {
  const runtime = createGeneratedNextPanelsRuntime(serverRegistry)
  return Object.freeze({
    ...runtime,
    ...(overrides.auth ? { auth: overrides.auth } : {}),
    ...(overrides.resolveServices ? { resolveServices: overrides.resolveServices } : {}),
    ...(overrides.resolveTenant ? { resolveTenant: overrides.resolveTenant } : {}),
    ...(overrides.mutatePost ? {
      async execute(input: NextPanelOperationInput) {
        if (input.operation === 'table-data') {
          const search = typeof input.payload.search === 'string' ? input.payload.search.trim().toLocaleLowerCase() : ''
          const records = acceptanceRecords.filter(record => !search || record.title.toLocaleLowerCase().includes(search))
          return { data: { hasMore: false, page: 1, perPage: 25, records, total: records.length } }
        }
        const recordId = input.payload.recordId
        const reserved = new Set(['intent', 'recordId', 'resourceId'])
        const values = Object.fromEntries(Object.entries(input.payload)
          .filter(([key, value]) => !reserved.has(key) && typeof value === 'string')) as Readonly<Record<string, string>>
        await overrides.mutatePost!({
          context: { actor: input.scope.actor, signal: input.scope.signal, tenant: input.scope.tenant },
          intent: typeof input.payload.intent === 'string' ? input.payload.intent : input.operation,
          recordId: typeof recordId === 'string' || typeof recordId === 'number' ? recordId : null,
          values,
        })
        return {
          data: { resourceId: input.payload.resourceId ?? null, saved: true } as JsonObject,
          effects: [{ kind: 'toast' as const, level: 'success' as const, message: input.payload.intent === 'delete' ? 'Post deleted.' : 'Post saved.' }],
        }
      },
    } : {}),
  })
}

export const nextPanelAcceptanceFixture = Object.freeze({
  createRuntime: createNextPanelsAcceptanceRuntime,
  framework: 'next',
  loadRuntime: loadNextPanelsRuntime,
  pageKeys,
  pages: Object.freeze([
    pagesByType.get('list')!,
    pagesByType.get('create')!,
    pagesByType.get('view')!,
    pagesByType.get('edit')!,
  ]),
})
