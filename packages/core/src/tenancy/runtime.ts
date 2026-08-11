import type { PanelAuthenticatedScope } from '../panels/contracts'
import type {
  PanelQueuedTenantContext,
  PanelResolvedTenant,
  PanelTenancyOptions,
  PanelTenantIdentifier,
  PanelTenantMembershipRequest,
} from './contracts'

const ROUTE_KEY = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,199}$/u
const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100
const MAX_CURSOR_BYTES = 2_048
const MAX_SEARCH_LENGTH = 200

export type PanelTenantResolutionFailure = 'access-denied' | 'invalid-context' | 'not-found'

export class PanelTenantResolutionError extends Error {
  constructor(readonly failure: PanelTenantResolutionFailure) {
    super('Tenant could not be resolved')
    this.name = 'PanelTenantResolutionError'
  }
}

function tenantIdType(value: PanelTenantIdentifier): 'number' | 'string' {
  return typeof value === 'number' ? 'number' : 'string'
}

function validTenantId(value: unknown): value is PanelTenantIdentifier {
  return typeof value === 'string'
    ? value.length > 0 && value.length <= 200
    : typeof value === 'number' && Number.isSafeInteger(value)
}

function sameTenantId(left: PanelTenantIdentifier, right: PanelTenantIdentifier): boolean {
  return typeof left === typeof right && left === right
}

function validateRouteKey(value: string): string {
  if (!ROUTE_KEY.test(value)) throw new TypeError('Tenant route keys must be safe single route segments')
  return value
}

function validateContextScope<TActor>(
  context: Readonly<{ guard: string, panelId: string }>,
  scope: PanelAuthenticatedScope<TActor>,
): void {
  if (context.guard !== scope.guard || context.panelId !== scope.panelId) {
    throw new PanelTenantResolutionError('invalid-context')
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && !Array.isArray(value) && typeof value === 'object'
}

function isQueuedTenantContext(value: unknown): value is Readonly<{
  guard: string
  panelId: string
  tenantId: PanelTenantIdentifier
  tenantIdType: 'number' | 'string'
  version: 1
}> {
  return isRecord(value)
    && value.version === 1
    && validTenantId(value.tenantId)
    && value.tenantIdType === tenantIdType(value.tenantId)
    && typeof value.guard === 'string'
    && typeof value.panelId === 'string'
}

function cursorBytes(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function normalizeSearch(value: string): string {
  const normalized = value.trim().replace(/\s+/gu, ' ')
  if ([...normalized].length > MAX_SEARCH_LENGTH) {
    throw new RangeError(`Tenant membership search cannot exceed ${MAX_SEARCH_LENGTH} characters`)
  }
  return normalized
}

function validateCursor(value: string | null): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || value.length === 0 || cursorBytes(value) > MAX_CURSOR_BYTES) {
    throw new TypeError('Tenant membership cursors must be bounded opaque strings')
  }
  return value
}

export class PanelTenancyRuntime<
  TActor,
  TTenant,
  TTenantId extends PanelTenantIdentifier,
  TModel,
  TRegistrationValues extends Readonly<Record<string, unknown>> = Readonly<Record<never, never>>,
  TProfileValues extends Readonly<Record<string, unknown>> = Readonly<Record<never, never>>,
