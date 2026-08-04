type SearchScalar = bigint | boolean | Date | null | number | string | undefined
type SearchKey<TValue> = Extract<keyof TValue, string>

export type SearchablePath<TValue> = {
  [TKey in SearchKey<TValue>]: NonNullable<TValue[TKey]> extends SearchScalar
    ? TKey
    : NonNullable<TValue[TKey]> extends (...parameters: never[]) => unknown
      ? never
      : `${TKey}.${SearchKey<NonNullable<TValue[TKey]>>}`
}[SearchKey<TValue>]

export interface GlobalSearchContext<TActor, TTenant> {
  readonly actor: TActor
  readonly guard: string
  readonly panelId: string
  readonly panelPath: string
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export interface GlobalSearchRequest<TActor, TTenant> extends GlobalSearchContext<TActor, TTenant> {
  readonly term: string
}

export interface GlobalSearchAction {
  readonly id: string
  readonly label: string
  readonly url: string
}

export interface GlobalSearchResult {
  readonly actions: readonly GlobalSearchAction[]
  readonly details: Readonly<Record<string, string>>
  readonly icon: string | null
  readonly id: string
  readonly image: string | null
  readonly resourceId: string
  readonly title: string
  readonly url: string
}

export interface GlobalSearchResponse {
  readonly panelId: string
  readonly results: readonly GlobalSearchResult[]
  readonly term: string
}

export interface GlobalSearchResultAction<TRecord, TActor, TTenant> {
  readonly id: string
  readonly label: string
  readonly url: (record: TRecord, context: GlobalSearchContext<TActor, TTenant>) => string
}

export interface GlobalSearchResultAuthorization {
  readonly actions: readonly string[]
  readonly page: boolean
  readonly result: boolean
}

export interface GlobalSearchResource<
  TRecord,
  TQuery,
  TActor,
  TTenant,
  TPath extends SearchablePath<TRecord> = SearchablePath<TRecord>,
> {
  readonly actions?: readonly GlobalSearchResultAction<TRecord, TActor, TTenant>[]
  readonly applySearch: (query: TQuery, term: string, attributes: readonly TPath[]) => TQuery
  readonly attributes: readonly TPath[]
  readonly authorizeResource: (context: GlobalSearchContext<TActor, TTenant>) => boolean | Promise<boolean>
  readonly authorizeResults: (
    records: readonly TRecord[],
    context: GlobalSearchContext<TActor, TTenant>,
  ) => readonly GlobalSearchResultAuthorization[] | Promise<readonly GlobalSearchResultAuthorization[]>
  readonly createQuery: (context: GlobalSearchContext<TActor, TTenant>) => TQuery
  readonly details?: readonly { readonly label: string, readonly path: TPath }[]
  readonly execute: (query: TQuery, limit: number, signal: AbortSignal) => Promise<readonly TRecord[]>
  readonly guard: string
  readonly icon?: string | null
  readonly id: string
  readonly image?: TPath
  readonly limit?: number
  readonly loadRelations?: (records: readonly TRecord[], paths: readonly string[], context: GlobalSearchContext<TActor, TTenant>) => Promise<void>
  readonly panelId: string
  readonly resultId: TPath
  readonly resultUrl: (record: TRecord, context: GlobalSearchContext<TActor, TTenant>) => string
  readonly scopeAuthorization: (query: TQuery, context: GlobalSearchContext<TActor, TTenant>) => TQuery
  readonly scopeTenant: (query: TQuery, context: GlobalSearchContext<TActor, TTenant>) => TQuery
  readonly sort?: number
  readonly title: TPath
}

export interface GlobalSearchAccess<TActor, TTenant> {
  readonly authorizeGuard: (context: GlobalSearchContext<TActor, TTenant>) => boolean | Promise<boolean>
  readonly authorizePanel: (context: GlobalSearchContext<TActor, TTenant>) => boolean | Promise<boolean>
}

export interface GlobalSearchOptions {
  readonly maximumLength?: number
  readonly maximumResults?: number
  readonly minimumLength?: number
}

export interface RegisteredGlobalSearchResource<TActor, TTenant> {
  readonly guard: string
  readonly id: string
  readonly panelId: string
  readonly search: (term: string, limit: number, context: GlobalSearchContext<TActor, TTenant>) => Promise<readonly GlobalSearchResult[]>
  readonly sort: number
}
