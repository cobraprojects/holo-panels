import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActionExecutionError } from '@holo-js/panels-svelte/server'
import { definePanel } from '@holo-js/panels-core'
import type { RequestEvent } from '@sveltejs/kit'
import type {
  PanelBootstrapData,
  PanelResolvedPageData,
  PanelRuntimeLike,
  SvelteKitPanelEvent,
  SvelteKitPanelRegistry,
} from '../src/contracts'

const mocks = vi.hoisted(() => ({
  csrfCalls: 0,
  contextCalls: 0,
  failFlash: false,
  failTake: false,
  flashed: new Map<string, unknown>(),
  guardNames: [] as string[],
}))

vi.mock('@holo-js/adapter-sveltekit', () => ({
  createSvelteKitHoloHelpers: () => ({
    getAuth: async () => ({
      guard: (name: string) => {
        mocks.guardNames.push(name)
        return {
          async flash(key: string, value: unknown) {
            if (mocks.failFlash) throw new Error('Flash unavailable')
            mocks.flashed.set(`${name}:${key}`, value)
          },
          async take<TValue = unknown>(key: string): Promise<TValue | undefined> {
            if (mocks.failTake) throw new Error('Take unavailable')
            const storageKey = `${name}:${key}`
            const value = mocks.flashed.get(storageKey) as TValue | undefined
            mocks.flashed.delete(storageKey)
            return value
          },
        }
      },
    }),
  }),
  runWithSvelteKitRequestEvent: <TValue>(_event: unknown, callback: () => TValue): TValue => {
    mocks.contextCalls += 1
    return callback()
  },
}))

vi.mock('@holo-js/security/sveltekit/server', () => ({
  csrfProtection: () => async ({ event, resolve }: { readonly event: SvelteKitPanelEvent, readonly resolve: () => Promise<Response> }) => {
    mocks.csrfCalls += 1
    if (event.request.method === 'POST' && event.request.headers.get('x-csrf-token') !== 'valid') return new Response('CSRF token mismatch', { status: 419 })
    return resolve()
  },
}))

vi.mock('@sveltejs/kit', () => ({
  error: (status: number, message: string) => { throw Object.assign(new Error(message), { status }) },
  redirect: (status: number, location: string) => { throw Object.assign(new Error('Redirect'), { location, status }) },
}))

const bootstrap: PanelBootstrapData = {
  actor: { id: 7, name: 'Ada' },
  direction: 'ltr',
  locale: 'en',
  manifest: {
    auth: null,
    branding: { favicon: null, logo: null, name: 'Admin' },
    databaseNotifications: null,
    default: true,
    direction: 'ltr',
    globalSearch: true,
    id: 'admin',
    locale: 'en',
    locales: { allowed: ['en', 'ar'], fallback: 'en' },
    navigation: [],
    navigationMode: 'sidebar',
    path: '/admin',
    sidebarCollapsible: true,
    slots: {},
    tenancy: null,
    theme: { colors: {}, darkMode: 'system', density: 'comfortable', fontFamily: null, width: 'full' },
    userMenu: [],
  },
  notifications: null,
  provider: 'session',
  tenancy: null,
}

const page: PanelResolvedPageData = {
  breadcrumbs: [{ label: 'Posts', path: '/admin/posts' }],
  data: { records: [{ id: 1, title: 'First' }] },
  heading: 'Posts',
  manifest: {
    actions: { footer: [], header: ['create'] },
    body: null,
    id: 'posts.list',
    navigation: null,
    pageType: 'list',
    path: '/admin/posts',
    renderer: null,
    schemaId: 'posts.table',
    widgets: { footer: [], header: [] },
  },
  schema: { components: [], id: 'posts.table', kind: 'schema' },
  subheading: null,
  title: 'Posts',
}

