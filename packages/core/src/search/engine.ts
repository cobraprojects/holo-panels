import type {
  GlobalSearchAccess,
  GlobalSearchAction,
  GlobalSearchContext,
  GlobalSearchOptions,
  GlobalSearchRequest,
  GlobalSearchResource,
  GlobalSearchResponse,
  GlobalSearchResult,
  RegisteredGlobalSearchResource,
  SearchablePath,
} from './contracts'
import type { RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

function assertInteger(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`${label} must be an integer from ${minimum} to ${maximum}`)
}

function assertId(id: string, label: string): void {
  if (!IDENTIFIER.test(id)) throw new Error(`${label} requires a stable ID`)
}

function safePanelUrl(url: string, panelPath: string): string {
  const control = (value: string): boolean => [...value].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)
  if (url !== url.trim() || !url.startsWith('/') || url.startsWith('//') || url.includes('\\') || control(url) || url.includes('?') && url.indexOf('#') >= 0 && url.indexOf('#') < url.indexOf('?')) {
    throw new Error('Global search destinations must be safe panel URLs')
  }
  const path = url.split(/[?#]/u, 1)[0] ?? ''
  let decoded = path
  for (let depth = 0; depth < 3; depth += 1) {
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      throw new Error('Global search destinations must be safe panel URLs')
    }
    if (next.includes('\\') || control(next) || next.split('/').length !== decoded.split('/').length || next.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Global search destinations must be safe panel URLs')
    if (next === decoded) break
    decoded = next
  }
  if (decoded.includes('%')) throw new Error('Global search destinations must be safe panel URLs')
  const root = panelPath === '/' ? '/' : panelPath.replace(/\/+$/gu, '')
  if (root !== '/' && path !== root && !path.startsWith(`${root}/`)) throw new Error('Global search destinations must remain inside the panel')
  return url
}

function pathValue(record: object, path: string): unknown {
  let value: unknown = record
  for (const segment of path.split('.')) {
    if (value === null || typeof value !== 'object' || !(segment in value)) return undefined
    value = Reflect.get(value, segment)
  }
  return value
}

function display(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  return ''
}

function relationPaths(paths: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(paths.flatMap(path => {
    const segments = path.split('.')
    return segments.length > 1 ? [segments.slice(0, -1).join('.')] : []
  }))].sort())
}

function assertResource<TRecord, TQuery, TActor, TTenant, TPath extends SearchablePath<TRecord>>(resource: GlobalSearchResource<TRecord, TQuery, TActor, TTenant, TPath>): void {
  assertId(resource.id, 'Global search resource')
  if (resource.attributes.length === 0) throw new Error(`Global search resource "${resource.id}" requires searchable attributes`)
  if (resource.limit !== undefined) assertInteger(resource.limit, 1, 100, 'Global search resource limits')
  const actions = new Set<string>()
  for (const action of resource.actions ?? []) {
    assertId(action.id, 'Global search action')
    if (actions.has(action.id)) throw new Error(`Duplicate global search action "${action.id}"`)
    actions.add(action.id)
  }
}

function authorizationDecisions(
  value: unknown,
  length: number,
  actionIds: ReadonlySet<string>,
): readonly Readonly<{ actions: readonly string[], page: boolean, result: boolean }>[] {
  if (!Array.isArray(value) || value.length !== length) throw new Error('Global search authorization failed')
  return Object.freeze(value.map(decision => {
    if (decision === null || Array.isArray(decision) || typeof decision !== 'object') throw new Error('Global search authorization failed')
    const candidate = decision as Readonly<Record<string, unknown>>
    if (typeof candidate.page !== 'boolean' || typeof candidate.result !== 'boolean' || !Array.isArray(candidate.actions)) {
      throw new Error('Global search authorization failed')
    }
    if (candidate.actions.some(action => typeof action !== 'string' || !actionIds.has(action)) || new Set(candidate.actions).size !== candidate.actions.length) {
      throw new Error('Global search authorization failed')
    }
    return Object.freeze({ actions: Object.freeze([...candidate.actions] as string[]), page: candidate.page, result: candidate.result })
  }))
}

export class GlobalSearchEngine<TActor, TTenant> {
  readonly #access: GlobalSearchAccess<TActor, TTenant>
  readonly #maximumLength: number
  readonly #maximumResults: number
  readonly #minimumLength: number
  readonly #resources: readonly RegisteredGlobalSearchResource<TActor, TTenant>[]

