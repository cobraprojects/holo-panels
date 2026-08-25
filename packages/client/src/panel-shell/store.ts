import { toJsonValue, type JsonObject, type JsonValue } from '@holo-js/panels-core'
import type {
  PanelShellBootstrap,
  PanelShellError,
  PanelShellErrorCode,
  PanelShellState,
  PanelShellStateListener,
  PanelTenantSwitcherTransport,
  PanelShellViewport,
} from './contracts'

const PANEL_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const REALTIME_CHANNEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u

function viewport(width: number): PanelShellViewport {
  if (!Number.isFinite(width) || width < 0) throw new Error('Panel shell viewport widths must be non-negative numbers')
  if (width < 640) return 'mobile'
  if (width < 1024) return 'tablet'
  return 'desktop'
}

function freezeState(state: PanelShellState): PanelShellState {
  return Object.freeze({
    ...state,
    actor: state.actor ? Object.freeze({ ...state.actor }) : null,
    error: state.error ? Object.freeze({ ...state.error }) : null,
    manifest: state.manifest ? Object.freeze({
      ...state.manifest,
      branding: Object.freeze({ ...state.manifest.branding }),
      databaseNotifications: state.manifest.databaseNotifications
        ? Object.freeze({ ...state.manifest.databaseNotifications })
        : null,
      navigation: Object.freeze(state.manifest.navigation.map(item => Object.freeze({ ...item }))),
      slots: Object.freeze(Object.fromEntries(Object.entries(state.manifest.slots).map(([hook, references]) => [hook, Object.freeze([...(references ?? [])])]))),
      theme: Object.freeze({ ...state.manifest.theme, colors: Object.freeze({ ...state.manifest.theme.colors }) }),
      userMenu: Object.freeze(state.manifest.userMenu.map(item => Object.freeze({ ...item }))),
    }) : null,
    notifications: state.notifications ? Object.freeze({ ...state.notifications }) : null,
    tenancy: state.tenancy ? Object.freeze({
      active: state.tenancy.active ? Object.freeze({ ...state.tenancy.active }) : null,
      memberships: Object.freeze({
        memberships: Object.freeze(state.tenancy.memberships.memberships.map(tenant => Object.freeze({ ...tenant }))),
        nextCursor: state.tenancy.memberships.nextCursor,
      }),
    }) : null,
  })
}

function freezeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    const frozen = value.map(item => freezeJson(item))
    Object.freeze(frozen)
    return frozen
  }
  if (value !== null && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freezeJson(item)])))
  }
  return value
}

function serializeBootstrap(payload: PanelShellBootstrap): Readonly<PanelShellBootstrap> {
  const serialized = toJsonValue(payload)
  if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') throw new TypeError('Panel bootstrap payloads must be JSON objects')
  return freezeJson(serialized as JsonObject) as unknown as Readonly<PanelShellBootstrap>
}

function hasControlCharacter(value: string): boolean {
  return [...value].some(character => character.charCodeAt(0) <= 31 || character.charCodeAt(0) === 127)
}

function unsafeDecodedPath(path: string): boolean {
  let decoded = path
  for (let depth = 0; depth < 3; depth += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) return false
      if (next.includes('\\') || hasControlCharacter(next) || next.split('/').length !== decoded.split('/').length || next.split('/').some(segment => segment === '.' || segment === '..')) return true
      decoded = next
    } catch {
      return true
    }
  }
  return decoded.includes('%')
}

