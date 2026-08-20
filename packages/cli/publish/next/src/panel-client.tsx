'use client'

import {
  ClientEffectSession,
  GlobalSearchStore,
  installPanelSpaNavigation,
  ClientNotificationInboxStore,
  ClientToastStore,
  createDefaultComponentRegistry,
  executePanelAuthRequest,
  registerReactFieldRenderers,
  PanelShellStore,
  PanelsAvatar,
  PanelsDropdown,
  PanelsPortalProvider,
  panelConfigurationVariables,
  PanelsTransport,
  PROTOCOL_VERSION,
  ReactNotificationInboxTrigger,
  ReactDashboardRenderer,
  ReactTenantSwitcher,
  ReactToastViewport,
  ReactWidgetRenderer,
  WidgetStore,
  createPanelNotificationTransport,
  createPanelTenantSwitcherTransport,
  type ClientNotificationRealtime,
  type ClientSearchResponse,
  type ComponentRegistry,
  type JsonObject,
  type JsonValue,
  type PanelAvatarComponentProps,
  type PanelChromeComponentProps,
  type ReactNotificationInboxTriggerProps,
  type ReactWidgetManifest,
} from '@holo-js/panels-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import type { NextPanelClientProps } from './contracts'
import { ShadcnButton, ShadcnIcon, ShadcnInput } from './internal-ui'

const LazyResourcePage = lazy(async () => {
  const module = await import('./resource-page')
  return { default: module.NextPanelResourcePage }
})

export function displayJson(value: JsonValue): ReactNode {
  if (value === null) return null
  if (Array.isArray(value)) return <ul>{value.map((item, index) => <li key={index}>{displayJson(item)}</li>)}</ul>
  if (typeof value === 'object') return <dl>{Object.entries(value).flatMap(([key, item]) => [<dt key={`${key}:label`}>{key}</dt>, <dd key={key}>{displayJson(item)}</dd>])}</dl>
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

export function createNextPanelComponentRegistry(): ComponentRegistry {
  return registerReactFieldRenderers(createDefaultComponentRegistry())
}

function browserPanelsTransport(): PanelsTransport {
  return new PanelsTransport({
    adapter: {
      async send(request) {
        const response = await fetch(request.url, request)
        return { body: await response.json() as unknown, status: response.status }
      },
    },
  })
}

function browserNavigate(url: string): void {
  globalThis.location.assign(url)
}

function searchResponse(value: JsonValue, panelId: string, term: string): ClientSearchResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Global search returned an invalid response.')
  const results = Array.isArray(value.results) ? value.results.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    if (typeof item.id !== 'string' || typeof item.resourceId !== 'string' || typeof item.title !== 'string' || typeof item.url !== 'string') return []
    const details = item.details && typeof item.details === 'object' && !Array.isArray(item.details)
      ? Object.freeze(Object.fromEntries(Object.entries(item.details).filter((entry): entry is [string, string] => typeof entry[1] === 'string')))
      : Object.freeze({})
    const actions = Array.isArray(item.actions) ? item.actions.flatMap(action => action && typeof action === 'object' && !Array.isArray(action)
      && typeof action.id === 'string' && typeof action.label === 'string' && typeof action.url === 'string'
      ? [{ id: action.id, label: action.label, url: action.url }]
      : []) : []
    return [{
      actions: Object.freeze(actions),
      details,
      icon: typeof item.icon === 'string' ? item.icon : null,
      id: item.id,
      image: typeof item.image === 'string' ? item.image : null,
      resourceId: item.resourceId,
      title: item.title,
      url: item.url,
    }]
  }) : []
  return Object.freeze({ panelId, results: Object.freeze(results), term })
}

