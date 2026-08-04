# P17 bounded execution public API proposal

Status: approved by the user on 2026-07-29 for implementation as specified.

This proposal closes the six remaining scale-boundary gaps found while auditing the P17 requirement to fix N+1 queries and unbounded payloads. It supersedes only the conflicting signatures in the P14 and P15 proposals. Nothing in this document is an exported API until the user explicitly approves it.

## 1. Relation-manager record pagination

The current public `RelationPersistence.list(query)` and `RelationManagerExecutor.list(context)` contracts require the persistence adapter to materialize every related record. Slicing the returned array inside Panels would bound the response but would not bound the database query, so this requires a public contract change.

```ts
export interface RelationListRequest {
  readonly includeTotal?: boolean
  readonly page?: number
  readonly perPage?: number
}

export interface NormalizedRelationListRequest {
  readonly includeTotal: boolean
  readonly page: number
  readonly perPage: number
}

export interface RelationRecordPage<TRelated> {
  readonly hasMore: boolean
  readonly page: number
  readonly perPage: number
  readonly records: readonly TRelated[]
  readonly total?: number
}

export interface RelationPersistence<
  TOwner,
  TRelated,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TPivot extends Readonly<Record<string, unknown>>,
  TValue extends OptionValue,
  TActor extends object,
  TTenant,
> {
  list(
    query: TQuery,
    request: NormalizedRelationListRequest,
  ): Promise<RelationRecordPage<TRelated>>
}

export class RelationManagerExecutor<
  TOwner,
  TRelated,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TPivot extends Readonly<Record<string, unknown>>,
  TValue extends OptionValue,
  TActor extends object,
  TTenant,
> {
  list(
    request: RelationListRequest,
    context: RelationManagerContext<TOwner, TActor, TTenant>,
  ): Promise<RelationRecordPage<TRelated>>
}
```

`page` defaults to `1`, `perPage` defaults to `25`, and `includeTotal` defaults to `true`. `page` must be a safe integer from 1 through 1,000,000. `perPage` must be a safe integer from 1 through 100. The persistence adapter must execute a bounded query and must request at most `perPage + 1` records when deriving `hasMore`; it must not load all records and slice them in memory. It returns `total` exactly when `includeTotal` is true. Panels rejects mismatched page metadata, more than `perPage` records, a negative or unsafe total, `hasMore: true` on a page at or beyond a supplied total, and an aborted request.

The existing `list(context)` overload and unpaged `RelationPersistence.list(query)` signature are removed. Holo Panels is unreleased, and retaining either path would preserve the unbounded behavior. Relation operation routes accept only the three allow-listed request properties, normalize them before query creation, and continue applying owner, tenant, and authorization scopes before pagination. React, Vue, and Svelte relation-manager renderers consume the returned page with their existing pagination primitive. No Holo-JS change is required because `@holo-js/db` already provides bounded query pagination.

## 2. Tenant membership pagination and direct resolution

The current `PanelTenancyOptions.memberships(scope)` callback materializes as many as 10,000 tenants, and active/switch/queued resolution scans that array. A post-resolution length check does not bound the membership query. The tenancy source therefore becomes paged and supplies scoped direct lookups.