function event(method = 'GET', parameters: Readonly<Record<string, string>> = {}, requestUrl = 'https://panels.test/admin/posts?search=hello'): SvelteKitPanelEvent {
  const url = new URL(requestUrl)
  const envelope = {
    id: 'request-12345678',
    operation: parameters.operation ?? 'page-data',
    panelId: parameters.panelId ?? 'admin',
    payload: { title: 'New post' },
    protocolVersion: '1.0',
  }
  const body = new URLSearchParams({ _csrf: 'valid', request: JSON.stringify(envelope) }).toString()
  return {
    cookies: { get: () => undefined, set: () => undefined },
    locals: {},
    params: parameters,
    request: new Request(url, {
      method,
      ...(method === 'POST' ? { body, headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8', 'x-csrf-token': 'valid' } } : {}),
    }),
    url,
  }
}

function registry(operations: string[] = []): { readonly calls: string[], readonly value: SvelteKitPanelRegistry } {
  const calls: string[] = []
  const runtime: PanelRuntimeLike = {
    async bootstrap(panelIds) {
      calls.push(`bootstrap:${panelIds.join(',')}`)
      return [bootstrap]
    },
    async execute(panelId, operation, _signal, handler) {
      calls.push(`execute:${panelId}:${operation}`)
      return handler({ actor: { id: 7 }, guard: 'web', panelId, provider: 'session', signal: new AbortController().signal })
    },
  }
  return {
    calls,
    value: {
      operations: Object.fromEntries(operations.map(operation => [operation, ({ payload }: { readonly payload: unknown }) => ({ data: { ok: true, payload } })])),
      resolvePage: async input => {
        calls.push(`page:${input.path}`)
        return page
      },
      runtime,
    },
  }
}

beforeEach(() => {
  mocks.csrfCalls = 0
  mocks.contextCalls = 0
  mocks.failFlash = false
  mocks.failTake = false
  mocks.flashed.clear()
  mocks.guardNames.length = 0
})

describe('@holo-js/panels-sveltekit server adapter', () => {
  it('mounts generated public custom routes at their native SvelteKit URL', async () => {
    const configured = registry()
    const customPanel = definePanel('admin')
      .path('/admin')
      .routes(routes => routes.get('/posts', () => new Response('custom posts')))
      .compile()
    const value: SvelteKitPanelRegistry = { ...configured.value, panels: { admin: customPanel } }
    const { createGeneratedSvelteKitPanelRoute } = await import('../src/server')

    const response = await createGeneratedSvelteKitPanelRoute({ panelId: 'admin', registry: value }).GET(event())

    expect(response.status).toBe(200)
    await expect(response.text()).resolves.toBe('custom posts')
  })

  it('returns configured panel error notifications as client toast effects', async () => {
    const configured = registry()
    const errorPanel = definePanel('admin')
      .registerErrorNotification('Save failed', 'The post could not be saved.', 500)
      .compile()
    const value: SvelteKitPanelRegistry = {
      ...configured.value,
      operations: { 'form-submit': () => { throw new Error('database unavailable') } },
      panels: { admin: errorPanel },
    }
    const { createPanelOperationHandler } = await import('../src/server')
    const response = await createPanelOperationHandler({ panelIds: ['admin'], registry: value }).POST(event('POST', { operation: 'form-submit', panelId: 'admin' }))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      effects: [{ kind: 'toast', level: 'danger', message: 'The post could not be saved.', title: 'Save failed' }],
      ok: false,
    })
  })

  it('serves the configured tenant billing route before subscription-protected page execution', async () => {
    const configured = registry()
    const routeAction = vi.fn(() => new Response(null, { headers: { location: 'https://billing.example.test/session' }, status: 303 }))
    const billingBootstrap: PanelBootstrapData = {
      ...bootstrap,
      manifest: { ...bootstrap.manifest, tenancy: { billing: { path: '/admin/subscription' }, enabled: true, requiresSubscription: true } },
    }
    Reflect.set(configured.value, 'panels', {
      admin: { server: { tenancy: { billing: { getRouteAction: () => routeAction, getSubscribedMiddleware: () => () => false } } } },
    })
    Reflect.set(configured.value.runtime, 'bootstrap', async () => [billingBootstrap])
    const { createPanelPageLoad } = await import('../src/server')
    const load = createPanelPageLoad({ panelId: 'admin', registry: configured.value })

    await expect(load(event('GET', { path: 'subscription' }))).rejects.toMatchObject({
      location: 'https://billing.example.test/session',
      status: 303,
    })
    expect(routeAction).toHaveBeenCalledOnce()
    expect(configured.calls).toEqual(['execute:admin:bootstrap'])
  })

  it('rejects a multibyte operation envelope above 4 MiB without flashing success effects', async () => {
    const configured = registry()
    const effects = [
      { kind: 'redirect' as const, url: '/admin' },
      { kind: 'toast' as const, level: 'success' as const, message: 'Oversized success' },
    ]
    const emptyEnvelope = { data: { text: '' }, effects, id: 'request-12345678', ok: true, protocolVersion: '1.0' }
    const remainingBytes = 4_194_305 - new TextEncoder().encode(JSON.stringify(emptyEnvelope)).byteLength
    const text = '😀'.repeat(Math.floor(remainingBytes / 4)) + 'a'.repeat(remainingBytes % 4)
    expect(new TextEncoder().encode(JSON.stringify({ ...emptyEnvelope, data: { text } })).byteLength).toBe(4_194_305)
    const registryWithOversizedAction: SvelteKitPanelRegistry = {
      ...configured.value,
      operations: {
        action: () => ({
          data: { text },
          effects,
        }),
      },
    }
    const { createPanelOperationHandler } = await import('../src/server')
    const handler = createPanelOperationHandler({ panelIds: ['admin'], registry: registryWithOversizedAction })
    const response = await handler.POST(event('POST', { operation: 'action', panelId: 'admin' }))

    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.json()).resolves.toEqual({
      effects: [],
      error: {
        category: 'internal',
        code: 'response_too_large',
        message: 'Panel operation response exceeded the server limit.',
        retryable: false,
      },
      id: 'request-12345678',
      ok: false,
      protocolVersion: '1.0',
    })
    expect(mocks.flashed.size).toBe(0)
  })

  it('loads an optional catch-all page inside request context and panel authorization', async () => {
    const configured = registry()
    const value: SvelteKitPanelRegistry = {
      ...configured.value,
      resolveWidgets: async input => {
        configured.calls.push(`widgets:${input.page.manifest.id}`)
        return { footer: [], header: [] }
      },
    }
    const { createPanelPageLoad } = await import('../src/server')
    const load = createPanelPageLoad({ panelId: 'admin', registry: value })
    const result = await load(event('GET', { path: 'posts' }))

    expect(result).toEqual({ effects: [], panel: bootstrap, page, widgets: { footer: [], header: [] } })
    expect(configured.calls).toEqual(['bootstrap:admin', 'execute:admin:page-data', 'page:/admin/posts', 'widgets:posts.list'])
    expect(mocks.contextCalls).toBe(1)
  })

  it('derives the unauthenticated redirect from the compiled panel definition', async () => {
    const configured = registry()
    const configuredPanel = definePanel('admin').path('/control').login().loginRouteSlug('sign-in').compile()
    configured.value.runtime.bootstrap = async () => {
      throw Object.assign(new Error('Authentication is required'), { code: 'unauthenticated' })
    }
    const value: SvelteKitPanelRegistry = { ...configured.value, panels: { admin: configuredPanel } }
    const { createPanelPageLoad } = await import('../src/server')
    const requestEvent = event('GET', { path: 'posts' }, 'https://panels.test/control/posts?search=hello')

    await expect(createPanelPageLoad({ panelId: 'admin', registry: value })(requestEvent)).rejects.toMatchObject({
      location: '/control/sign-in?next=%2Fcontrol%2Fposts%3Fsearch%3Dhello',
      status: 303,
    })
  })

  it('supports separate fixed registries for multiple panel route shells', async () => {
    const admin = registry()
    const staff = registry()
    const staffBootstrap = { ...bootstrap, manifest: { ...bootstrap.manifest, id: 'staff', path: '/staff' } }
    staff.value.runtime.bootstrap = async panelIds => {
      staff.calls.push(`bootstrap:${panelIds.join(',')}`)
      return [staffBootstrap]
    }
    const { createPanelPageLoad } = await import('../src/server')

    await createPanelPageLoad({ panelId: 'admin', registry: admin.value })(event('GET', { path: 'posts' }))
    await createPanelPageLoad({ panelId: 'staff', registry: staff.value })(event('GET', { path: 'posts' }))

    expect(admin.calls[0]).toBe('bootstrap:admin')
    expect(staff.calls[0]).toBe('bootstrap:staff')
  })

  it('enforces CSRF and fixed panel and operation allow-lists for mutations', async () => {
    const configured = registry(['action'])
    const { createPanelOperationHandler } = await import('../src/server')
    const handler = createPanelOperationHandler({ panelIds: ['admin'], registry: configured.value })
    const denied = event('POST', { operation: 'action', panelId: 'admin' })
    denied.request.headers.delete('x-csrf-token')

    const deniedResponse = await handler.POST(denied)
    expect(deniedResponse.status).toBe(419)
    await expect(deniedResponse.json()).resolves.toMatchObject({ ok: false, protocolVersion: '1.0' })
    const response = await handler.POST(event('POST', { operation: 'action', panelId: 'admin' }))
    await expect(response.json()).resolves.toEqual({
      data: { ok: true, payload: { title: 'New post' } },
      direction: 'ltr',
      effects: [],
      id: 'request-12345678',
      locale: 'en',
      ok: true,
      protocolVersion: '1.0',
    })
    await expect(handler.POST(event('POST', { operation: 'action', panelId: 'other' })).then(response => response.status)).resolves.toBe(404)
    await expect(handler.POST(event('POST', { operation: 'arbitrary', panelId: 'admin' })).then(response => response.status)).resolves.toBe(404)
    expect(configured.calls).toContain('execute:admin:action')
    expect(mocks.csrfCalls).toBe(4)
  })

  it('rejects mutation operations over GET and missing prepared registries', async () => {
    const configured = registry(['action'])
    const { createPanelOperationHandler, createPanelPageLoad } = await import('../src/server')
    const handler = createPanelOperationHandler({ panelIds: ['admin'], registry: configured.value })

    const methodResponse = await handler.GET(event('GET', { operation: 'action', panelId: 'admin' }))
    expect(methodResponse.status).toBe(405)
    await expect(methodResponse.json()).resolves.toMatchObject({ ok: false, protocolVersion: '1.0' })
    await expect(createPanelPageLoad({ panelId: 'admin' })(event('GET', { path: 'posts' }))).rejects.toThrow('Run `holo prepare`')
  })

  it('rejects route/envelope mismatches and malformed protocol envelopes', async () => {
    const configured = registry(['action'])
    const { createPanelOperationHandler } = await import('../src/server')
    const handler = createPanelOperationHandler({ panelIds: ['admin'], registry: configured.value })
    const mismatched = event('POST', { operation: 'action', panelId: 'admin' })
    const mismatchBody = new URLSearchParams({
      request: JSON.stringify({ id: 'request-mismatch', operation: 'table-data', panelId: 'admin', payload: {}, protocolVersion: '1.0' }),
    }).toString()
    const mismatchEvent = { ...mismatched, request: new Request(mismatched.url, { body: mismatchBody, headers: mismatched.request.headers, method: 'POST' }) }
    const mismatchResponse = await handler.POST(mismatchEvent)
    expect(mismatchResponse.status).toBe(400)
    await expect(mismatchResponse.json()).resolves.toMatchObject({ id: 'request-mismatch', ok: false, error: { category: 'validation' } })

    const invalid = event('POST', { operation: 'action', panelId: 'admin' })
    const invalidEvent = { ...invalid, request: new Request(invalid.url, { body: new URLSearchParams({ request: '{' }), headers: invalid.request.headers, method: 'POST' }) }
    const invalidResponse = await handler.POST(invalidEvent)
    expect(invalidResponse.status).toBe(400)
    await expect(invalidResponse.json()).resolves.toMatchObject({ ok: false, error: { code: 'http_400' } })
    expect(configured.calls).not.toContain('execute:admin:action')
  })

  it('runs CSRF after raw bounding but before envelope decoding and authentication', async () => {
    const configured = registry(['action'])
    const { createPanelOperationHandler } = await import('../src/server')
    const handler = createPanelOperationHandler({ panelIds: ['admin'], registry: configured.value })
    const base = event('POST', { operation: 'action', panelId: 'admin' })
    const malformed = new Request(base.url, {
      body: new URLSearchParams({ request: '{' }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    })

    const response = await handler.POST({ ...base, request: malformed })

    expect(response.status).toBe(419)
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: { code: 'http_419' } })
    expect(mocks.csrfCalls).toBe(1)
    expect(configured.calls).toEqual([])
  })

  it('bounds the complete raw request before CSRF or form decoding without trusting content length', async () => {
    const configured = registry(['action'])
    const { createPanelOperationHandler } = await import('../src/server')
    const handler = createPanelOperationHandler({ panelIds: ['admin'], registry: configured.value })
    const base = event('POST', { operation: 'action', panelId: 'admin' })
    const oversizedBody = new URLSearchParams({
      ignored: 'x'.repeat(1024 * 1024),
      request: JSON.stringify({ id: 'oversized-request', operation: 'action', panelId: 'admin', payload: {}, protocolVersion: '1.0' }),
    }).toString()
    const noLengthRequest = new Request(base.url, { body: oversizedBody, headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' }, method: 'POST' })
    noLengthRequest.headers.delete('content-length')
    const noLengthResponse = await handler.POST({ ...base, request: noLengthRequest })
    expect(noLengthResponse.status).toBe(413)
    await expect(noLengthResponse.json()).resolves.toMatchObject({ ok: false, error: { code: 'http_413' } })

    const declaredRequest = new Request(base.url, { body: 'request={}', headers: { 'content-length': String(1024 * 1024 + 1), 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' }, method: 'POST' })
    const declaredResponse = await handler.POST({ ...base, request: declaredRequest })
    expect(declaredResponse.status).toBe(413)
    expect(mocks.csrfCalls).toBe(0)
    expect(configured.calls).not.toContain('execute:admin:action')
  })

  it('runs the example hook before endpoint CSRF so chunked panel bodies are bounded first', async () => {
    const configured = registry(['action'])
    const { createPanelOperationHandler } = await import('../src/server')
    const { handle } = await import('../../../apps/example-sveltekit/src/hooks.server')
    const handler = createPanelOperationHandler({ panelIds: ['admin'], registry: configured.value })
    const base = event('POST', { operation: 'action', panelId: 'admin' })
    const operationUrl = new URL('https://panels.test/holo/panels/admin/action')
    const request = new Request(operationUrl, {
      body: new URLSearchParams({ ignored: 'x'.repeat(1024 * 1024), request: '{}' }).toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' },
      method: 'POST',
    })
    request.headers.delete('content-length')
    const requestEvent: RequestEvent & SvelteKitPanelEvent = {
      cookies: {
        delete: () => undefined,
        get: () => undefined,
        getAll: () => [],
        serialize: () => '',
        set: () => undefined,
      },
      fetch,
      getClientAddress: () => '127.0.0.1',
      isDataRequest: false,
      isRemoteRequest: false,
      isSubRequest: false,
      locals: {},
      params: { operation: 'action', panelId: 'admin' },
      platform: undefined,
      request,
      route: { id: '/holo/panels/[panelId]/[operation]' },
      setHeaders: () => undefined,
      tracing: {
        current: {} as RequestEvent['tracing']['current'],
        enabled: false,
        root: {} as RequestEvent['tracing']['root'],
      },
      url: operationUrl,
    }
    const response = await handle({ event: requestEvent, resolve: () => handler.POST(requestEvent) })
    expect(response.status).toBe(413)
    expect(mocks.csrfCalls).toBe(0)
  })

  it('normalizes policy failures without exposing server messages', async () => {
    const configured = registry(['action'])
    configured.value.runtime.execute = async () => { throw Object.assign(new Error('secret policy implementation'), { code: 'access-denied' }) }
    const { createPanelOperationHandler } = await import('../src/server')
    const handler = createPanelOperationHandler({ panelIds: ['admin'], registry: configured.value })
    const response = await handler.POST(event('POST', { operation: 'action', panelId: 'admin' }))
    const payload = JSON.stringify(await response.json())

    expect(response.status).toBe(403)
    expect(payload).toContain('not authorized')
    expect(payload).not.toContain('secret policy implementation')
  })

  it('preserves validated action failure effects without trusting arbitrary errors', async () => {
    const configured = registry(['action'])
    const failureEffect = { kind: 'toast' as const, level: 'danger' as const, message: 'The action failed safely' }
    configured.value.runtime.execute = async () => {
      throw new ActionExecutionError('failed', 'The action could not be completed', [failureEffect])
    }
    const { createPanelOperationHandler } = await import('../src/server')
    const handler = createPanelOperationHandler({ panelIds: ['admin'], registry: configured.value })
    const response = await handler.POST(event('POST', { operation: 'action', panelId: 'admin' }))

    await expect(response.json()).resolves.toMatchObject({ direction: 'ltr', effects: [failureEffect], locale: 'en', ok: false })

    configured.value.runtime.execute = async () => {
      throw Object.assign(new Error('untrusted'), { effects: [failureEffect] })
    }
    const untrusted = await handler.POST(event('POST', { operation: 'action', panelId: 'admin' }))
    await expect(untrusted.json()).resolves.toMatchObject({ effects: [], ok: false })
  })

  it('hands redirect toasts through the authorized guard once', async () => {
    const toast = { kind: 'toast' as const, level: 'success' as const, message: 'Article saved' }
    const effects = [{ kind: 'redirect' as const, url: '/admin/posts' }, toast]
    const configured = registry()
    const value: SvelteKitPanelRegistry = {
      ...configured.value,
      operations: { 'form-submit': () => ({ data: { saved: true }, effects }) },
    }
    const { createPanelOperationHandler, createPanelPageLoad } = await import('../src/server')
    const handler = createPanelOperationHandler({ panelIds: ['admin'], registry: value })

    const mutation = await handler.POST(event('POST', { operation: 'form-submit', panelId: 'admin' }))
    await expect(mutation.json()).resolves.toMatchObject({ effects, ok: true })
    expect(mocks.flashed.get('web:panels.effects.admin')).toEqual([toast])

    const load = createPanelPageLoad({ panelId: 'admin', registry: value })
    await expect(load(event('GET', { path: 'posts' }))).resolves.toMatchObject({ effects: [toast] })
    expect(mocks.flashed.has('web:panels.effects.admin')).toBe(false)
    await expect(load(event('GET', { path: 'posts' }))).resolves.toMatchObject({ effects: [] })
  })

  it('hands validated failure redirect toasts through the authorized guard', async () => {
    const toast = { kind: 'toast' as const, level: 'danger' as const, message: 'The action failed safely' }
    const effects = [{ kind: 'redirect' as const, url: '/admin/posts' }, toast]
    const configured = registry()
    const value: SvelteKitPanelRegistry = {
      ...configured.value,
      operations: {
        action: () => { throw new ActionExecutionError('failed', 'The action could not be completed', effects) },
      },
    }
    const { createPanelOperationHandler } = await import('../src/server')
    const response = await createPanelOperationHandler({ panelIds: ['admin'], registry: value }).POST(event('POST', { operation: 'action', panelId: 'admin' }))

    await expect(response.json()).resolves.toMatchObject({ effects, ok: false })
    expect(mocks.flashed.get('web:panels.effects.admin')).toEqual([toast])
  })

  it('rejects malformed and non-toast flash values without crossing panel or guard keys', async () => {
    const configured = registry()
    const { createPanelPageLoad } = await import('../src/server')
    const load = createPanelPageLoad({ panelId: 'admin', registry: configured.value })
    const staffToast = { kind: 'toast' as const, level: 'info' as const, message: 'Staff only' }
    mocks.flashed.set('web:panels.effects.admin', [{ kind: 'toast', level: 'success' }])
    mocks.flashed.set('web:panels.effects.staff', [staffToast])
    mocks.flashed.set('other:panels.effects.admin', [staffToast])

    await expect(load(event('GET', { path: 'posts' }))).resolves.toMatchObject({ effects: [] })
    expect(mocks.flashed.get('web:panels.effects.staff')).toEqual([staffToast])
    expect(mocks.flashed.get('other:panels.effects.admin')).toEqual([staffToast])

    mocks.flashed.set('web:panels.effects.admin', [{ kind: 'redirect', url: '/admin' }])
    await expect(load(event('GET', { path: 'posts' }))).resolves.toMatchObject({ effects: [] })
    expect(mocks.guardNames.every(name => name === 'web')).toBe(true)
  })

  it('preserves committed operations and page loads when flash or take fails', async () => {
    const toast = { kind: 'toast' as const, level: 'success' as const, message: 'Saved' }
    const effects = [toast, { kind: 'redirect' as const, url: '/admin' }]
    const configured = registry()
    const value: SvelteKitPanelRegistry = {
      ...configured.value,
      operations: { action: () => ({ data: { saved: true }, effects }) },
    }
    const { createPanelOperationHandler, createPanelPageLoad } = await import('../src/server')
    mocks.failFlash = true
    const response = await createPanelOperationHandler({ panelIds: ['admin'], registry: value }).POST(event('POST', { operation: 'action', panelId: 'admin' }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ data: { saved: true }, direction: 'ltr', effects, locale: 'en', ok: true })

    mocks.failTake = true
    await expect(createPanelPageLoad({ panelId: 'admin', registry: value })(event('GET', { path: 'posts' }))).resolves.toMatchObject({ effects: [], page })
  })
})