function PanelGlobalSearch({ configuration, panelId }: {
  readonly configuration: NextPanelClientProps['payload']['bootstrap']['manifest']['globalSearchConfiguration']
  readonly panelId: string
}): ReactNode {
  const store = useMemo(() => new GlobalSearchStore({
    async search(term, signal) {
      const response = await browserPanelsTransport().execute(
        { kind: 'read', name: 'global-search' },
        { endpoint: `/holo/panels/${encodeURIComponent(panelId)}/global-search`, panelId, payload: { term }, signal },
      )
      if (!response.ok) throw new Error(response.error.message)
      return searchResponse(response.data, panelId, term)
    },
  }, {
    debounceMilliseconds: configuration?.debounce,
    keybindings: configuration?.keybindings,
  }), [configuration?.debounce, configuration?.keybindings, panelId])
  const state = useSyncExternalStore(store.subscribe.bind(store), () => store.snapshot, () => store.snapshot)
  useEffect(() => {
    const shortcut = (event: KeyboardEvent): void => {
      if (!store.shortcut(event.key, { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey })) return
      event.preventDefault()
      globalThis.document?.querySelector<HTMLInputElement>('[data-panel-global-search]')?.focus()
    }
    globalThis.addEventListener('keydown', shortcut)
    return () => globalThis.removeEventListener('keydown', shortcut)
  }, [store])
  return <div className="hp-global-search hp-panel-topbar-center" data-slot="command" role="search">
    <label><span className="hp-sr-only">Global search</span><ShadcnIcon className="hp-global-search-icon" name="search" /><ShadcnInput aria-controls="hp-global-search-results" aria-expanded={state.open} data-panel-global-search="" data-slot="command-input" onChange={event => store.input(event.currentTarget.value)} onFocus={() => store.open()} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') store.move(event.key === 'ArrowDown' ? 1 : -1)
      if (event.key === 'Enter') {
        const url = store.selectedUrl()
        if (url) browserNavigate(url)
      }
      if (event.key === 'Escape') store.close()
    }} placeholder={configuration?.fieldSuffix ?? 'Search…'} role="combobox" value={state.term} />{configuration?.keybindingSuffix ? <kbd>{configuration.keybindingSuffix}</kbd> : null}</label>
    {state.loading ? <span aria-live="polite" role="status">Searching…</span> : null}
    {state.error ? <span role="alert">{state.error}</span> : null}
    <ul data-slot="command-list" id="hp-global-search-results" role="listbox">{state.results.map((result, index) => <li aria-selected={index === state.selectedIndex} data-slot="command-item" key={`${result.resourceId}:${result.id}`} role="option"><a href={result.url}><strong>{result.title}</strong>{Object.entries(result.details).map(([key, value]) => <span key={key}>{key}: {value}</span>)}</a></li>)}</ul>
  </div>
}

function realtimeFallback(realtime: ClientNotificationRealtime): ClientNotificationRealtime {
  return {
    subscribe(invalidate) {
      try {
        return realtime.subscribe(invalidate)
      } catch {
        return () => undefined
      }
    },
  }
}

type ResolvedPageWidget = NextPanelClientProps['payload']['widgets']['header'][number]

function initialWidgetResult(widget: ResolvedPageWidget) {
  return widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status }
}

function ResolvedWidgetView({ panelId, registry, widget }: {
  readonly panelId: string
  readonly registry: ComponentRegistry
  readonly widget: ResolvedPageWidget
}): ReactNode {
  const store = useMemo(() => new WidgetStore(
    widget.manifest,
    async () => initialWidgetResult(widget),
    { initialResult: initialWidgetResult(widget) },
  ), [widget])
  return <ReactWidgetRenderer manifest={widget.manifest as ReactWidgetManifest} navigate={browserNavigate} panelId={panelId} registry={registry} store={store} />
}

function ResolvedWidgetGrid({ label, panelId, registry, widgets }: {
  readonly label: string
  readonly panelId: string
  readonly registry: ComponentRegistry
  readonly widgets: readonly ResolvedPageWidget[]
}): ReactNode {
  const [width, setWidth] = useState(1280)
  useEffect(() => {
    const update = (): void => setWidth(globalThis.innerWidth)
    update()
    globalThis.addEventListener('resize', update)
    return () => globalThis.removeEventListener('resize', update)
  }, [])
  if (widgets.length === 0) return null
  return <ReactDashboardRenderer
    label={label}
    widgets={widgets.map(widget => ({
      manifest: widget.manifest as ReactWidgetManifest,
      render: () => <ResolvedWidgetView panelId={panelId} registry={registry} widget={widget} />,
    }))}
    width={width}
  />
}

