import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ClientNotificationInboxStore, ClientToastStore } from '@holo-js/panels-client'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component, flushSync, mount, unmount } from 'svelte'
import type { render } from 'svelte/server'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { registerSvelteNotificationRenderer, SvelteNotificationInbox, SvelteToastViewport, type SvelteCustomNotificationProps, type SvelteNotificationInboxProps, type SvelteToastViewportProps } from '../src'
import { SvelteComponentRegistry } from '../src/registry'
import ClientFixture from './P13NotificationFixture.svelte'

interface FixtureProps {
  readonly inbox?: SvelteNotificationInboxProps
  readonly toasts?: SvelteToastViewportProps
}

const presentation = {
  actions: [{ id: 'open', kind: 'navigate', label: 'Open', url: '/reports' }],
  body: 'Quarterly report is ready',
  closeable: true,
  color: 'brand-accent',
  duration: null,
  icon: 'check',
  id: 'notice-1',
  persistent: true,
  status: 'success' as const,
  title: 'Report ready',
}
let server: ViteDevServer
let ServerFixture: Component<FixtureProps>
let ServerCustom: Component<SvelteCustomNotificationProps>
let renderServer: typeof render
let flushClient: typeof flushSync
let mountClient: typeof mount
let unmountClient: typeof unmount
const mounted: Array<{ readonly component: Record<PropertyKey, unknown>, readonly container: HTMLDivElement }> = []

beforeAll(async () => {
  server = await createServer({ appType: 'custom', cacheDir: `/tmp/holo-panels-svelte-p13-${process.pid}`, logLevel: 'silent', plugins: [svelte()], root: process.cwd(), server: { middlewareMode: true } })
  ServerFixture = (await server.ssrLoadModule('/tests/P13NotificationFixture.svelte')).default as Component<FixtureProps>
  ServerCustom = (await server.ssrLoadModule('/tests/P13CustomNotification.svelte')).default as Component<SvelteCustomNotificationProps>
  renderServer = (await server.ssrLoadModule('svelte/server')).render as typeof render
  const packagePath = createRequire(import.meta.url).resolve('svelte/package.json')
  const client = await import(pathToFileURL(resolve(dirname(packagePath), 'src/index-client.js')).href)
  flushClient = client.flushSync as typeof flushSync
  mountClient = client.mount as typeof mount
  unmountClient = client.unmount as typeof unmount
})

afterAll(async () => server?.close())

afterEach(async () => {
  for (const item of mounted.splice(0)) {
    await unmountClient(item.component)
    item.container.remove()
  }
})

