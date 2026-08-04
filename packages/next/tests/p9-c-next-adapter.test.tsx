import { act } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRequestEnvelope, definePage, definePanel, TRANSPORT_REQUEST_FIELD, type HoloAuth, type JsonObject } from '@holo-js/panels-core'
import { NextPanelClient } from '../src/panel-client'
import { NextPanelResourcePage } from '../src/resource-page'
import { createPanelOperationRoute } from '../src/operation'
import { nextPanelsRuntimeInternals, resolveNextPanelPage, resolveNextPanelPath } from '../src/runtime'
import type { NextPanelsRuntime } from '../src/contracts'
import { createNextPanelsAcceptanceRuntime, nextPanelAcceptanceFixture } from '../../../apps/example-next/tests/p9-panel-acceptance-next'

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)

vi.mock('@holo-js/security/next/server', () => ({
  csrfProtection: () => (request: Request) => request.headers.get('x-csrf-token') === 'valid'
    ? undefined
    : new Response('CSRF token mismatch.', { status: 419 }),
}))

class Actor {
  declare readonly id: number
}

const panel = definePanel('admin', Actor)
  .path('/admin')
  .presentActor(actor => ({ id: actor.id }))
  .navigation([{ badge: null, group: null, icon: null, id: 'posts', label: 'Posts', parent: null, path: 'posts', sort: 1 }])
  .compile()

const reportsPanel = definePanel('reports', Actor)
  .path('/reports')
  .presentActor(currentActor => ({ id: currentActor.id }))
  .compile()

const posts = definePage('posts', { actor: Actor, load: () => ({ records: [{ id: 1, title: 'First post' }] }) })
  .path('/admin/posts')
  .title('Posts')
  .heading('Manage posts')
  .compile()

const actor = { id: 7 }
const auth: HoloAuth<object> = {
  guard: () => ({ provider: async () => 'session', user: async () => actor }),
}

function runtime(overrides: Partial<NextPanelsRuntime> = {}): NextPanelsRuntime {
  return {
    auth,
    registry: {
      'admin:panel:admin': async () => panel,
      'admin:page:posts': async () => posts,
      'admin:resource:posts': vi.fn(async () => { throw new Error('Resource modules stay lazy until an operation needs them') }),
    },
    ...overrides,
  }
}