```ts
export interface PanelTenantMembershipRequest {
  readonly cursor: string | null
  readonly limit: number
  readonly search: string
}

export interface PanelTenantMembershipPage<TTenant> {
  readonly nextCursor: string | null
  readonly tenants: readonly TTenant[]
}

export interface PanelTenantPresentationPage extends JsonObject {
  memberships: PanelTenantPresentation[]
  nextCursor: string | null
}

export interface PanelTenancyOptions<
  TActor,
  TTenant,
  TTenantId extends PanelTenantIdentifier,
  TModel,
> {
  readonly model: TModel
  readonly persistence: PanelActiveTenantPersistence<TActor, TTenantId>
  readonly membershipPageSize?: number
  identify(tenant: TTenant): TTenantId
  routeKey(tenant: TTenant): string
  memberships(
    request: PanelTenantMembershipRequest,
    scope: PanelAuthenticatedScope<TActor>,
  ): PanelTenantMembershipPage<TTenant>
    | Promise<PanelTenantMembershipPage<TTenant>>
  findMembershipById(
    tenantId: TTenantId,
    scope: PanelAuthenticatedScope<TActor>,
  ): TTenant | null | Promise<TTenant | null>
  findMembershipByRouteKey(
    routeKey: string,
    scope: PanelAuthenticatedScope<TActor>,
  ): TTenant | null | Promise<TTenant | null>
  authorize(
    tenant: TTenant,
    scope: PanelAuthenticatedScope<TActor>,
  ): boolean | Promise<boolean>
  present(
    tenant: TTenant,
    scope: PanelAuthenticatedScope<TActor>,
  ): PanelTenantPresentationInput | Promise<PanelTenantPresentationInput>
}

export interface PanelTenantBootstrap {
  readonly active: PanelTenantPresentation | null
  readonly memberships: PanelTenantPresentationPage
}

export interface CompiledPanelTenancy<TActor> {
  active(
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantIdentity | null>
  bootstrap(
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantBootstrap>
  clear(scope: PanelAuthenticatedScope<TActor>): Promise<void>
  memberships(
    request: Partial<PanelTenantMembershipRequest>,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantPresentationPage>
  queuedContext(
    tenantId: PanelTenantIdentifier,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelQueuedTenantContext>
  resolveQueued(
    payload: unknown,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantIdentity>
  switch(
    routeKey: string,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelTenantIdentity>
}
```

`membershipPageSize` defaults to `25` and must be a safe integer from 1 through 100. Bootstrap requests the first page with `{ cursor: null, limit: membershipPageSize, search: '' }`. Subsequent switcher searches use the compiled `memberships` method. A client membership request may omit fields; `cursor`, `limit`, and `search` respectively default to `null`, the configured page size, and `''`. A cursor is an opaque string of at most 2,048 UTF-8 bytes. Search is trimmed, whitespace-normalized, and limited to 200 Unicode code points. The returned page may contain at most the requested limit, and `nextCursor` must differ from the input cursor and satisfy the same cursor bound.

Every returned tenant is still passed through `identify`, `routeKey`, `authorize`, and `present`. IDs and route keys must be unique within a page. A repeated ID or route key across pages is rejected when the client store merges pages. The membership source must apply actor membership scope and the requested search before its cursor limit; it must not enumerate all memberships and slice them in memory.

Active tenant loading and queued tenant resolution call `findMembershipById`; switching calls `findMembershipByRouteKey`. Each direct lookup is followed by identifier/route-key consistency checks and `authorize`, so a source cannot substitute a different tenant. Missing, revoked, inconsistent, and denied membership lookups retain the existing indistinguishable not-found/access-denied behavior. A stale active tenant is cleared. Browser input cannot supply actor, guard, panel, tenant ID, model, or query fields.

This replaces `PanelTenancyOptions.memberships(scope)` and changes `PanelTenantBootstrap.memberships` from an array to a page. The P14 tenant operation proposed in `p14-api-amendment-proposal.md` is correspondingly extended to accept exactly these two payloads:

```ts
export type PanelTenantOperationRequest
  = {
      readonly action: 'list'
      readonly cursor?: string | null
      readonly limit?: number
      readonly search?: string
    }
  | {
      readonly action: 'switch'
      readonly routeKey: string
    }
```

All three framework adapters keep the same fixed operation route and native redirect/session effects. Their tenant switchers append or replace pages using `nextCursor`; no adapter-specific public option is added. No Holo-JS change is required.

## 3. Paginated temporary-upload storage listing

`UploadStorageAdapter.files(directory)` and Holo Storage's `StorageDisk.files(directory)` both return an unbounded array. Cleanup and concurrent-upload enforcement use that method, so Panels cannot fix this only by slicing its result. Both repositories require a public storage pagination contract.

### Holo Panels