function normalizePath(path: string): string {
  if (path !== path.trim()) throw new Error('Panel routes must not contain surrounding whitespace')
  const value = path.split(/[?#]/u, 1)[0] ?? ''
  if (!value.startsWith('/') || value.includes('\\') || hasControlCharacter(value) || value.includes('//') || unsafeDecodedPath(value)) {
    throw new Error('Panel routes must be safe normalized absolute paths')
  }
  const normalized = value === '/' ? value : value.replace(/\/+$/gu, '')
  if (normalized.split('/').some(segment => segment === '.' || segment === '..')) throw new Error('Panel routes cannot contain traversal segments')
  return normalized
}

function assertBrandingUrl(value: string | null, label: string): void {
  if (value === null) return
  if (value !== value.trim() || value.includes('\\') || hasControlCharacter(value) || value.startsWith('//')) throw new Error(`${label} must be a safe URL`)
  if (value.startsWith('/')) {
    if (unsafeDecodedPath(value)) throw new Error(`${label} must be a safe URL`)
    return
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} must be an absolute path or HTTPS URL`)
  }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} must be a credential-free HTTPS URL`)
}

function routeWithinPanel(path: string, panelPath: string): boolean {
  if (panelPath === '/') return path.startsWith('/')
  return path === panelPath || path.startsWith(`${panelPath}/`)
}

function assertNotificationBootstrap(payload: Readonly<PanelShellBootstrap>): void {
  const configuration = payload.manifest.databaseNotifications
  if (configuration !== null) {
    if (configuration.placement !== 'sidebar' && configuration.placement !== 'topbar') {
      throw new Error('Database notification placement must be sidebar or topbar')
    }
    if (configuration.polling !== false && (!Number.isInteger(configuration.polling) || configuration.polling < 1_000 || configuration.polling > 3_600_000)) {
      throw new Error('Database notification polling must be false or an integer between 1000 and 3600000 milliseconds')
    }
    if (typeof configuration.realtime !== 'boolean') throw new Error('Database notification realtime must be boolean')
  }
  const channel = payload.notifications?.realtimeChannel
  if (channel !== null && channel !== undefined && !REALTIME_CHANNEL.test(channel)) {
    throw new Error('Panel notification realtime channels require a bounded stable channel name')
  }
  if (configuration === null && payload.notifications !== null) {
    throw new Error('Notification bootstrap data requires database notifications to be configured')
  }
}

export class PanelShellStore {
  #state: PanelShellState
  readonly #listeners = new Set<PanelShellStateListener>()

  constructor(panelId: string, width = 1280) {
    if (!PANEL_ID.test(panelId)) throw new Error('Panel shells require a stable panel ID')
    const currentViewport = viewport(width)
    this.#state = freezeState({
      activeNavigationId: null,
      activePath: '',
      actor: null,
      error: null,
      manifest: null,
      notifications: null,
      panelId,
      provider: null,
      sidebarOpen: currentViewport === 'desktop',
      tenancy: null,
      userMenuOpen: false,
      viewport: currentViewport,
    })
  }

  get snapshot(): PanelShellState {
    return this.#state
  }

  get cacheKey(): string {
    return `panel:${this.#state.panelId}:tenant:${this.#state.tenancy?.active?.routeKey ?? 'none'}:shell`
  }

  subscribe(listener: PanelShellStateListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  bootstrap(payload: PanelShellBootstrap, currentPath = payload.manifest.path): void {
    const serialized = serializeBootstrap(payload)
    if (serialized.manifest.id !== this.#state.panelId) throw new Error('Panel bootstrap IDs must match the fixed shell panel')
    const panelPath = normalizePath(serialized.manifest.path)
    if (panelPath !== serialized.manifest.path) throw new Error('Panel bootstrap paths must be normalized absolute paths')
    const path = normalizePath(currentPath)
    if (!routeWithinPanel(path, panelPath)) throw new Error('Panel bootstrap routes must remain inside the fixed panel path')
    assertBrandingUrl(serialized.manifest.branding.favicon, 'Panel favicons')
    assertBrandingUrl(serialized.manifest.branding.logo, 'Panel logos')
    assertNotificationBootstrap(serialized)
    if ((serialized.manifest.tenancy === null) !== (serialized.tenancy === null)) {
      throw new Error('Panel tenancy bootstrap must match the fixed panel manifest')
    }
    if (serialized.tenancy) {
      const routeKeys = new Set<string>()
      for (const tenant of serialized.tenancy.memberships.memberships) {
        if (!tenant.routeKey || routeKeys.has(tenant.routeKey)) throw new Error('Panel tenant memberships require unique route keys')
        routeKeys.add(tenant.routeKey)
      }
      if (serialized.tenancy.active && !routeKeys.has(serialized.tenancy.active.routeKey)) {
        throw new Error('The active panel tenant must be an authorized membership')
      }
    }
    for (const item of [...serialized.manifest.navigation, ...serialized.manifest.userMenu]) {
      const destination = normalizePath(item.path)
      if (destination !== item.path || !routeWithinPanel(destination, panelPath)) throw new Error('Panel manifest destinations must remain inside the fixed panel path')
    }
    this.update({
      activeNavigationId: this.activeNavigationId(path, serialized.manifest.navigation),
      activePath: path,
      actor: serialized.actor,
      error: null,
      manifest: serialized.manifest,
      notifications: serialized.notifications,
      provider: serialized.provider,
      sidebarOpen: this.#state.viewport === 'desktop' && serialized.manifest.navigationMode === 'sidebar',
      tenancy: serialized.tenancy,
      userMenuOpen: false,
    })
  }

  navigate(path: string): void {
    const manifest = this.requireManifest()
    const normalized = normalizePath(path)
    if (!routeWithinPanel(normalized, manifest.path)) throw new Error('Panel navigation cannot leave the fixed panel path')
    this.update({ activeNavigationId: this.activeNavigationId(normalized, manifest.navigation), activePath: normalized, error: null, userMenuOpen: false })
  }

  setViewport(width: number): void {
    const next = viewport(width)
    if (next === this.#state.viewport) return
    this.update({ sidebarOpen: next === 'desktop' && this.#state.manifest?.navigationMode === 'sidebar', viewport: next })
  }

  toggleSidebar(): void {
    const manifest = this.requireManifest()
    if (manifest.navigationMode !== 'sidebar' || !manifest.sidebarCollapsible) return
    this.update({ sidebarOpen: !this.#state.sidebarOpen })
  }

  toggleUserMenu(): void {
    this.requireManifest()
    this.update({ userMenuOpen: !this.#state.userMenuOpen })
  }

  async switchTenant(
    routeKey: string,
    transport: PanelTenantSwitcherTransport,
    signal?: Parameters<PanelTenantSwitcherTransport['switch']>[1],
  ): Promise<void> {
    const tenancy = this.#state.tenancy
    if (!tenancy) throw new Error('Panel tenancy is not configured')
    const tenant = tenancy.memberships.memberships.find(candidate => candidate.routeKey === routeKey)
    if (!tenant) throw new Error('Panel tenant membership was not found')
    const result = await transport.switch(routeKey, signal ?? new AbortController().signal)
    if (result.tenant.routeKey !== routeKey) throw new Error('Panel tenant switch returned a mismatched tenant')
    this.update({ tenancy: { ...tenancy, active: tenant } })
  }

  fail(code: PanelShellErrorCode, message: string, options: { readonly requestId?: string, readonly retryable?: boolean } = {}): void {
    const normalized = message.trim()
    if (!normalized) throw new Error('Panel error pages require a message')
    const error: PanelShellError = { code, message: normalized, requestId: options.requestId ?? null, retryable: options.retryable ?? code >= 500 }
    this.update({ error, userMenuOpen: false })
  }

  clearError(): void {
    if (!this.#state.error) return
    this.update({ error: null })
  }

  reset(): void {
    this.update({ activeNavigationId: null, activePath: '', actor: null, error: null, manifest: null, notifications: null, provider: null, sidebarOpen: false, tenancy: null, userMenuOpen: false })
  }

  private requireManifest() {
    if (!this.#state.manifest) throw new Error('Panel shell bootstrap is required')
    return this.#state.manifest
  }

  private activeNavigationId(path: string, items: readonly { readonly id: string, readonly path: string }[]): string | null {
    return [...items]
      .filter(item => path === item.path || path.startsWith(`${item.path}/`))
      .sort((left, right) => right.path.length - left.path.length || left.id.localeCompare(right.id))[0]?.id ?? null
  }

  private update(changes: Partial<PanelShellState>): void {
    const previous = this.#state
    const next = freezeState({ ...previous, ...changes })
    this.#state = next
    for (const listener of this.#listeners) listener(next, previous)
  }
}