function operationRequest(panelId: string, operation: string, payload: JsonObject = {}, csrf = 'valid'): Request {
  const envelope = createRequestEnvelope({ id: 'request-123', operation, panelId, payload })
  const body = new URLSearchParams({ [TRANSPORT_REQUEST_FIELD]: JSON.stringify(envelope), _token: csrf })
  return new Request(`https://example.test/_holo/panels/${panelId}/${operation}`, {
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': csrf },
    method: 'POST',
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Next panel adapter', () => {
  it('resolves safe optional catch-all routes, authenticates, and leaves resources lazy', async () => {
    const configured = runtime()
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), configured)
    expect(payload.bootstrap.actor).toEqual({ id: 7 })
    expect(payload.page.data).toEqual({ records: [{ id: 1, title: 'First post' }] })
    expect(configured.registry['admin:resource:posts']).not.toHaveBeenCalled()
    await expect(resolveNextPanelPage('admin', ['..'], new Request('https://example.test/admin'), configured)).rejects.toThrow('unsafe segment')
  })

  it('derives fixed routes from the compiled panel path when the ID differs', async () => {
    const controlPanel = definePanel('backoffice', Actor).path('/control').presentActor(currentActor => ({ id: currentActor.id })).compile()
    const controlPage = definePage('control-posts', { actor: Actor, load: () => ({ ready: true }) }).path('/control/posts').compile()
    const configured = runtime({ registry: { 'backoffice:page:control-posts': async () => controlPage, 'backoffice:panel:backoffice': async () => controlPanel } })
    expect(await resolveNextPanelPath('backoffice', configured)).toBe('/control')
    const payload = await resolveNextPanelPage('backoffice', ['posts'], new Request('https://example.test/control/posts'), configured)
    expect(payload.path).toBe('/control/posts')
  })

  it('renders deterministic SSR and hydrates the JSON-only client boundary', async () => {
    const payload = await resolveNextPanelPage('admin', ['posts'], new Request('https://example.test/admin/posts'), runtime())
    const markup = renderToString(<NextPanelClient payload={payload} />)
    expect(markup).toContain('Manage posts')
    expect(markup).toContain('aria-current="page"')
    document.body.innerHTML = '<div id="root"></div>'
    const container = document.querySelector('#root')!
    container.innerHTML = markup
    const errors: unknown[] = []
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container as unknown as Element, <NextPanelClient payload={payload} />, { onRecoverableError: error => errors.push(error) })
      await Promise.resolve()
    })
    expect(errors).toEqual([])
    await act(async () => root?.unmount())
  })

  it('enforces panel allow-lists, CSRF, authorization, and safe mutation responses', async () => {
    const execute = vi.fn(async (input: { readonly request: Request }) => {
      const replayed = await input.request.clone().formData()
      expect(replayed.get(TRANSPORT_REQUEST_FIELD)).toContain('request-123')
      return { data: { saved: true }, effects: [{ kind: 'redirect' as const, url: '/admin/posts' }] }
    })
    const route = createPanelOperationRoute({ panelIds: ['admin', 'reports'], runtime: runtime({ execute }) })
    const context = { params: Promise.resolve({ operation: 'form-submit', panelId: 'admin' }) }
    const denied = await route.POST(operationRequest('admin', 'form-submit', {}, 'invalid'), context)
    expect(denied.status).toBe(419)
    const accepted = await route.POST(operationRequest('admin', 'form-submit', { title: 'Post' }), context)
    expect(accepted.status).toBe(200)
    await expect(accepted.json()).resolves.toMatchObject({ effects: [{ kind: 'redirect', url: '/admin/posts' }], id: 'request-123', ok: true, protocolVersion: '1.0' })
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ operation: 'form-submit', panelId: 'admin', payload: { title: 'Post' } }))
    const unknown = await route.POST(operationRequest('other', 'bootstrap'), { params: Promise.resolve({ operation: 'bootstrap', panelId: 'other' }) })
    expect(unknown.status).toBe(404)
  })

  it('loads only exact generated registry keys and rejects ambiguous route setup', async () => {
    const configured = runtime()
    expect(nextPanelsRuntimeInternals.registryKeys(configured, 'admin', 'page')).toEqual(['admin:page:posts'])
    expect(() => createPanelOperationRoute({ panelIds: ['admin', 'admin'], runtime: configured })).toThrow('unique stable panel IDs')
    const route = createPanelOperationRoute({ panelIds: ['admin'], runtime: configured })
    const bootstrap = await route.POST(operationRequest('admin', 'bootstrap'), { params: Promise.resolve({ operation: 'bootstrap', panelId: 'admin' }) })
    expect(bootstrap.status).toBe(200)
    await expect(bootstrap.json()).resolves.toMatchObject({ data: { actor: { id: 7 }, manifest: { id: 'admin' } }, id: 'request-123', ok: true })
  })

  it('isolates multiple panels behind the generated route allow-list', async () => {
    const configured = runtime({
      registry: {
        'admin:panel:admin': async () => panel,
        'admin:page:posts': async () => posts,
        'reports:panel:reports': async () => reportsPanel,
      },
    })
    const route = createPanelOperationRoute({ panelIds: ['admin', 'reports'], runtime: configured })
    const result = await route.POST(operationRequest('reports', 'bootstrap'), {
      params: Promise.resolve({ operation: 'bootstrap', panelId: 'reports' }),
    })
    await expect(result.json()).resolves.toMatchObject({ data: { manifest: { id: 'reports' } }, ok: true })
  })

  it('rejects mismatched, malformed, and oversized transport envelopes with safe protocol errors', async () => {
    const route = createPanelOperationRoute({ panelIds: ['admin'], runtime: runtime() })
    const context = { params: Promise.resolve({ operation: 'bootstrap', panelId: 'admin' }) }
    const mismatch = await route.POST(operationRequest('admin', 'page-data'), context)
    await expect(mismatch.json()).resolves.toMatchObject({
      error: { category: 'validation', message: 'The submitted data is invalid.' },
      id: 'request-123',
      ok: false,
      protocolVersion: '1.0',
    })
    const malformed = await route.POST(new Request('https://example.test', {
      body: new URLSearchParams({ [TRANSPORT_REQUEST_FIELD]: '{' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' },
      method: 'POST',
    }), context)
    await expect(malformed.json()).resolves.toMatchObject({ error: { category: 'validation' }, id: 'invalid-request', ok: false })
    const rejectedBeforeDecode = await route.POST(new Request('https://example.test', {
      body: new URLSearchParams({ [TRANSPORT_REQUEST_FIELD]: '{' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'invalid' },
      method: 'POST',
    }), context)
    expect(rejectedBeforeDecode.status).toBe(419)
    await expect(rejectedBeforeDecode.json()).resolves.toMatchObject({ error: { category: 'authorization' }, id: 'invalid-request', ok: false })
    const oversizedRequest = new Request('https://example.test', {
      body: new URLSearchParams({ [TRANSPORT_REQUEST_FIELD]: 'x' }),
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' },
      method: 'POST',
    })
    const getHeader = oversizedRequest.headers.get.bind(oversizedRequest.headers)
    vi.spyOn(oversizedRequest.headers, 'get').mockImplementation(name => name.toLowerCase() === 'content-length' ? '1048577' : getHeader(name))
    const oversized = await route.POST(oversizedRequest, context)
    expect(oversized.status).toBe(413)
    await expect(oversized.json()).resolves.toMatchObject({ error: { category: 'internal' }, ok: false })
    const unrelatedBody = new URLSearchParams({ padding: 'x'.repeat(1_048_576), [TRANSPORT_REQUEST_FIELD]: '{}' })
    const chunked = new Request('https://example.test', {
      body: unrelatedBody,
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-csrf-token': 'valid' },
      method: 'POST',
    })
    expect(chunked.headers.get('content-length')).toBeNull()
    const chunkedResult = await route.POST(chunked, context)
    expect(chunkedResult.status).toBe(413)
  })

  it('exposes the example Post CRUD routes, policy boundaries, and delete action', async () => {
    const pages = nextPanelAcceptanceFixture.pages
    expect(pages.map(page => [page.manifest.pageType, page.manifest.path])).toEqual([
      ['list', '/admin/posts'],
      ['create', '/admin/posts/create'],
      ['view', '/admin/posts/:record'],
      ['edit', '/admin/posts/:record/edit'],
    ])
    expect(pages[2]?.manifest.actions.footer).toContain('delete-post')
    const context = { actor: { id: 2, role: 'viewer' }, locale: 'en', panelId: 'admin', parameters: {}, services: {}, signal: new AbortController().signal, tenant: 'tenant-acme' }
    expect(await pages[0]?.server.authorize(context)).toBe(false)
    expect(await pages[0]?.server.authorize({ ...context, actor: { id: 1, role: 'admin' } })).toBe(true)
  })

  it('runs the Post List/Create/Edit/View/Delete UI journey with filters, reactivity, dependencies, and safe errors', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const mutations: { readonly intent: string, readonly recordId: number | string | null, readonly values: Readonly<Record<string, string>> }[] = []
    let fail = false
    const adminAuth: HoloAuth<object> = {
      guard: () => ({ provider: async () => 'session', user: async () => ({ id: 7, role: 'admin' }) }),
    }
    const exampleRuntime = await createNextPanelsAcceptanceRuntime({
      auth: adminAuth,
      async mutatePost(mutation: { readonly intent: string, readonly recordId: number | string | null, readonly values: Readonly<Record<string, string>> }) {
        if (fail) throw new Error('Policy denied this operation.')
        mutations.push(mutation)
      },
      resolveServices: async () => ({}),
      resolveTenant: async () => 'tenant-a',
    })
    const route = createPanelOperationRoute({ panelIds: ['admin'], runtime: exampleRuntime })
    const deniedMutation = vi.fn(async () => undefined)
    const deniedRuntime = await createNextPanelsAcceptanceRuntime({
      auth: { guard: () => ({ provider: async () => 'session', user: async () => ({ id: 8, role: 'viewer' }) }) },
      mutatePost: deniedMutation,
      resolveServices: async () => ({}),
      resolveTenant: async () => 'tenant-a',
    })
    const deniedRoute = createPanelOperationRoute({ panelIds: ['admin'], runtime: deniedRuntime })
    const deniedResponse = await deniedRoute.POST(operationRequest('admin', 'action', { intent: 'delete', recordId: 1, resourceId: 'posts' }), { params: Promise.resolve({ operation: 'action', panelId: 'admin' }) })
    expect(deniedResponse.status).toBe(403)
    expect(deniedMutation).not.toHaveBeenCalled()
    document.cookie = 'XSRF-TOKEN=valid; Path=/'
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const match = /\/_holo\/panels\/([^/]+)\/([^/]+)$/u.exec(url)
      if (!match?.[1] || !match[2]) return new Response(null, { status: 404 })
      const headers = new Headers(init?.headers)
      headers.set('x-csrf-token', 'valid')
      const request = new Request(new URL(url, 'https://example.test'), { ...init, headers })
      return route.POST(request, { params: Promise.resolve({ operation: match[2], panelId: match[1] }) })
    }))
    const properties = (index: number): JsonObject => {
      const body = nextPanelAcceptanceFixture.pages[index]?.manifest.body
      if (body?.component !== 'resource-page') throw new Error(`Page ${index} is missing its resource manifest.`)
      return body.properties
    }
    const root = createRoot(container as unknown as Element)
    const input = (selector: string): HTMLInputElement => container.querySelector(selector) as unknown as HTMLInputElement
    const select = (selector: string): HTMLSelectElement => container.querySelector(selector) as unknown as HTMLSelectElement
    const click = async (label: string): Promise<void> => act(async () => {
      const button = [...container.querySelectorAll('button')].find(candidate => candidate.textContent === label)
      if (!button) throw new Error(`Missing ${label} button`)
      ;(button as unknown as HTMLButtonElement).click()
      await Promise.resolve()
    })
    const change = async (element: HTMLInputElement | HTMLSelectElement, value: string): Promise<void> => act(async () => {
      const prototype = element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value)
      element.dispatchEvent(new Event('change', { bubbles: true }))
      element.dispatchEvent(new Event('input', { bubbles: true }))
      await Promise.resolve()
    })
    const choose = async (value: string): Promise<void> => act(async () => {
      const label = [...container.querySelectorAll('label')].find(candidate => candidate.textContent?.trim() === value)
      const radio = label?.querySelector('input[type="radio"]')
      if (!radio) throw new Error(`Missing ${value} option`)
      ;(radio as unknown as HTMLInputElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })
    await act(async () => root.render(<NextPanelResourcePage data={{ records: [{ category: 'News', city: 'Cairo', id: 1, slug: 'first-post', title: 'First post' }, { category: 'Guides', city: 'Giza', id: 2, slug: 'city-guide', title: 'City guide' }] }} panelId="admin" panelPath="/admin" properties={properties(0)} />))
    await change(input('input[type="search"]'), 'guide')
    expect(container.textContent).toContain('City guide')
    expect(container.textContent).not.toContain('First post')
    await click('Delete')
    expect(container.textContent).not.toContain('City guide')
    await act(async () => root.render(<NextPanelResourcePage data={{}} panelId="admin" panelPath="/admin" properties={properties(1)} />))
    await click('Save post')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('required')
    await change(input('[data-field-path="title"] input'), 'My New Post')
    expect(input('[data-field-path="slug"] input').value).toBe('my-new-post')
    await choose('Guides')
    expect([...select('[data-field-path="city"] select').options].map(option => option.value)).toContain('Giza')
    await change(select('[data-field-path="city"] select'), 'Giza')
    await click('Save post')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Post saved.')
    await act(async () => root.render(<NextPanelResourcePage data={{ record: { category: 'News', city: 'Alexandria', id: 1, slug: 'first-post', title: 'First post' } }} panelId="admin" panelPath="/admin" properties={properties(3)} />))
    expect(input('[data-field-path="title"] input').value).toBe('First post')
    await change(input('[data-field-path="title"] input'), 'Edited post')
    expect(input('[data-field-path="slug"] input').value).toBe('edited-post')
    await click('Save post')
    fail = true
    await act(async () => root.render(<NextPanelResourcePage data={{ record: { category: 'News', city: 'Cairo', id: 1, slug: 'first-post', title: 'First post' } }} panelId="admin" panelPath="/admin" properties={properties(2)} />))
    await click('Delete post')
    await click('Confirm')
    await click('Run action')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('The operation could not be completed.')
    expect(mutations.map(mutation => mutation.intent)).toEqual(['delete', 'create', 'edit'])
    await act(async () => root.unmount())
  })
})