```ts
export interface UploadStorageListRequest {
  readonly cursor: string | null
  readonly limit: number
}

export interface UploadStorageListPage {
  readonly nextCursor: string | null
  readonly paths: readonly string[]
}

export interface UploadStorageAdapter {
  delete(path: string): Promise<void>
  getBytes(path: string): Promise<Uint8Array | null>
  getJson<TValue>(path: string): Promise<TValue | null>
  list(
    directory: string,
    request: UploadStorageListRequest,
  ): Promise<UploadStorageListPage>
  put(path: string, contents: Uint8Array): Promise<void>
  putJson(path: string, value: unknown): Promise<void>
  temporaryUrl(path: string, expiresInSeconds: number): Promise<string>
}
```

`files` is removed. Panels always requests pages of 100 metadata paths. Adapters may return fewer, but never more. Cursors are opaque strings limited to 2,048 UTF-8 bytes. Returned paths must be unique within the page, remain beneath the requested normalized directory, and contain no traversal or control characters. A non-null next cursor must differ from the request cursor. Cleanup processes one page at a time and deletes expired pairs before requesting the next page. Active-upload counting stops as soon as `maximumFiles` in-scope, unexpired uploads have been found; it never retains metadata for unrelated scopes after inspecting a page.

Malformed pages, repeated cursors, duplicate paths across pages, paths outside the requested directory, and adapter overproduction throw `UploadStoragePaginationError`. Cleanup does not delete anything referenced by a malformed page. Authorization and scope checks remain unchanged.

### Adjacent Holo-JS repository

The following is added to `@holo-js/storage/runtime` and the static `Storage` facade, while the unbounded `files()` method is removed:

```ts
export interface StorageFileListRequest {
  readonly cursor?: string | null
  readonly limit?: number
}

export interface StorageFileListPage {
  readonly nextCursor: string | null
  readonly paths: readonly string[]
}

export interface StorageDisk {
  listFiles(
    directory?: string,
    request?: StorageFileListRequest,
  ): Promise<StorageFileListPage>
}

export interface StorageBackend {
  getKeysPage?(
    base: string | undefined,
    request: Required<StorageFileListRequest>,
  ): Promise<StorageFileListPage>
}

export const Storage: {
  listFiles(
    directory?: string,
    request?: StorageFileListRequest,
  ): Promise<StorageFileListPage>
  // Existing bounded/non-listing facade methods are unchanged.
}
```

The Holo default limit is 100 and the maximum is 1,000. Limit and cursor validation matches Panels. Ordering is deterministic by normalized storage key for the lifetime of a traversal. Local/public disks scan directory entries while retaining only the next bounded page rather than accumulating the full directory. The S3 driver's optional backend capability issues one ListObjectsV2 request with `max-keys=limit` and wraps the native continuation token in an opaque cursor carrying its disk/prefix binding. Holo validates that binding before delegation, and a cursor cannot be replayed against another disk or prefix. Backend failure, a missing bounded S3 capability, malformed driver pagination, or cursor mismatch throws `StoragePaginationError`; the error never includes credentials, signed URLs, local roots, raw continuation tokens, or object names.

`@holo-js/storage-s3` gains the bounded driver capability used by `StorageDisk.listFiles`. Existing Holo call sites using `files()` must migrate to an explicit page loop. Holo Panels' `createHoloUploadStorage` delegates directly to `listFiles`. No compatibility overload remains because it would preserve an unbounded public path.

## 4. Batched global-search authorization

Global search currently invokes result access, result-page access, and each action authorization callback once per record. Relations are batch-loaded, but authorization remains N+1. Authorization becomes one decision call per resource result batch.