describe('P13 Svelte notification renderers', () => {
  it('renders custom notification and icon colors through Sonner', async () => {
    const store = new ClientToastStore()
    store.push({ ...presentation, color: '#16a34a', iconColor: '#b42318' })
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(ClientFixture, { props: { toasts: { store } }, target: container })
    mounted.push({ component, container })
    flushClient()
    await vi.waitFor(() => expect(container.querySelector('.hp-notification-toast')).not.toBeNull())
    const colored = container.querySelector<HTMLElement>('.hp-notification-toast')!
    expect(getComputedStyle(colored).borderInlineStartColor).toBe('#16a34a')
    expect(getComputedStyle(colored.querySelector<HTMLElement>('[data-slot="notification-icon"]')!).color).toBe('#b42318')
    store.dispose()
  })

  it('distinguishes loading and failed inbox requests from an empty inbox', async () => {
    let fail: (error: Error) => void = () => undefined
    let recovered = false
    const store = new ClientNotificationInboxStore({ polling: false, transport: {
      delete: async () => 0,
      list: (page, pageSize) => recovered
        ? Promise.resolve({ items: [], page, pageSize, total: 0, unread: 0 })
        : new Promise((_resolve, reject) => { fail = reject }),
      markRead: async () => 0,
      markUnread: async () => 0,
    } })
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(ClientFixture, { props: { inbox: { store } }, target: container })
    mounted.push({ component, container })
    flushClient()
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading notifications')
    expect(container.textContent).not.toContain('No notifications')
    fail(new Error('SQLSTATE password=secret /srv/private.ts:42'))
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('Notifications failed to load'))
    expect(container.textContent).not.toContain('No notifications')
    expect(container.textContent).not.toMatch(/SQLSTATE|secret|private\.ts/)
    recovered = true
    await store.refresh()
    flushClient()
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.textContent).toContain('No notifications')
  })

  it('executes a toast action once after shared confirmation without an inbox', async () => {
    const executeToastAction = vi.fn(async () => ({ effects: [], items: [], status: 'succeeded' as const }))
    const store = new ClientToastStore()
    store.connectActions({ executeToastAction })
    const actionManifest = { badge: null, color: null, confirmation: 'Retry publishing?', disabled: false, icon: 'rotate-cw', id: 'retry', kind: 'custom', label: 'Retry', modal: null, mount: 'notification', size: 'medium', tooltip: null, type: 'custom', visible: true }
    store.push({ ...presentation, actions: [{ actionManifest, execution: { actionId: 'retry', resourceId: 'posts' }, id: 'retry', kind: 'execute', label: 'Retry', token: 'signed-token', url: null }] })
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(ClientFixture, { props: { toasts: { store } }, target: container })
    mounted.push({ component, container })
    flushClient()
    await vi.waitFor(() => expect(container.querySelector('[data-action-id="retry"]')).not.toBeNull())
    container.querySelector<HTMLButtonElement>('[data-action-id="retry"]')?.click()
    flushClient()
    await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull())
    expect(executeToastAction).not.toHaveBeenCalled()
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')).find(button => button.textContent === 'Confirm')?.click()
    flushClient()
    await vi.waitFor(() => expect(executeToastAction).toHaveBeenCalledWith('signed-token', expect.objectContaining({ actionId: 'retry', mount: 'notification' }), expect.any(AbortSignal)))
    expect(executeToastAction).toHaveBeenCalledOnce()
    store.dispose()
  })
  it('runs saved notification actions through the shared confirmation dialog', async () => {
    const executeAction = vi.fn(async () => ({ effects: [], items: [], status: 'succeeded' as const }))
    const manifest = { badge: null, color: null, confirmation: 'Retry publishing?', disabled: false, icon: 'rotate-cw', id: 'retry', kind: 'custom', label: 'Retry', modal: null, mount: 'notification', size: 'medium', tooltip: null, type: 'custom', visible: true }
    const store = new ClientNotificationInboxStore({ transport: {
      delete: async () => 1, executeAction, markRead: async () => 1, markUnread: async () => 1,
      list: async (page, pageSize) => ({ items: [{ createdAt: '2026-07-28T10:00:00.000Z', id: 'saved-1', presentation: { ...presentation, actions: [{ actionManifest: manifest, execution: { actionId: 'retry', resourceId: 'posts' }, id: 'retry', kind: 'execute', label: 'Retry', url: null }] }, read: false, type: 'standard' }], page, pageSize, total: 1, unread: 1 }),
    } })
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(ClientFixture, { props: { inbox: { store } }, target: container })
    mounted.push({ component, container })
    flushClient()
    await vi.waitFor(() => { flushClient(); expect(container.textContent).toContain('Retry') })
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Retry')?.click()
    flushClient()
    await vi.waitFor(() => expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain('Retry publishing?'))
    expect(executeAction).not.toHaveBeenCalled()
    Array.from(document.querySelectorAll<HTMLButtonElement>('[role="alertdialog"] button')).find(button => button.textContent === 'Confirm')?.click()
    flushClient()
    await vi.waitFor(() => expect(executeAction).toHaveBeenCalledWith('saved-1', expect.objectContaining({ actionId: 'retry', mount: 'notification' }), expect.any(AbortSignal)))
    expect(executeAction).toHaveBeenCalledOnce()
  })

  it('exports notification renderers from the package root', () => {
    expect(SvelteNotificationInbox).toBeDefined()
    expect(SvelteToastViewport).toBeDefined()
    expect(registerSvelteNotificationRenderer).toBeTypeOf('function')
  })

  it('renders an accessible persistent toast queue with close controls and safe actions', () => {
    const store = new ClientToastStore()
    store.push(presentation)
    store.push({ ...presentation, actions: [{ id: 'unsafe', kind: 'navigate', label: 'Unsafe', url: 'javascript:alert(1)' }], id: 'notice-2', persistent: false, title: 'Unsafe link' })
    const markup = renderServer(ServerFixture, { props: { toasts: { placement: 'bottom', store } } }).body
    expect(markup).toContain('aria-live="polite"')
    expect(markup).toContain('aria-label="Notifications alt+T"')
    expect(markup).not.toContain('javascript:')
  })

  it('renders topbar dropdown, sidebar, and page inbox placements with unread controls, pagination, and namespaced custom types', async () => {
    const transport = {
      delete: vi.fn(async () => 1),
      list: vi.fn(async (page: number, pageSize: number) => ({ items: [
        { createdAt: '2026-07-28T10:00:00.000Z', id: 'db-1', presentation, read: false, type: 'build' },
        { createdAt: '2026-07-28T09:00:00.000Z', id: 'db-2', presentation: { ...presentation, id: 'notice-read', title: 'Read notice' }, read: true, type: 'standard' },
      ], page, pageSize, total: 25, unread: 1 })),
      markRead: vi.fn(async () => 1),
      markUnread: vi.fn(async () => 1),
    }
    const store = new ClientNotificationInboxStore({ pageSize: 10, polling: false, transport })
    await store.start()
    const registry = registerSvelteNotificationRenderer(new SvelteComponentRegistry(), 'build', ServerCustom)
    const topbar = renderServer(ServerFixture, { props: { inbox: { placement: 'dropdown', store } } }).body
    expect(topbar).toContain('data-placement="dropdown"')

    const custom = renderServer(ServerFixture, { props: { inbox: { placement: 'sidebar', registry, store } } }).body
    expect(custom).toContain('data-placement="sidebar"')
    expect(custom).toContain('aria-label="1 unread"')
    expect(custom).toContain('data-custom-notification="db-1"')
    expect(custom).toContain('data-color="brand-accent"')

    const plain = renderServer(ServerFixture, { props: { inbox: { store } } }).body
    expect(plain).toContain('data-placement="page"')
    expect(plain).toContain('data-read="false"')
    expect(plain).toContain('hp-notification-inbox-header')
    expect(plain).toContain('hp-notification-inbox-count')
    expect(plain).toContain('data-slot="notification-list"')
    expect(plain).toContain('data-slot="notification-item-content"')
    expect(plain).toContain('hp-notification-item-time')
    expect(plain).toContain('hp-notification-actions')
    expect(plain).toContain('hp-notification-pagination')
    expect(plain).toContain('Mark all read')
    expect(plain).toContain('Mark read')
    expect(plain).toContain('Mark unread')
    expect(plain).toContain('Delete')
    expect(plain).toContain('Page 1 of 3')
    expect(plain).toContain('href="/reports"')
  })

  it('contains rejected inbox mutations at the renderer event boundary', async () => {
    const failure = new Error('sensitive transport failure')
    const store = new ClientNotificationInboxStore({
      polling: false,
      transport: {
        delete: async () => 1,
        list: async (page, pageSize) => ({ items: [{ createdAt: '2026-07-28T10:00:00.000Z', id: 'db-1', presentation, read: false, type: 'standard' }], page, pageSize, total: 1, unread: 1 }),
        markRead: async () => 1,
        markUnread: async () => 1,
      },
    })
    await store.start()
    const mutation = vi.spyOn(store, 'markRead').mockRejectedValue(failure)
    const container = document.createElement('div')
    document.body.append(container)
    const component = mountClient(ClientFixture, { props: { inbox: { store } }, target: container })
    mounted.push({ component, container })
    flushClient()
    Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(button => button.textContent === 'Mark read')?.click()
    await Promise.resolve()
    await Promise.resolve()
    flushClient()
    expect(mutation).toHaveBeenCalledWith(['db-1'])
  })
})