> {
  readonly #pageSize: number

  constructor(private readonly options: PanelTenancyOptions<TActor, TTenant, TTenantId, TModel, TRegistrationValues, TProfileValues>) {
    if (
      typeof options.authorize !== 'function'
      || typeof options.findMembershipById !== 'function'
      || typeof options.findMembershipByRouteKey !== 'function'
      || typeof options.identify !== 'function'
      || typeof options.memberships !== 'function'
      || typeof options.present !== 'function'
      || typeof options.routeKey !== 'function'
      || typeof options.persistence?.clear !== 'function'
      || typeof options.persistence.load !== 'function'
      || typeof options.persistence.save !== 'function'
    ) {
      throw new TypeError('Panel tenancy requires identity, membership, access, route, and persistence capabilities')
    }
    const pageSize = options.membershipPageSize ?? DEFAULT_PAGE_SIZE
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new RangeError(`Panel tenant membership page size must be from 1 through ${MAX_PAGE_SIZE}`)
    }
    this.#pageSize = pageSize
  }

  get pageSize(): number {
    return this.#pageSize
  }

  normalizeMembershipRequest(request: Partial<PanelTenantMembershipRequest>): Readonly<PanelTenantMembershipRequest> {
    if (request === null || Array.isArray(request) || typeof request !== 'object') {
      throw new TypeError('Tenant membership request must be an object')
    }
    for (const key of Object.keys(request)) {
      if (key !== 'cursor' && key !== 'limit' && key !== 'search') {
        throw new TypeError(`Tenant membership request property "${key}" is not allowed`)
      }
    }
    const limit = request.limit ?? this.#pageSize
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new RangeError(`Tenant membership limit must be from 1 through ${MAX_PAGE_SIZE}`)
    }
    if (typeof request.search !== 'undefined' && typeof request.search !== 'string') {
      throw new TypeError('Tenant membership search must be a string')
    }
    return Object.freeze({
      cursor: validateCursor(request.cursor ?? null),
      limit,
      search: normalizeSearch(request.search ?? ''),
    })
  }

  async memberships(
    request: Partial<PanelTenantMembershipRequest>,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<Readonly<{
      nextCursor: string | null
      tenants: readonly PanelResolvedTenant<TTenant, TTenantId>[]
    }>> {
    const normalized = this.normalizeMembershipRequest(request)
    const page = await this.options.memberships(normalized, scope)
    if (!isRecord(page) || !Array.isArray(page.tenants) || page.tenants.length > normalized.limit) {
      throw new TypeError('Panel tenant memberships must return a bounded page')
    }
    const nextCursor = validateCursor(page.nextCursor as string | null)
    if (nextCursor !== null && nextCursor === normalized.cursor) {
      throw new TypeError('Panel tenant membership cursor must advance')
    }
    const ids: PanelTenantIdentifier[] = []
    const routeKeys = new Set<string>()
    const tenants: PanelResolvedTenant<TTenant, TTenantId>[] = []
    for (const tenant of page.tenants as readonly TTenant[]) {
      const resolved = await this.resolveTenant(tenant, scope)
      if (ids.some(id => sameTenantId(id, resolved.id))) throw new TypeError('Tenant memberships require unique identifiers')
      if (routeKeys.has(resolved.routeKey)) throw new TypeError('Tenant memberships require unique route keys')
      ids.push(resolved.id)
      routeKeys.add(resolved.routeKey)
      if (await this.options.authorize(tenant, scope)) tenants.push(resolved)
    }
    return Object.freeze({ nextCursor, tenants: Object.freeze(tenants) })
  }

  async active(scope: PanelAuthenticatedScope<TActor>): Promise<PanelResolvedTenant<TTenant, TTenantId> | null> {
    const activeTenantId = await this.options.persistence.load(scope)
    if (activeTenantId === null || !validTenantId(activeTenantId)) {
      if (activeTenantId !== null) await this.options.persistence.clear(scope)
      return null
    }
    const tenant = await this.findById(activeTenantId, scope)
    if (tenant) return tenant
    await this.options.persistence.clear(scope)
    return null
  }

  async bootstrap(scope: PanelAuthenticatedScope<TActor>): Promise<Readonly<{
    active: PanelResolvedTenant<TTenant, TTenantId> | null
    memberships: readonly PanelResolvedTenant<TTenant, TTenantId>[]
    nextCursor: string | null
  }>> {
    const [page, active] = await Promise.all([
      this.memberships({ cursor: null, limit: this.#pageSize, search: '' }, scope),
      this.active(scope),
    ])
    return Object.freeze({ active, memberships: page.tenants, nextCursor: page.nextCursor })
  }

  async switch(routeKey: string, scope: PanelAuthenticatedScope<TActor>): Promise<PanelResolvedTenant<TTenant, TTenantId>> {
    const resolved = await this.resolveRoute(routeKey, scope)
    await this.options.persistence.save(scope, resolved.id)
    return resolved
  }

  async resolveRoute(routeKey: string, scope: PanelAuthenticatedScope<TActor>): Promise<PanelResolvedTenant<TTenant, TTenantId>> {
    let candidate: string
    try {
      candidate = validateRouteKey(routeKey)
    } catch {
      throw new PanelTenantResolutionError('not-found')
    }
    const tenant = this.options.resolveTenantUsing
      ? await this.options.resolveTenantUsing(candidate, scope)
      : await this.options.findMembershipByRouteKey(candidate, scope)
    const resolved = tenant === null ? null : await this.resolveTenant(tenant, scope)
    if (resolved === null || resolved.routeKey !== candidate || !await this.options.authorize(resolved.tenant, scope)) {
      throw new PanelTenantResolutionError('not-found')
    }
    return resolved
  }

  async clear(scope: PanelAuthenticatedScope<TActor>): Promise<void> {
    await this.options.persistence.clear(scope)
  }

  async register(payload: unknown, scope: PanelAuthenticatedScope<TActor>): Promise<PanelResolvedTenant<TTenant, TTenantId>> {
    const registration = this.options.registration
    if (!registration) throw new PanelTenantResolutionError('not-found')
    const values = await registration.validate(payload, scope)
    const created = await registration.create(values, scope)
    const resolved = await this.resolveTenant(created, scope)
    const membership = await this.findById(resolved.id, scope)
    if (!membership) throw new PanelTenantResolutionError('access-denied')
    await this.options.persistence.save(scope, membership.id)
    return membership
  }

  async profileRead(scope: PanelAuthenticatedScope<TActor>): Promise<TProfileValues> {
    const profile = this.options.profile
    if (!profile) throw new PanelTenantResolutionError('not-found')
    const active = await this.active(scope)
    if (!active) throw new PanelTenantResolutionError('access-denied')
    return await profile.read(active.tenant, scope)
  }

  async profileUpdate(payload: unknown, scope: PanelAuthenticatedScope<TActor>): Promise<TProfileValues> {
    const profile = this.options.profile
    if (!profile) throw new PanelTenantResolutionError('not-found')
    const active = await this.active(scope)
    if (!active) throw new PanelTenantResolutionError('access-denied')
    const values = await profile.validate(payload, active.tenant, scope)
    const updated = await profile.update(active.tenant, values, scope)
    const resolved = await this.resolveTenant(updated, scope)
    if (!sameTenantId(resolved.id, active.id)) throw new PanelTenantResolutionError('invalid-context')
    const membership = await this.findById(resolved.id, scope)
    if (!membership) throw new PanelTenantResolutionError('access-denied')
    return await profile.read(membership.tenant, scope)
  }

  async queuedContext(tenantId: PanelTenantIdentifier, scope: PanelAuthenticatedScope<TActor>): Promise<Readonly<PanelQueuedTenantContext>> {
    if (!validTenantId(tenantId)) throw new PanelTenantResolutionError('not-found')
    const tenant = await this.findById(tenantId, scope)
    if (!tenant) throw new PanelTenantResolutionError('access-denied')
    return Object.freeze({
      guard: scope.guard,
      panelId: scope.panelId,
      tenantId: tenant.id,
      tenantIdType: tenantIdType(tenant.id),
      version: 1,
    })
  }

  async resolveQueued(context: unknown, scope: PanelAuthenticatedScope<TActor>): Promise<PanelResolvedTenant<TTenant, TTenantId>> {
    if (!isQueuedTenantContext(context)) throw new PanelTenantResolutionError('invalid-context')
    validateContextScope(context, scope)
    const tenant = await this.findById(context.tenantId, scope)
    if (!tenant) throw new PanelTenantResolutionError('access-denied')
    return tenant
  }

  private async findById(
    tenantId: PanelTenantIdentifier,
    scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelResolvedTenant<TTenant, TTenantId> | null> {
    const tenant = await this.options.findMembershipById(tenantId as TTenantId, scope)
    if (tenant === null) return null
    const resolved = await this.resolveTenant(tenant, scope)
    if (!sameTenantId(resolved.id, tenantId) || !await this.options.authorize(tenant, scope)) return null
    return resolved
  }

  private async resolveTenant(
    tenant: TTenant,
    _scope: PanelAuthenticatedScope<TActor>,
  ): Promise<PanelResolvedTenant<TTenant, TTenantId>> {
    const id = this.options.identify(tenant)
    if (!validTenantId(id)) throw new TypeError('Tenant identifiers must be non-empty strings or safe integers')
    const routeKey = validateRouteKey(this.options.routeKey(tenant))
    return Object.freeze({ id, routeKey, tenant })
  }
}