```ts
export interface GlobalSearchResultAuthorization {
  readonly actions: readonly string[]
  readonly page: boolean
  readonly result: boolean
}

export interface GlobalSearchResultAction<TRecord, TActor, TTenant> {
  readonly id: string
  readonly label: string
  readonly url: (
    record: TRecord,
    context: GlobalSearchContext<TActor, TTenant>,
  ) => string
}

export interface GlobalSearchResource<
  TRecord,
  TQuery,
  TActor,
  TTenant,
  TPath extends SearchablePath<TRecord> = SearchablePath<TRecord>,
> {
  authorizeResults(
    records: readonly TRecord[],
    context: GlobalSearchContext<TActor, TTenant>,
  ): readonly GlobalSearchResultAuthorization[]
    | Promise<readonly GlobalSearchResultAuthorization[]>
}
```

This replaces `authorizeResult`, `authorizeResultPage`, and `GlobalSearchResultAction.authorize`. All other `GlobalSearchResource` fields remain unchanged. The callback runs exactly once after the bounded query and relation batch load. It must return exactly one positional decision per record. `actions` contains only configured action IDs and must not contain duplicates. A result is emitted only when both `result` and `page` are true. Only allow-listed action IDs from a valid emitted result are projected.

A missing, short, long, malformed, or throwing authorization response fails the search operation closed and produces a sanitized server error rather than returning partial results or falling back to per-record calls. This is a deliberate breaking change in the unreleased package; no legacy callback path remains. The resource author must implement the callback with policy/query bulk primitives rather than a loop that issues one query per record. Focused query-count tests will assert one resource authorization callback regardless of result count. No client manifest or renderer shape changes, no framework-adapter changes, and no Holo-JS changes are required.

## 5. Batched export column resolution

The current internal engine and the P15 proposal invoke computed state, option, and formatter callbacks for every cell. Parallel `Promise.all` does not remove the N+1 query pattern. Column callbacks therefore operate on each fetched chunk as a batch.

```ts
export interface ExportColumnBatchContext<
  TRecord,
  TActor extends object,
  TTenant,
> extends TransferExecutionContext<TActor, TTenant> {
  readonly records: readonly Readonly<TRecord>[]
}

export interface ExportColumnBatchValueContext<
  TRecord,
  TValue extends ExportCell,
  TActor extends object,
  TTenant,
> extends ExportColumnBatchContext<TRecord, TActor, TTenant> {
  readonly values: readonly TValue[]
}

export class ExportColumnBuilder<
  TRecord,
  TValue extends ExportCell,
  TActor extends object,
  TTenant,
> {
  options(
    resolver: (
      context: ExportColumnBatchValueContext<
        TRecord,
        TValue,
        TActor,
        TTenant
      >,
    ) => readonly ExportColumnOption<TValue>[]
      | Promise<readonly ExportColumnOption<TValue>[]>,
  ): this

  format(
    formatter: (
      context: ExportColumnBatchValueContext<
        TRecord,
        TValue,
        TActor,
        TTenant
      >,
    ) => readonly ExportCell[] | Promise<readonly ExportCell[]>,
  ): this
}

export class ExporterBuilder<
  TQuery,
  TRecord,
  TRecordId extends TableRecordIdentifier,
  TActor extends object,
  TTenant,
> {
  computed<TValue extends ExportCell>(
    id: string,
    state: (
      context: ExportColumnBatchContext<TRecord, TActor, TTenant>,
    ) => readonly TValue[] | Promise<readonly TValue[]>,
    configure?: (
      column: ExportColumnBuilder<TRecord, TValue, TActor, TTenant>,
    ) => ExportColumnBuilder<TRecord, TValue, TActor, TTenant>,
  ): this
}

export interface CompiledExportColumn<
  TRecord,
  TActor extends object,
  TTenant,
> {
  state?(
    context: ExportColumnBatchContext<TRecord, TActor, TTenant>,
  ): readonly ExportCell[] | Promise<readonly ExportCell[]>
  options?(
    context: ExportColumnBatchValueContext<
      TRecord,
      ExportCell,
      TActor,
      TTenant
    >,
  ): readonly ExportColumnOption<ExportCell>[]
    | Promise<readonly ExportColumnOption<ExportCell>[]>
  format?(
    context: ExportColumnBatchValueContext<
      TRecord,
      ExportCell,
      TActor,
      TTenant
    >,
  ): readonly ExportCell[] | Promise<readonly ExportCell[]>
}
```