function hasPageData(value: JsonValue): boolean {
  if (value === null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function PanelGlyph({ name }: { readonly name: string | null }): ReactNode {
  if (!name) return null
  return <ShadcnIcon className="hp-panel-icon" name={name} />
}

function configuredIcon(icons: JsonObject | undefined, name: string | null): string | null {
  if (!name) return null
  const configured = icons?.[name]
  return typeof configured === 'string' && configured.trim() ? configured : name
}

function actorLabel(actor: JsonObject): string {
  for (const key of ['name', 'email', 'username']) {
    const value = actor[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return 'Account'
}

function actorAvatarUrl(actor: JsonObject): string | null {
  for (const key of ['avatarUrl', 'avatar_url', 'avatar', 'image']) {
    const value = actor[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

type PanelNavigationItem = NextPanelClientProps['payload']['bootstrap']['manifest']['navigation'][number]
type PanelColorMode = 'light' | 'dark' | 'system'

function isPanelColorMode(value: string | null): value is PanelColorMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function orderedNavigation(items: readonly PanelNavigationItem[]): readonly Readonly<{ readonly depth: number, readonly item: PanelNavigationItem }>[] {
  const children = new Map<string | null, PanelNavigationItem[]>()
  for (const item of items) {
    const siblings = children.get(item.parent) ?? []
    siblings.push(item)
    children.set(item.parent, siblings)
  }
  const ordered: { depth: number, item: PanelNavigationItem }[] = []
  const append = (parent: string | null, depth: number): void => {
    for (const item of children.get(parent) ?? []) {
      ordered.push({ depth, item })
      append(item.id, depth + 1)
    }
  }
  append(null, 0)
  return ordered
}

function NavigationLink({ activeId, depth, icons, item, mode, onNavigate }: {
  readonly activeId: string | null
  readonly depth: number
  readonly icons?: JsonObject
  readonly item: PanelNavigationItem
  readonly mode: 'sidebar' | 'topbar'
  readonly onNavigate: () => void
}): ReactNode {
  return <a aria-current={item.id === activeId ? 'page' : undefined} data-parent={item.parent ?? undefined} data-slot="sidebar-menu-button" href={item.path} onClick={onNavigate} style={{ '--hp-navigation-depth': depth } as CSSProperties} title={mode === 'sidebar' ? item.label : undefined}><PanelGlyph name={configuredIcon(icons, item.icon)} /><span>{item.label}</span>{item.badge ? <span className="hp-panel-badge" data-slot="sidebar-menu-badge">{item.badge}</span> : null}</a>
}

function NavigationItems({ activeId, collapsibleGroups, groups, icons, items, mode, onNavigate }: {
  readonly activeId: string | null
  readonly collapsibleGroups?: boolean
  readonly groups?: NextPanelClientProps['payload']['bootstrap']['manifest']['navigationGroups']
  readonly icons?: JsonObject
  readonly items: NextPanelClientProps['payload']['bootstrap']['manifest']['navigation']
  readonly mode: 'sidebar' | 'topbar'
  readonly onNavigate: () => void
}): ReactNode {
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(() => new Set())
  const toggleGroup = (group: string): void => {
    setCollapsedGroups(current => {
      const next = new Set(current)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }
  const ordered = orderedNavigation(items)
  if (mode === 'topbar') return ordered.map(({ depth, item }) => <NavigationLink activeId={activeId} depth={depth} icons={icons} item={item} key={item.id} mode={mode} onNavigate={onNavigate} />)
  const rendered: ReactNode[] = []
  for (let index = 0; index < ordered.length;) {
    const current = ordered[index]!
    if (!current.item.group) {
      rendered.push(<NavigationLink activeId={activeId} depth={current.depth} icons={icons} item={current.item} key={current.item.id} mode={mode} onNavigate={onNavigate} />)
      index += 1
      continue
    }
    const group = current.item.group
    const grouped = []
    while (index < ordered.length && ordered[index]!.item.group === group) {
      grouped.push(ordered[index]!)
      index += 1
    }
    const configuration = groups?.find(candidate => candidate.label === group)
    const collapsible = collapsibleGroups !== false && configuration?.collapsible !== false
    const links = grouped.map(({ depth, item }) => <NavigationLink activeId={activeId} depth={depth} icons={icons} item={item} key={item.id} mode={mode} onNavigate={onNavigate} />)
    rendered.push(collapsible
      ? <details className="hp-panel-navigation-section" key={group} open={!collapsedGroups.has(group)}><summary className="hp-panel-navigation-group" onClick={(event) => { event.preventDefault(); toggleGroup(group) }} title={group}>{group}</summary>{links}</details>
      : <section className="hp-panel-navigation-section" key={group}><div className="hp-panel-navigation-group" title={group}>{group}</div>{links}</section>)
  }
  return rendered
}

export function NextPanelClient({ notificationRealtime, payload, registry: registryInput, tenantTransport }: NextPanelClientProps): ReactNode {
  const registry = useMemo<ComponentRegistry>(
    () => registryInput ?? createNextPanelComponentRegistry(),
    [registryInput],
  )
  const store = useMemo(() => {
    const created = new PanelShellStore(payload.bootstrap.manifest.id)
    created.bootstrap(payload.bootstrap, payload.path)
    return created
  }, [payload])
  const state = useSyncExternalStore(store.subscribe.bind(store), () => store.snapshot, () => store.snapshot)
  const manifest = state.manifest!
  const shell = useRef<HTMLDivElement>(null)
  const TopbarComponent = manifest.components?.topbar
    ? registry.resolve<PanelChromeComponentProps<typeof payload.page>>(manifest.components.topbar, state.panelId, 'panel topbar')
    : null
  const SidebarComponent = manifest.components?.sidebar
    ? registry.resolve<PanelChromeComponentProps<typeof payload.page>>(manifest.components.sidebar, state.panelId, 'panel sidebar')
    : null
  const AvatarComponent = manifest.branding.avatarProvider
    ? registry.resolve<PanelAvatarComponentProps>(manifest.branding.avatarProvider, state.panelId, 'panel avatar provider')
    : null
  const resolvedTenantTransport = useMemo(
    () => tenantTransport ?? createPanelTenantSwitcherTransport(browserPanelsTransport(), state.panelId),
    [state.panelId, tenantTransport],
  )
  const toastStore = useMemo(() => new ClientToastStore(), [state.panelId])
  const effects = useMemo(() => new ClientEffectSession({
    panelId: state.panelId,
    redirect: effect => browserNavigate(effect.url),
    toastStore,
  }), [state.panelId, toastStore])
  useEffect(() => () => effects.dispose(), [effects])
  useEffect(() => {
    if (!manifest.runtime?.spa || !shell.current) return
    return installPanelSpaNavigation(shell.current, {
      exceptions: manifest.runtime.spaUrlExceptions,
      navigate: url => {
        globalThis.history.pushState({}, '', url)
        globalThis.dispatchEvent(new PopStateEvent('popstate'))
      },
      prefetching: manifest.runtime.spaPrefetching ?? false,
    })
  }, [manifest.runtime])
  useEffect(() => {
    if (payload.effects.length === 0) return
    void effects.apply({
      data: null,
      effects: [...payload.effects],
      id: 'session-effects',
      ok: true,
      protocolVersion: PROTOCOL_VERSION,
    })
  }, [effects, payload.effects])
  const notificationConfiguration = manifest.databaseNotifications
  const NotificationTrigger = notificationConfiguration?.component
    ? registry.resolve<ReactNotificationInboxTriggerProps>(notificationConfiguration.component, state.panelId, 'database notification component')
    : ReactNotificationInboxTrigger
  const notificationStore = useMemo(() => {
    if (!notificationConfiguration) return null
    const channel = notificationConfiguration.realtime ? state.notifications?.realtimeChannel : null
    let realtime: ClientNotificationRealtime | undefined
    if (channel && notificationRealtime) {
      try {
        realtime = realtimeFallback(notificationRealtime(channel))
      } catch {
        realtime = undefined
      }
    }
    return new ClientNotificationInboxStore({
      polling: notificationConfiguration.polling,
      ...(realtime ? { realtime } : {}),
      transport: createPanelNotificationTransport(browserPanelsTransport(), {
        endpoint: `/holo/panels/${state.panelId}/notification`,
        panelId: state.panelId,
      }),
    })
  }, [notificationConfiguration, notificationRealtime, state.notifications?.realtimeChannel, state.panelId])
  const notificationTrigger = notificationStore && notificationConfiguration
    ? <NotificationTrigger lazy={notificationConfiguration.lazy ?? true} navigate={browserNavigate} panelId={state.panelId} placement={notificationConfiguration.placement} registry={registry} store={notificationStore} />
    : null
  const body = payload.page.manifest.body
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavigation, setMobileNavigation] = useState(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const navigationToggle = useRef<HTMLButtonElement>(null)
  const [colorMode, setColorMode] = useState<PanelColorMode>(manifest.theme.darkMode)
  const accountLabel = actorLabel(payload.bootstrap.actor)
  const avatarUrl = actorAvatarUrl(payload.bootstrap.actor)
  const navigationId = `hp-panel-navigation-${state.panelId}`
  const dismissMobileNavigation = useCallback((): void => {
    setNavigationOpen(false)
    globalThis.queueMicrotask(() => navigationToggle.current?.focus())
  }, [])
  useEffect(() => {
    const mobileQuery = globalThis.matchMedia('(width <= 48rem)')
    const update = (): void => setMobileNavigation(mobileQuery.matches)
    update()
    mobileQuery.addEventListener('change', update)
    return () => mobileQuery.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (!mobileNavigation || !navigationOpen) return
    const dismissOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      dismissMobileNavigation()
    }
    globalThis.addEventListener('keydown', dismissOnEscape)
    return () => globalThis.removeEventListener('keydown', dismissOnEscape)
  }, [dismissMobileNavigation, mobileNavigation, navigationOpen])
  useEffect(() => {
    const container = globalThis.document.createElement('div')
    container.className = 'hp-panel-portal-host'
    const owner = shell.current ?? globalThis.document.documentElement
    container.dir = owner.closest<HTMLElement>('[dir="rtl"], [dir="ltr"]')?.dir
      ?? globalThis.getComputedStyle(owner).direction
    globalThis.document.body.append(container)
    setPortalContainer(container)
    return () => {
      setPortalContainer(current => current === container ? null : current)
      container.remove()
    }
  }, [state.panelId])
  useEffect(() => {
    if (!portalContainer) return
    portalContainer.dataset.holoPanel = ''
    portalContainer.dataset.panel = state.panelId
    portalContainer.dataset.theme = colorMode
    portalContainer.dataset.density = manifest.theme.density
    portalContainer.removeAttribute('style')
    for (const [name, value] of Object.entries(panelConfigurationVariables(manifest))) portalContainer.style.setProperty(name, value)
  }, [colorMode, manifest, portalContainer, state.panelId])
  useEffect(() => {
    const stored = globalThis.localStorage?.getItem(`holo-panels:${state.panelId}:color-mode`) ?? null
    if (isPanelColorMode(stored)) setColorMode(stored)
  }, [state.panelId])
  const toggleNavigation = (): void => {
    if (mobileNavigation || manifest.navigationMode === 'topbar') {
      setNavigationOpen(open => !open)
      return
    }
    if (manifest.sidebarCollapsible) setSidebarCollapsed(collapsed => !collapsed)
  }
  const chooseColorMode = (mode: PanelColorMode): void => {
    setColorMode(mode)
    globalThis.localStorage?.setItem(`holo-panels:${state.panelId}:color-mode`, mode)
  }
  const themeMenu = manifest.theme.switcher === false ? [] : [
    { id: 'panel-theme-light', label: <span className="hp-panel-theme-option"><ShadcnIcon name="sun" /><span>Light</span>{colorMode === 'light' ? <ShadcnIcon name="check" /> : null}</span>, onSelect: () => chooseColorMode('light') },
    { id: 'panel-theme-dark', label: <span className="hp-panel-theme-option"><ShadcnIcon name="moon" /><span>Dark</span>{colorMode === 'dark' ? <ShadcnIcon name="check" /> : null}</span>, onSelect: () => chooseColorMode('dark') },
    { id: 'panel-theme-system', label: <span className="hp-panel-theme-option"><ShadcnIcon name="monitor" /><span>System</span>{colorMode === 'system' ? <ShadcnIcon name="check" /> : null}</span>, onSelect: () => chooseColorMode('system') },
  ]
  const userMenu = [
    ...themeMenu,
    ...(manifest.auth?.profile && !manifest.userMenu.some(item => item.id === 'profile') ? [{ icon: 'user', id: 'profile', label: 'Profile', onSelect: () => browserNavigate(manifest.auth!.profile!.path) }] : []),
    ...manifest.userMenu.map(item => ({ icon: configuredIcon(manifest.icons, item.icon), id: item.id, label: item.label, onSelect: () => browserNavigate(item.path) })),
    ...(manifest.auth?.logout ? [{ icon: 'log-out', id: 'panel-logout', label: 'Sign out', onSelect: () => { void executePanelAuthRequest({ csrfToken: '', operation: 'logout', panelId: state.panelId, payload: {} }).then(result => { if (result.ok) globalThis.location.assign(result.url ?? manifest.auth?.login?.path ?? manifest.path) }) } }] : []),
  ]
  return <PanelsPortalProvider container={portalContainer}><div ref={shell} className="hp-panel hp-panel-shell" data-density={manifest.theme.density} data-holo-panel="" data-navigation={manifest.navigationMode} data-navigation-open={navigationOpen ? 'true' : 'false'} data-panel={state.panelId} data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'} data-sidebar-collapsible={manifest.sidebarCollapsible ? 'true' : 'false'} data-sidebar-fully-collapsible={manifest.layout?.sidebarFullyCollapsible ? 'true' : 'false'} data-slot="sidebar-wrapper" data-theme={colorMode} data-width={manifest.layout?.maxContentWidth === 'full' ? 'full' : 'constrained'} style={panelConfigurationVariables(manifest) as CSSProperties}>
    {manifest.assets?.map(asset => asset.type === 'css'
      ? <link data-panel-asset={asset.id} href={asset.src} key={asset.id} rel="stylesheet" />
      : <script data-panel-asset={asset.id} defer key={asset.id} src={asset.src} />)}
    {manifest.layout?.topbar === false ? null : TopbarComponent ? <TopbarComponent actor={payload.bootstrap.actor} manifest={manifest} page={payload.page} /> : <header className="hp-panel-header" data-slot="panel-header">
      {manifest.navigationEnabled === false ? null : <ShadcnButton aria-controls={manifest.navigationMode === 'topbar' || !SidebarComponent ? navigationId : undefined} aria-expanded={mobileNavigation ? navigationOpen : !sidebarCollapsed} aria-label="Toggle navigation" className="hp-panel-navigation-toggle hp-panel-topbar-start-action" data-slot="button" data-variant="ghost" onClick={toggleNavigation} ref={navigationToggle} type="button"><ShadcnIcon name="menu" /></ShadcnButton>}
      <a className={`hp-panel-brand hp-panel-topbar-start${manifest.navigationMode === 'sidebar' ? ' hp-panel-navigation-header' : ''}`} data-slot="panel-brand" href={manifest.routing?.homeUrl ?? manifest.path}>{manifest.branding.logo ? <img alt="" src={manifest.branding.logo} /> : <span aria-hidden="true" className="hp-panel-brand-mark">H</span>}<strong>{manifest.branding.name}</strong></a>
      {manifest.navigationEnabled !== false && manifest.navigationMode === 'topbar' ? <nav aria-label="Panel navigation" className="hp-panel-navigation hp-panel-navigation--topbar hp-panel-navigation-body hp-panel-topbar-center" data-open={navigationOpen ? 'true' : 'false'} id={navigationId}><NavigationItems activeId={state.activeNavigationId} collapsibleGroups={manifest.layout?.collapsibleNavigationGroups} groups={manifest.navigationGroups} icons={manifest.icons} items={manifest.navigation} mode="topbar" onNavigate={() => setNavigationOpen(false)} /></nav> : null}
      {manifest.globalSearch ? <PanelGlobalSearch configuration={manifest.globalSearchConfiguration} panelId={state.panelId} /> : null}
      <div className="hp-panel-header-actions hp-panel-topbar-end hp-panel-actions--compact">
        {payload.bootstrap.tenancy && manifest.tenancy?.switcher !== false ? <div className="hp-panel-tenant-action hp-panel-action--compact"><ReactTenantSwitcher onSwitched={() => globalThis.location.reload()} store={store} transport={resolvedTenantTransport} /></div> : null}
        {notificationConfiguration?.placement === 'topbar' ? <div className="hp-panel-notification-action hp-panel-action--compact">{notificationTrigger}</div> : null}
        {manifest.userMenuEnabled === false ? null : <div className="hp-panel-user-action hp-panel-action--compact"><PanelsDropdown ariaLabel="Account menu" items={userMenu} label={<span className="hp-panel-user-trigger">{AvatarComponent ? <AvatarComponent actor={payload.bootstrap.actor} label={accountLabel} /> : avatarUrl ? <PanelsAvatar alt={accountLabel} src={avatarUrl} /> : <span aria-hidden="true" className="hp-avatar hp-panel-user-avatar hp-panel-user-glyph" data-slot="avatar-fallback"><ShadcnIcon name="user" /></span>}<span className="hp-panel-user-label">{accountLabel}</span></span>} /></div>}
      </div>
    </header>}
    {manifest.navigationEnabled !== false && manifest.navigationMode === 'sidebar' ? <>
      <button aria-hidden={!mobileNavigation || !navigationOpen ? 'true' : undefined} aria-label="Close navigation" className="hp-panel-navigation-backdrop" data-open={navigationOpen ? 'true' : 'false'} data-slot="navigation-backdrop" hidden={!mobileNavigation || !navigationOpen} onClick={dismissMobileNavigation} tabIndex={-1} type="button" />
      {SidebarComponent ? <SidebarComponent actor={payload.bootstrap.actor} manifest={manifest} page={payload.page} /> : <aside aria-hidden={mobileNavigation && !navigationOpen ? 'true' : undefined} className="hp-panel-sidebar" data-open={navigationOpen ? 'true' : 'false'} data-slot="sidebar" id={navigationId} inert={mobileNavigation && !navigationOpen ? true : undefined}>
        <nav aria-label="Panel navigation" className="hp-panel-navigation hp-panel-navigation-body" data-open={navigationOpen ? 'true' : 'false'} data-slot="sidebar-content"><NavigationItems activeId={state.activeNavigationId} collapsibleGroups={manifest.layout?.collapsibleNavigationGroups} groups={manifest.navigationGroups} icons={manifest.icons} items={manifest.navigation} mode="sidebar" onNavigate={() => setNavigationOpen(false)} /></nav>
        {notificationConfiguration?.placement === 'sidebar' ? <div className="hp-panel-navigation-footer hp-panel-actions--compact"><div className="hp-panel-notification-action hp-panel-action--compact">{notificationTrigger}</div></div> : null}
      </aside>}
    </> : null}
    <main className="hp-panel-content" data-slot="sidebar-inset">
      {manifest.layout?.breadcrumbs !== false && payload.page.breadcrumbs.length > 0 ? <nav aria-label="Breadcrumbs" className="hp-panel-breadcrumbs"><ol>{payload.page.breadcrumbs.map(item => <li key={item.path}><a href={item.path}>{item.label}</a></li>)}</ol></nav> : null}
      <header className="hp-panel-page-header hp-panel-main-header" data-slot="page-header"><div><h1>{payload.page.heading ?? payload.page.title}</h1>{payload.page.subheading ? <p>{payload.page.subheading}</p> : null}</div></header>
      <section className="hp-panel-page hp-panel-main-body" data-page={payload.page.manifest.id} data-slot="page">
        <ResolvedWidgetGrid label="Page header widgets" panelId={state.panelId} registry={registry} widgets={payload.widgets.header} />
        {body?.component === 'resource-page'
          ? <Suspense fallback={<div aria-busy="true">Loading resource…</div>}><LazyResourcePage createRedirect={manifest.runtime?.resourceCreatePageRedirect ?? 'edit'} data={payload.page.data} editRedirect={manifest.runtime?.resourceEditPageRedirect ?? null} effects={effects} panelId={state.panelId} panelPath={manifest.path} properties={body.properties} readOnlyRelations={manifest.runtime?.readOnlyRelationManagersOnResourceViewPagesByDefault ?? true} registry={registry} unsavedChangesAlerts={manifest.runtime?.unsavedChangesAlerts ?? false} /></Suspense>
          : hasPageData(payload.page.data) ? <div className="hp-panel-page-surface">{displayJson(payload.page.data)}</div> : null}
        <ResolvedWidgetGrid label="Page footer widgets" panelId={state.panelId} registry={registry} widgets={payload.widgets.footer} />
      </section>
    </main>
    <ReactToastViewport navigate={browserNavigate} store={toastStore} />
  </div></PanelsPortalProvider>
}