  constructor(
    resources: readonly RegisteredGlobalSearchResource<TActor, TTenant>[],
    access: GlobalSearchAccess<TActor, TTenant>,
    options: GlobalSearchOptions = {},
  ) {
    this.#minimumLength = options.minimumLength ?? 2
    this.#maximumLength = options.maximumLength ?? 200
    this.#maximumResults = options.maximumResults ?? 50
    assertInteger(this.#minimumLength, 1, 100, 'Global search minimum length')
    assertInteger(this.#maximumLength, this.#minimumLength, 1000, 'Global search maximum length')
    assertInteger(this.#maximumResults, 1, 500, 'Global search maximum results')
    const ids = new Set<string>()
    for (const resource of resources) {
      const key = `${resource.panelId}:${resource.guard}:${resource.id}`
      if (ids.has(key)) throw new Error(`Duplicate global search resource "${resource.id}" in panel "${resource.panelId}"`)
      ids.add(key)
    }
    this.#resources = Object.freeze([...resources])
    this.#access = access
  }

  async search(request: GlobalSearchRequest<TActor, TTenant>): Promise<GlobalSearchResponse> {
    const term = request.term.trim().replace(/\s+/gu, ' ')
    if (term.length < this.#minimumLength || term.length > this.#maximumLength) {
      throw new Error(`Global search terms must contain ${this.#minimumLength} to ${this.#maximumLength} characters`)
    }
    const context: GlobalSearchContext<TActor, TTenant> = { actor: request.actor, guard: request.guard, panelId: request.panelId, panelPath: request.panelPath, signal: request.signal, tenant: request.tenant }
    if (request.signal.aborted) throw request.signal.reason
    if (!await this.#access.authorizeGuard(context) || !await this.#access.authorizePanel(context)) throw new Error('Global search is not authorized')
    const resources = this.#resources
      .filter(resource => resource.panelId === request.panelId && resource.guard === request.guard)
      .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0) || left.id.localeCompare(right.id))
    const results: GlobalSearchResult[] = []
    for (const resource of resources) {
      if (request.signal.aborted) throw request.signal.reason
      const limit = Math.min(10, this.#maximumResults - results.length)
      if (limit < 1) break
      results.push(...await resource.search(term, limit, context))
      if (results.length >= this.#maximumResults) break
    }
    return Object.freeze({ panelId: request.panelId, results: Object.freeze(results), term })
  }

}

function defineGlobalSearchResource<
  TRecord extends object,
  TQuery,
  TActor,
  TTenant,
  TPath extends SearchablePath<TRecord>,
>(resource: GlobalSearchResource<TRecord, TQuery, TActor, TTenant, TPath>): RegisteredGlobalSearchResource<TActor, TTenant> {
  assertResource(resource)
  const frozen = Object.freeze({ ...resource, actions: Object.freeze([...(resource.actions ?? [])]), attributes: Object.freeze([...resource.attributes]), details: Object.freeze([...(resource.details ?? [])]) })
  return Object.freeze({
    guard: frozen.guard,
    id: frozen.id,
    panelId: frozen.panelId,
    search: async (term: string, maximum: number, context: GlobalSearchContext<TActor, TTenant>) => {
      if (!await frozen.authorizeResource(context)) return []
      const limit = Math.min(frozen.limit ?? 10, maximum)
      const tenantScoped = frozen.scopeTenant(frozen.createQuery(context), context)
      const authorized = frozen.scopeAuthorization(tenantScoped, context)
      const queried = frozen.applySearch(authorized, term, frozen.attributes)
      const records = await frozen.execute(queried, limit, context.signal)
      if (records.length > limit) throw new Error(`Global search resource "${frozen.id}" exceeded the requested result limit`)
      const paths = [frozen.title, frozen.resultId, frozen.image, ...frozen.attributes, ...frozen.details.map(detail => detail.path)].filter((path): path is TPath => path !== undefined)
      const relations = relationPaths(paths)
      if (relations.length > 0) {
        if (!frozen.loadRelations) throw new Error(`Global search resource "${frozen.id}" must batch-load relation paths`)
        await frozen.loadRelations(records, relations, context)
      }
      let decisions: ReturnType<typeof authorizationDecisions>
      try {
        decisions = authorizationDecisions(
          await frozen.authorizeResults(records, context),
          records.length,
          new Set(frozen.actions.map(action => action.id)),
        )
      } catch {
        throw new Error('Global search authorization failed')
      }
      const results: GlobalSearchResult[] = []
      for (const [index, record] of records.entries()) {
        if (context.signal.aborted) throw context.signal.reason
        const decision = decisions[index]
        if (!decision || !decision.result || !decision.page) continue
        const actions: GlobalSearchAction[] = []
        for (const action of frozen.actions) {
          if (!decision.actions.includes(action.id)) continue
          actions.push(Object.freeze({ id: action.id, label: action.label, url: safePanelUrl(action.url(record, context), context.panelPath) }))
        }
        results.push(Object.freeze({
          actions: Object.freeze(actions),
          details: Object.freeze(Object.fromEntries(frozen.details.map(detail => [detail.label, display(pathValue(record, detail.path))]))),
          icon: frozen.icon ?? null,
          id: display(pathValue(record, frozen.resultId)),
          image: frozen.image ? display(pathValue(record, frozen.image)) || null : null,
          resourceId: frozen.id,
          title: display(pathValue(record, frozen.title)),
          url: safePanelUrl(frozen.resultUrl(record, context), context.panelPath),
        }))
      }
      return Object.freeze(results)
    },
    sort: frozen.sort ?? 0,
  })
}

export interface GlobalSearchTypeSources<
  TRecordSource extends { readonly prototype: object },
  TQuerySource extends { readonly prototype: object },
  TActorSource extends RuntimeTypeSource,
  TTenantSource extends RuntimeTypeSource,
> {
  readonly actor: TActorSource
  readonly query: TQuerySource
  readonly record: TRecordSource
  readonly tenant: TTenantSource
}

export function globalSearchFor<
  TRecordSource extends { readonly prototype: object },
  TQuerySource extends { readonly prototype: object },
  TActorSource extends RuntimeTypeSource,
  TTenantSource extends RuntimeTypeSource,
>(_sources: GlobalSearchTypeSources<TRecordSource, TQuerySource, TActorSource, TTenantSource>) {
  type TRecord = TRecordSource['prototype']
  type TQuery = TQuerySource['prototype']
  type TActor = RuntimeTypeValue<TActorSource>
  type TTenant = RuntimeTypeValue<TTenantSource>

  return <TPath extends SearchablePath<TRecord>>(
    resource: GlobalSearchResource<TRecord, TQuery, TActor, TTenant, TPath>,
  ): RegisteredGlobalSearchResource<TActor, TTenant> => defineGlobalSearchResource<TRecord, TQuery, TActor, TTenant, TPath>(resource)
}