Path columns are projected from the already relation/aggregate-loaded records without invoking `state`. For every chunk, Panels invokes each selected computed `state` once, each selected `options` once with the column's resolved values, and each selected `format` once with the option-mapped values. Callback result arrays must exactly match `records.length`; otherwise the export fails with `ExportEngineError` code `inconsistent_resolver`. Option values must be unique, scalar, and bounded to 10,000 entries per callback. Existing scalar validation and sanitized job failure behavior remain unchanged.

This supersedes the per-record `ExportColumnContext`, `ExportColumnValueContext`, `ExporterBuilder.computed`, `ExportColumnBuilder.options`, `ExportColumnBuilder.format`, and matching `CompiledExportColumn` signatures in `p15-public-api-proposal.md`. The two per-record context types are removed. There is no compatibility adapter because calling old callbacks once per record would retain the N+1 behavior. Export chunk size continues to default to the P15 proposal's value and remains the hard upper bound on each resolver input. No renderer, framework-adapter, or Holo-JS change is required.

## 6. Fixed operation-response byte ceiling

All three framework adapters bound panel operation request bodies at 1 MiB but currently serialize success responses without a byte ceiling. This can be fixed consistently without adding a configuration API.

Every Next, Nuxt, and SvelteKit panel operation handler will apply a fixed 4 MiB (`4_194_304` UTF-8 bytes) ceiling to the complete validated JSON response envelope, including data and effects. The handler serializes exactly once, measures the encoded bytes before writing headers or a body, and returns those same bytes. A response over the ceiling is discarded and replaced with a bounded error envelope:

```json
{
  "effects": [],
  "error": {
    "category": "internal",
    "code": "response_too_large",
    "message": "Panel operation response exceeded the server limit.",
    "retryable": false
  },
  "id": "<validated request id>",
  "ok": false,
  "protocolVersion": "1.0"
}
```

The HTTP status is 500 and `cache-control: no-store` remains mandatory. Redirect and toast effects from an oversized success are not flashed or returned. Error envelopes are generated from fixed bounded fields and are also measured as a defensive invariant. A failure to serialize a success value follows the existing sanitized internal-error path. The ceiling applies to `bootstrap`, `page-data`, `table-data`, `form-submit`, `options`, `resolver`, `action`, `notification`, and `upload` operation responses. Direct file upload/download bodies and framework-rendered HTML are outside this JSON-envelope limit and retain their dedicated limits.

The 4 MiB value is intentionally not configurable per adapter: configurable ceilings would make the three supported integrations diverge and would allow an application to reintroduce an unbounded endpoint. This changes observable failure behavior but adds, removes, or reshapes no TypeScript export. No Holo-JS change is required.

## Compatibility and validation gate

These packages have not been released. The relation, tenancy, upload, global-search, and export changes are intentional pre-release breaking changes, and generators, examples, tests, declarations, API references, and proposal documents must be updated atomically after approval. No deprecated overloads or compatibility shims will be retained.

Before the P17 N+1/unbounded-payload item may be checked, validation must prove:

- relation list database work remains bounded at 1, 25, 100, and over-limit requests;
- tenant bootstrap, search, active resolution, switching, queued resolution, cursor replay, membership revocation, and cross-tenant attempts never enumerate all memberships;
- local/public and S3 upload cleanup traverse multiple pages, reject malformed cursors/pages, and stop active counting early;
- global-search query-count evidence stays constant as record/action counts grow;
- export state/options/format callback counts stay constant per selected column per chunk;
- each adapter rejects multibyte UTF-8 envelopes immediately above 4 MiB without emitting success data or effects;
- strict typecheck, ESLint, focused JSON-reported Vitest suites, full workspace validation, package builds, packed smoke tests, and all affected example acceptance pass in Holo Panels; and
- the adjacent Holo Storage and S3 packages pass strict typecheck, lint, focused driver/runtime tests, full affected workspace tests, builds, and packed consumer validation.
