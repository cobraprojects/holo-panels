import type {
  CompiledPanelDefinition,
  CompiledPanelRoute,
  HoloAuth,
  PanelRouteHandler,
  PanelRouteMethod,
  PanelRouteRegistrar,
  PanelRouteRegistry,
  PanelRouteScope,
  ResolvedPanelRoute,
} from './contracts'
import { bootPanel, PanelRuntime } from './runtime'

const ROUTE_SEGMENT = /^(?:[a-z0-9][a-z0-9._~-]*|:[a-z][a-z0-9_]*)$/u

function routePath(value: string): string {
  const normalized = value.trim().replace(/^\/+|\/+$/gu, '')
  if (!normalized) return '/'
  if (value.includes('?') || value.includes('#') || value.includes('\\') || value.includes('%')) {
    throw new Error('Panel routes require a plain URL path without query strings, fragments, backslashes, or encoded segments')
  }
  const segments = normalized.split('/')
  if (segments.some(segment => !ROUTE_SEGMENT.test(segment))) throw new Error(`Panel route "${value}" contains an unsafe path segment`)
  return `/${segments.join('/')}`
}

export function compilePanelRoutes(registrars: Readonly<Record<PanelRouteScope, readonly PanelRouteRegistrar[]>>): readonly CompiledPanelRoute[] {
  const routes: CompiledPanelRoute[] = []
  const keys = new Set<string>()
  const register = (scope: PanelRouteScope, method: PanelRouteMethod, path: string, handler: PanelRouteHandler): void => {
    if (typeof handler !== 'function') throw new TypeError('Panel routes require a request handler')
    const normalized = routePath(path)
    const key = `${scope}:${method}:${normalized}`
    if (keys.has(key)) throw new Error(`Duplicate panel route "${method} ${normalized}" in the ${scope} scope`)
    keys.add(key)
    routes.push(Object.freeze({ handler, method, path: normalized, scope }))
  }
  for (const scope of ['public', 'authenticated', 'tenant', 'authenticated-tenant'] as const) {
    const registry: PanelRouteRegistry = Object.freeze({
      delete: (path: string, handler: PanelRouteHandler) => register(scope, 'DELETE', path, handler),
      get: (path: string, handler: PanelRouteHandler) => register(scope, 'GET', path, handler),
      patch: (path: string, handler: PanelRouteHandler) => register(scope, 'PATCH', path, handler),
      post: (path: string, handler: PanelRouteHandler) => register(scope, 'POST', path, handler),
      put: (path: string, handler: PanelRouteHandler) => register(scope, 'PUT', path, handler),
      route: (method: PanelRouteMethod, path: string, handler: PanelRouteHandler) => register(scope, method, path, handler),
    })
    for (const registrar of registrars[scope]) registrar(registry)
  }
  return Object.freeze(routes)
}

function joinedPath(...values: readonly string[]): string {
  const segments = values.flatMap(value => value.split('/').filter(Boolean))
  return segments.length === 0 ? '/' : `/${segments.join('/')}`
}

export function compiledPanelRoutePath<TActor>(panel: CompiledPanelDefinition<TActor>, route: CompiledPanelRoute): string {
  const tenantScoped = route.scope === 'tenant' || route.scope === 'authenticated-tenant'
  if (!tenantScoped || panel.manifest.tenancy?.routeDomain) return joinedPath(panel.manifest.path, route.path)
  return joinedPath(panel.manifest.path, panel.manifest.tenancy?.routePrefix ?? '', ':tenant', route.path)
}

function routeParameters(pattern: string, path: string): Readonly<Record<string, string>> | null {
  const expected = pattern.split('/').filter(Boolean)
  const actual = path.split('/').filter(Boolean)
  if (expected.length !== actual.length) return null
  const parameters: Record<string, string> = {}
  for (let index = 0; index < expected.length; index += 1) {
    const segment = expected[index]!
    const value = actual[index]!
    if (!segment.startsWith(':')) {
      if (segment !== value) return null
      continue
    }
    try {
      parameters[segment.slice(1)] = decodeURIComponent(value)
    } catch {
      return null
    }
  }
  return Object.freeze(parameters)
}

function domainParameters(pattern: string, hostname: string): Readonly<Record<string, string>> | null {
  const expected = pattern.split('.')
  const actual = hostname.split('.')
  if (expected.length !== actual.length) return null
  const parameters: Record<string, string> = {}
  for (let index = 0; index < expected.length; index += 1) {
    const segment = expected[index]!
    const value = actual[index]!
    const parameter = segment.match(/^\{([a-z][a-z0-9_]*)(?::[a-z][a-z0-9_]*)?\}$/u)?.[1]
    if (!parameter) {
      if (segment !== value) return null
      continue
    }
    parameters[parameter] = value
  }
  return Object.freeze(parameters)
}

function acceptsPanelDomain<TActor>(panel: CompiledPanelDefinition<TActor>, hostname: string): boolean {
  const routing = panel.manifest.routing
  if (!routing) return true
  const configured = [...routing.domains, ...(routing.domain ? [routing.domain] : [])]
  return configured.length === 0 || configured.includes(hostname)
}

export function resolvePanelRoute<TActor>(panel: CompiledPanelDefinition<TActor>, request: Request): ResolvedPanelRoute | null {
  const method = request.method.toUpperCase()
  const url = new URL(request.url)
  for (const definition of panel.server.routes ?? []) {
    if (definition.method !== method) continue
    const tenantScoped = definition.scope === 'tenant' || definition.scope === 'authenticated-tenant'
    const tenantDomain = tenantScoped ? panel.manifest.tenancy?.routeDomain : null
    const hostParameters = tenantDomain ? domainParameters(tenantDomain, url.hostname) : null
    if (tenantDomain ? !hostParameters : !acceptsPanelDomain(panel, url.hostname)) continue
    const pathParameters = routeParameters(compiledPanelRoutePath(panel, definition), url.pathname)
    if (pathParameters) return Object.freeze({ definition, parameters: Object.freeze({ ...hostParameters, ...pathParameters }) })
  }
  return null
}

export async function executePanelRoute<TActor>(panel: CompiledPanelDefinition<TActor>, auth: HoloAuth<TActor>, request: Request): Promise<Response | null> {
  const resolved = resolvePanelRoute(panel, request)
  if (!resolved) return null
  const { definition, parameters } = resolved
  if (definition.scope === 'public' || definition.scope === 'tenant') {
    await bootPanel(panel)
    return await definition.handler(request)
  }
  const runtime = new PanelRuntime(auth, [panel])
  return await runtime.execute(panel.manifest.id, 'route', request.signal, async scope => {
    if (definition.scope === 'authenticated-tenant') {
      const tenantKey = parameters.tenant
      if (!tenantKey || !panel.server.tenancy) throw new Error('Authenticated tenant routes require a configured tenant and route key')
      await panel.server.tenancy.resolveRoute(tenantKey, scope)
    }
    return await definition.handler(request)
  })
}
