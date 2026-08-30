'use client'

import {
  ClientEffectSession,
  createWidgetActionStore,
  GlobalSearchStore,
  installPanelSpaNavigation,
  navigatePanelUrl,
  ClientNotificationInboxStore,
  ClientToastStore,
  createDefaultComponentRegistry,
  executePanelAuthRequest,
  registerReactFieldRenderers,
  PanelShellStore,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PanelsPageActionsProvider,
  PanelsPortalProvider,
  PanelsRenderHook,
  panelConfigurationVariables,
  PanelsTransport,
  PROTOCOL_VERSION,
  ReactNotificationInboxTrigger,
  ReactFeedbackProvider,
  ReactPanelsRenderHook,
  ReactPanelsRenderHookProvider,
  ReactDashboardRenderer,
  ReactTenantSwitcher,
  ReactToastViewport,
  ReactWidgetRenderer,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  WidgetStore,
  createPanelNotificationTransport,
  createPanelTranslator,
  createPanelTenantSwitcherTransport,
  syncDocumentLocale,
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
import { useRouter } from 'next/navigation.js'
import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import type { NextPanelClientProps } from './contracts'
import { Button, InputGroup, InputGroupAddon, InputGroupInput, PanelsIcon } from './internal-ui'
import { useStrictModeSafeDisposal } from './client-lifecycle'

const disposeEffectSession = (session: ClientEffectSession): void => session.dispose()

const LazyResourcePage = lazy(async () => {
  const module = await import('./resource-page')
  return { default: module.NextPanelResourcePage }
})

function displayJson(value: JsonValue): ReactNode {
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

function PanelGlobalSearch({ configuration, end, panelId, start, translate }: {
  readonly configuration: NextPanelClientProps['payload']['bootstrap']['manifest']['globalSearchConfiguration']
  readonly end: ReactNode
  readonly panelId: string
  readonly start: ReactNode
  readonly translate: ReturnType<typeof createPanelTranslator>
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
  return <div className="hp-global-search hp:relative hp:w-full hp:max-w-md" role="search">
    {start}<InputGroup><InputGroupAddon><PanelsIcon name="search" /></InputGroupAddon><InputGroupInput aria-controls="hp-global-search-results" aria-expanded={state.open} aria-label={translate('search.label')} data-panel-global-search="" onChange={event => store.input(event.currentTarget.value)} onFocus={() => store.open()} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') store.move(event.key === 'ArrowDown' ? 1 : -1)
      if (event.key === 'Enter') {
        const url = store.selectedUrl()
        if (url) browserNavigate(url)
      }
      if (event.key === 'Escape') store.close()
    }} placeholder={translate('search.placeholder')} role="combobox" value={state.term} />{configuration?.fieldSuffix ? <InputGroupAddon align="inline-end">{configuration.fieldSuffix}</InputGroupAddon> : null}{configuration?.keybindingSuffix ? <InputGroupAddon align="inline-end"><kbd className="hp:rounded hp:border hp:bg-muted hp:px-1.5 hp:text-xs hp:text-muted-foreground">{configuration.keybindingSuffix}</kbd></InputGroupAddon> : null}</InputGroup>
    {state.open && state.term ? <Command className="hp:absolute hp:top-full hp:z-50 hp:mt-2 hp:w-full hp:rounded-md hp:border hp:bg-popover hp:shadow-md"><CommandList id="hp-global-search-results">
      {state.loading ? <CommandEmpty>{translate('search.loading')}</CommandEmpty> : state.error ? <CommandEmpty>{state.error}</CommandEmpty> : state.results.length === 0 ? <CommandEmpty>{translate('search.none')}</CommandEmpty> : null}
      {state.results.map(result => <CommandItem asChild key={`${result.resourceId}:${result.id}`} value={`${result.title} ${Object.values(result.details).join(' ')}`}><a className="hp:flex hp:w-full hp:flex-col hp:items-start" href={result.url}><strong>{result.title}</strong>{Object.entries(result.details).map(([key, value]) => <span className="hp:text-xs hp:text-muted-foreground" key={key}>{key}: {value}</span>)}</a></CommandItem>)}
    </CommandList></Command> : null}{end}
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

function ResolvedWidgetView({ effects, panelId, registry, widget }: {
  readonly effects: ClientEffectSession
  readonly panelId: string
  readonly registry: ComponentRegistry
  readonly widget: ResolvedPageWidget
}): ReactNode {
  const store = useMemo(() => new WidgetStore(
    widget.manifest,
    async () => initialWidgetResult(widget),
    { initialResult: initialWidgetResult(widget) },
  ), [widget])
  const actionStore = useMemo(() => createWidgetActionStore({ applyEffects: response => effects.apply(response), panelId, resourceId: widget.resourceId, transport: browserPanelsTransport(), widgetId: widget.manifest.id }), [effects, panelId, widget.manifest.id, widget.resourceId])
  useEffect(() => () => { while (actionStore.activeFrame) actionStore.close() }, [actionStore])
  return <ReactWidgetRenderer actions={widget.actions} actionStore={actionStore} manifest={widget.manifest as ReactWidgetManifest} navigate={browserNavigate} panelId={panelId} registry={registry} store={store} />
}

function ResolvedWidgetGrid({ effects, label, panelId, registry, widgets }: {
  readonly effects: ClientEffectSession
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
      render: () => <ResolvedWidgetView effects={effects} panelId={panelId} registry={registry} widget={widget} />,
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
  return <PanelsIcon className="hp-panel-icon" name={name} />
}

function configuredIcon(icons: JsonObject | undefined, name: string | null): string | null {
  if (!name) return null
  const configured = icons?.[name]
  return typeof configured === 'string' && configured.trim() ? configured : name
}

function actorLabel(actor: JsonObject, fallback: string): string {
  for (const key of ['name', 'email', 'username']) {
    const value = actor[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
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

function NavigationLink({ activeId, icons, item, mode, onNavigate, sub = false }: {
  readonly activeId: string | null
  readonly icons?: JsonObject
  readonly item: PanelNavigationItem
  readonly mode: 'sidebar' | 'topbar'
  readonly onNavigate: () => void
  readonly sub?: boolean
}): ReactNode {
  const link = <a aria-current={item.id === activeId ? 'page' : undefined} data-parent={item.parent ?? undefined} href={item.path} onClick={onNavigate}><PanelGlyph name={configuredIcon(icons, item.icon)} /><span>{item.label}</span></a>
  if (mode === 'topbar') return <Button asChild variant="ghost">{link}</Button>
  if (sub) return <SidebarMenuSubItem><SidebarMenuSubButton asChild isActive={item.id === activeId}>{link}</SidebarMenuSubButton>{item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}</SidebarMenuSubItem>
  return <SidebarMenuItem><SidebarMenuButton asChild isActive={item.id === activeId} tooltip={item.label}>{link}</SidebarMenuButton>{item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}</SidebarMenuItem>
}

function SidebarNavigationBranch({ activeId, icons, items, onNavigate, parent = null }: {
  readonly activeId: string | null
  readonly icons?: JsonObject
  readonly items: readonly PanelNavigationItem[]
  readonly onNavigate: () => void
  readonly parent?: string | null
}): ReactNode {
  return items.filter(item => item.parent === parent).map(item => {
    const children = items.some(candidate => candidate.parent === item.id)
    return <Fragment key={item.id}><NavigationLink activeId={activeId} icons={icons} item={item} mode="sidebar" onNavigate={onNavigate} sub={parent !== null} />{children ? <SidebarMenuSub><SidebarNavigationBranch activeId={activeId} icons={icons} items={items} onNavigate={onNavigate} parent={item.id} /></SidebarMenuSub> : null}</Fragment>
  })
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
  if (mode === 'topbar') return items.map(item => <NavigationLink activeId={activeId} icons={icons} item={item} key={item.id} mode={mode} onNavigate={onNavigate} />)
  const rendered: ReactNode[] = []
  const rootItems = items.filter(item => item.parent === null)
  const groupLabels = [...new Set(rootItems.map(item => item.group))]
  for (const group of groupLabels) {
    const grouped = items.filter(item => {
      if (item.parent === null) return item.group === group
      let parent = items.find(candidate => candidate.id === item.parent)
      while (parent?.parent) parent = items.find(candidate => candidate.id === parent?.parent)
      return parent?.group === group
    })
    if (group === null) {
      rendered.push(<SidebarGroup key="ungrouped"><SidebarGroupContent><SidebarMenu><SidebarNavigationBranch activeId={activeId} icons={icons} items={grouped} onNavigate={onNavigate} /></SidebarMenu></SidebarGroupContent></SidebarGroup>)
      continue
    }
    const configuration = groups?.find(candidate => candidate.label === group)
    const collapsible = collapsibleGroups !== false && configuration?.collapsible !== false
    const links = <SidebarGroupContent><SidebarMenu><SidebarNavigationBranch activeId={activeId} icons={icons} items={grouped} onNavigate={onNavigate} /></SidebarMenu></SidebarGroupContent>
    rendered.push(collapsible
      ? <Collapsible asChild key={group} onOpenChange={() => toggleGroup(group)} open={!collapsedGroups.has(group)}><SidebarGroup><CollapsibleTrigger asChild><SidebarGroupLabel className="hp:cursor-pointer">{group}<PanelsIcon className="hp:ml-auto" name="chevron-down" /></SidebarGroupLabel></CollapsibleTrigger><CollapsibleContent>{links}</CollapsibleContent></SidebarGroup></Collapsible>
      : <SidebarGroup key={group}><SidebarGroupLabel>{group}</SidebarGroupLabel>{links}</SidebarGroup>)
  }
  return rendered
}

export function NextPanelClient({ notificationRealtime, payload, registry: registryInput, tenantTransport }: NextPanelClientProps): ReactNode {
  const router = useRouter()
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
  const translate = useMemo(() => createPanelTranslator(payload.bootstrap.locale), [payload.bootstrap.locale])
  useEffect(() => syncDocumentLocale(payload.bootstrap, document), [payload.bootstrap.direction, payload.bootstrap.locale])
  const navigation = useRef({ router, runtime: manifest.runtime })
  navigation.current = { router, runtime: manifest.runtime }
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
    redirect: effect => {
      if (effect.newTab) { window.open(effect.url, '_blank', 'noopener,noreferrer'); return }
      const current = navigation.current
      return navigatePanelUrl(effect.url, { enabled: current.runtime?.spa !== false, exceptions: current.runtime?.spaUrlExceptions ?? [], navigate: (url, replacing) => replacing ? current.router.replace(url) : current.router.push(url) }, effect.replace)
    },
    toastStore,
  }), [state.panelId, toastStore])
  useStrictModeSafeDisposal(effects, disposeEffectSession)
  useEffect(() => {
    toastStore.connectActions(createPanelNotificationTransport(browserPanelsTransport(), {
      applyEffects: response => effects.apply(response),
      endpoint: `/holo/panels/${state.panelId}/notification`,
      panelId: state.panelId,
    }))
  }, [effects, state.panelId, toastStore])
  useEffect(() => {
    if (manifest.runtime?.spa === false || !shell.current) return
    return installPanelSpaNavigation(shell.current, {
      exceptions: manifest.runtime?.spaUrlExceptions ?? [],
      navigate: url => router.push(url),
      prefetching: manifest.runtime?.spaPrefetching ?? false,
    })
  }, [manifest.runtime, router])
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
        applyEffects: response => effects.apply(response),
        endpoint: `/holo/panels/${state.panelId}/notification`,
        panelId: state.panelId,
      }),
    })
  }, [effects, notificationConfiguration, notificationRealtime, state.notifications?.realtimeChannel, state.panelId])
  const notificationTrigger = notificationStore && notificationConfiguration
    ? <NotificationTrigger emptyMessage={translate('notifications.empty')} label={translate('notifications.label')} lazy={notificationConfiguration.lazy ?? true} locale={payload.bootstrap.locale} navigate={browserNavigate} panelId={state.panelId} placement={notificationConfiguration.placement} registry={registry} store={notificationStore} />
    : null
  const body = payload.page.manifest.body
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [pageActionsContainer, setPageActionsContainer] = useState<HTMLElement | null>(null)
  const [colorMode, setColorMode] = useState<PanelColorMode>(manifest.theme.darkMode)
  const accountLabel = actorLabel(payload.bootstrap.actor, translate('navigation.account'))
  const avatarUrl = actorAvatarUrl(payload.bootstrap.actor)
  useEffect(() => {
    const stored = globalThis.localStorage?.getItem(`holo-panels:${state.panelId}:color-mode`) ?? null
    if (isPanelColorMode(stored)) setColorMode(stored)
  }, [state.panelId])
  const chooseColorMode = (mode: PanelColorMode): void => {
    setColorMode(mode)
    globalThis.localStorage?.setItem(`holo-panels:${state.panelId}:color-mode`, mode)
  }
  const themeMenu = manifest.theme.switcher === false ? [] : [
    { icon: null, id: 'panel-theme-light', label: <span className="hp-panel-theme-option"><PanelsIcon name="sun" /><span>{translate('theme.light')}</span>{colorMode === 'light' ? <PanelsIcon name="check" /> : null}</span>, onSelect: () => chooseColorMode('light') },
    { icon: null, id: 'panel-theme-dark', label: <span className="hp-panel-theme-option"><PanelsIcon name="moon" /><span>{translate('theme.dark')}</span>{colorMode === 'dark' ? <PanelsIcon name="check" /> : null}</span>, onSelect: () => chooseColorMode('dark') },
    { icon: null, id: 'panel-theme-system', label: <span className="hp-panel-theme-option"><PanelsIcon name="monitor" /><span>{translate('theme.system')}</span>{colorMode === 'system' ? <PanelsIcon name="check" /> : null}</span>, onSelect: () => chooseColorMode('system') },
  ]
  const userMenu = [
    ...themeMenu,
    ...(manifest.auth?.profile && !manifest.userMenu.some(item => item.id === 'profile') ? [{ icon: 'user', id: 'profile', label: translate('navigation.profile'), onSelect: () => browserNavigate(manifest.auth!.profile!.path) }] : []),
    ...manifest.userMenu.map(item => ({ icon: configuredIcon(manifest.icons, item.icon), id: item.id, label: item.label, onSelect: () => browserNavigate(item.path) })),
    ...(manifest.auth?.logout ? [{ icon: 'log-out', id: 'panel-logout', label: translate('navigation.signOut'), onSelect: () => { void executePanelAuthRequest({ csrfToken: '', operation: 'logout', panelId: state.panelId, payload: {} }).then(result => { if (result.ok) globalThis.location.assign(result.url ?? manifest.auth?.login?.path ?? manifest.path) }) } }] : []),
  ]
  const pageScopes = [payload.page.manifest.id, ...(typeof body?.properties.resourceId === 'string' ? [body.properties.resourceId] : [])]
  const renderHook = (hook: PanelsRenderHook, data: JsonObject = {}): ReactNode => <ReactPanelsRenderHook data={data} hook={hook} manifest={manifest} registry={registry} scopes={pageScopes} />
  const accountAvatar = AvatarComponent
    ? <AvatarComponent actor={payload.bootstrap.actor} label={accountLabel} />
    : <Avatar className="hp-panel-user-glyph hp:size-8">{avatarUrl ? <AvatarImage alt={accountLabel} src={avatarUrl} /> : null}<AvatarFallback><PanelsIcon name="user" /></AvatarFallback></Avatar>
  const accountMenu = manifest.userMenuEnabled === false ? null : <DropdownMenu>
    <DropdownMenuTrigger asChild><Button aria-label={translate('navigation.accountMenu')} className="hp-panel-user-action hp:h-10 hp:gap-2 hp:px-2" variant="ghost">{accountAvatar}<span className="hp:hidden hp:max-w-40 hp:truncate hp:sm:inline">{accountLabel}</span><PanelsIcon name="chevron-down" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="hp:w-56"><DropdownMenuLabel>{accountLabel}</DropdownMenuLabel><DropdownMenuSeparator />{userMenu.map((item, index) => <Fragment key={item.id}>{index === themeMenu.length && themeMenu.length > 0 ? <DropdownMenuSeparator /> : null}<DropdownMenuItem onSelect={item.onSelect} variant={item.id === 'panel-logout' ? 'destructive' : 'default'}>{item.icon ? <PanelsIcon name={item.icon} /> : null}{item.label}</DropdownMenuItem></Fragment>)}</DropdownMenuContent>
  </DropdownMenu>
  const brand = <a className="hp-panel-brand hp:flex hp:items-center hp:gap-2 hp:font-semibold" href={manifest.routing?.homeUrl ?? manifest.path}>{manifest.branding.logo ? <img alt="" className="hp:size-8 hp:rounded-md hp:object-contain" src={manifest.branding.logo} /> : <span aria-hidden="true" className="hp:flex hp:size-8 hp:items-center hp:justify-center hp:rounded-md hp:bg-primary hp:text-sm hp:font-semibold hp:text-primary-foreground">H</span>}<span className="hp:truncate hp:group-data-[collapsible=icon]:hidden">{manifest.branding.name}</span></a>
  const page = <>
    {renderHook(PanelsRenderHook.CONTENT_BEFORE)}
    <SidebarInset className="hp-panel-content">
      {renderHook(PanelsRenderHook.CONTENT_START)}
      {manifest.layout?.topbar === false ? null : TopbarComponent ? <TopbarComponent actor={payload.bootstrap.actor} manifest={manifest} page={payload.page} /> : <header className="hp-panel-header hp-panel-main-header hp:sticky hp:top-0 hp:z-20 hp:flex hp:h-16 hp:shrink-0 hp:items-center hp:gap-2 hp:border-b hp:bg-background hp:px-4">
        <div className="hp-panel-topbar-start hp:contents">{renderHook(PanelsRenderHook.TOPBAR_START)}</div>
        {manifest.navigationEnabled === false ? null : manifest.navigationMode === 'sidebar' ? <SidebarTrigger aria-label="Toggle navigation" className="hp-panel-navigation-toggle" /> : <Button aria-expanded={navigationOpen} aria-label="Toggle navigation" className="hp-panel-navigation-toggle" onClick={() => setNavigationOpen(open => !open)} size="icon" variant="ghost"><PanelsIcon name="menu" /></Button>}
        {manifest.navigationMode === 'sidebar' ? <Separator className="hp:mr-2 hp:h-4" orientation="vertical" /> : null}
        {manifest.navigationMode === 'topbar' ? <>{renderHook(PanelsRenderHook.TOPBAR_LOGO_BEFORE)}{brand}{renderHook(PanelsRenderHook.TOPBAR_LOGO_AFTER)}<nav aria-label="Panel navigation" className="hp-panel-navigation hp-panel-navigation--topbar hp:hidden hp:items-center hp:gap-1 hp:lg:flex"><NavigationItems activeId={state.activeNavigationId} groups={manifest.navigationGroups} icons={manifest.icons} items={manifest.navigation} mode="topbar" onNavigate={() => setNavigationOpen(false)} /></nav></> : null}
        {renderHook(PanelsRenderHook.GLOBAL_SEARCH_BEFORE)}
        {manifest.globalSearch ? <div className="hp-panel-topbar-center hp:mx-auto hp:min-w-0 hp:max-w-md hp:flex-1"><PanelGlobalSearch configuration={manifest.globalSearchConfiguration} end={renderHook(PanelsRenderHook.GLOBAL_SEARCH_END)} panelId={state.panelId} start={renderHook(PanelsRenderHook.GLOBAL_SEARCH_START)} translate={translate} /></div> : <div className="hp-panel-topbar-center hp:flex-1" />}
        {renderHook(PanelsRenderHook.GLOBAL_SEARCH_AFTER)}
        <div className="hp-panel-header-actions hp-panel-actions--compact hp:ml-auto hp:flex hp:shrink-0 hp:items-center hp:gap-2">
          {notificationConfiguration?.placement === 'topbar' ? <div className="hp-panel-notification-action hp:contents">{notificationTrigger}</div> : null}
          {manifest.navigationMode === 'topbar' && payload.bootstrap.tenancy && manifest.tenancy?.switcher !== false ? <ReactTenantSwitcher onSwitched={url => router.push(url)} store={store} transport={resolvedTenantTransport} /> : null}
          {manifest.navigationMode === 'topbar' ? accountMenu : null}
        </div>
        <div className="hp-panel-topbar-end hp:contents">{renderHook(PanelsRenderHook.TOPBAR_END)}</div>
      </header>}
      {renderHook(PanelsRenderHook.TOPBAR_AFTER)}
      <div className="hp-panel-main hp-panel-main-body hp:mx-auto hp:flex hp:w-full hp:flex-1 hp:flex-col hp:gap-6 hp:p-4 hp:pt-6 hp:md:p-6" style={{ maxWidth: 'var(--hp-content-max-width)' }}>
        {renderHook(PanelsRenderHook.PAGE_START, payload.page.data)}
        <div className="hp-panel-page-header hp:flex hp:flex-col hp:gap-4 hp:sm:flex-row hp:sm:items-center hp:sm:justify-between"><div className="hp-panel-page-heading hp:space-y-1">{manifest.layout?.breadcrumbs !== false && payload.page.breadcrumbs.length > 0 ? <Breadcrumb className="hp-panel-breadcrumbs"><BreadcrumbList>{payload.page.breadcrumbs.map((item, index) => <Fragment key={item.path}><BreadcrumbItem>{index === payload.page.breadcrumbs.length - 1 ? <BreadcrumbPage>{item.label}</BreadcrumbPage> : <BreadcrumbLink href={item.path}>{item.label}</BreadcrumbLink>}</BreadcrumbItem>{index < payload.page.breadcrumbs.length - 1 ? <BreadcrumbSeparator /> : null}</Fragment>)}</BreadcrumbList></Breadcrumb> : null}{renderHook(PanelsRenderHook.PAGE_HEADER_HEADING_BEFORE, payload.page.data)}<h1 className="hp:text-3xl hp:font-bold hp:tracking-tight">{payload.page.heading ?? payload.page.title}</h1>{payload.page.subheading ? <p className="hp:text-muted-foreground">{payload.page.subheading}</p> : null}{renderHook(PanelsRenderHook.PAGE_HEADER_HEADING_AFTER, payload.page.data)}</div><div aria-label="Page actions" className="hp-panel-page-actions hp:flex hp:flex-wrap hp:items-center hp:justify-end hp:gap-2" role="group">{renderHook(PanelsRenderHook.PAGE_HEADER_ACTIONS_BEFORE, payload.page.data)}<div className="hp:contents" ref={setPageActionsContainer} />{renderHook(PanelsRenderHook.PAGE_HEADER_ACTIONS_AFTER, payload.page.data)}</div></div>
        <section className="hp-panel-page hp:flex hp:flex-col hp:gap-6" data-page={payload.page.manifest.id} data-slot="page">
          {renderHook(PanelsRenderHook.PAGE_HEADER_WIDGETS_BEFORE, payload.page.data)}{renderHook(PanelsRenderHook.PAGE_HEADER_WIDGETS_START, payload.page.data)}<ResolvedWidgetGrid effects={effects} label="Page header widgets" panelId={state.panelId} registry={registry} widgets={payload.widgets.header} />{renderHook(PanelsRenderHook.PAGE_HEADER_WIDGETS_END, payload.page.data)}{renderHook(PanelsRenderHook.PAGE_HEADER_WIDGETS_AFTER, payload.page.data)}
          {body?.component === 'resource-page' ? <Suspense fallback={<div aria-busy="true">Loading resource…</div>}><LazyResourcePage createRedirect={manifest.runtime?.resourceCreatePageRedirect ?? 'edit'} data={payload.page.data} editRedirect={manifest.runtime?.resourceEditPageRedirect ?? null} effects={effects} key={payload.path} panelId={state.panelId} panelManifest={manifest} panelPath={manifest.path} properties={body.properties} readOnlyRelations={manifest.runtime?.readOnlyRelationManagersOnResourceViewPagesByDefault ?? true} registry={registry} renderHookScopes={pageScopes} unsavedChangesAlerts={manifest.runtime?.unsavedChangesAlerts ?? false} /></Suspense> : hasPageData(payload.page.data) ? <div className="hp-panel-page-surface">{displayJson(payload.page.data)}</div> : null}
          {renderHook(PanelsRenderHook.PAGE_FOOTER_WIDGETS_BEFORE, payload.page.data)}{renderHook(PanelsRenderHook.PAGE_FOOTER_WIDGETS_START, payload.page.data)}<ResolvedWidgetGrid effects={effects} label="Page footer widgets" panelId={state.panelId} registry={registry} widgets={payload.widgets.footer} />{renderHook(PanelsRenderHook.PAGE_FOOTER_WIDGETS_END, payload.page.data)}{renderHook(PanelsRenderHook.PAGE_FOOTER_WIDGETS_AFTER, payload.page.data)}
        </section>
        {renderHook(PanelsRenderHook.PAGE_END, payload.page.data)}
      </div>
      {renderHook(PanelsRenderHook.CONTENT_END)}
    </SidebarInset>
    {renderHook(PanelsRenderHook.CONTENT_AFTER)}
  </>
  return <ReactFeedbackProvider panelId={state.panelId} store={toastStore}><ReactPanelsRenderHookProvider data={payload.page.data} manifest={manifest} registry={registry} scopes={pageScopes}><PanelsPageActionsProvider container={pageActionsContainer}><PanelsPortalProvider container={shell}><div ref={shell} className="hp-panel hp:min-h-svh hp:bg-background hp:text-foreground" data-density={manifest.theme.density} data-holo-panel="" data-navigation={manifest.navigationMode} data-navigation-open={navigationOpen ? 'true' : 'false'} data-panel={state.panelId} data-sidebar-collapsed={sidebarCollapsed ? 'true' : 'false'} data-sidebar-collapsible={manifest.sidebarCollapsible ? 'true' : 'false'} data-sidebar-fully-collapsible={manifest.layout?.sidebarFullyCollapsible ? 'true' : 'false'} data-theme={colorMode} data-width={manifest.layout?.maxContentWidth === 'full' ? 'full' : 'constrained'} dir={payload.bootstrap.direction} lang={payload.bootstrap.locale} style={panelConfigurationVariables(manifest) as CSSProperties}>
    {renderHook(PanelsRenderHook.BODY_START)}{renderHook(PanelsRenderHook.LAYOUT_START)}
    {manifest.assets?.map(asset => asset.type === 'css' ? <link data-panel-asset={asset.id} href={asset.src} key={asset.id} rel="stylesheet" /> : <script data-panel-asset={asset.id} defer key={asset.id} src={asset.src} />)}
    {renderHook(PanelsRenderHook.TOPBAR_BEFORE)}
    <SidebarProvider onOpenChange={open => setSidebarCollapsed(!open)} open={!sidebarCollapsed}>
      {manifest.navigationEnabled !== false && manifest.navigationMode === 'sidebar' ? SidebarComponent ? <SidebarComponent actor={payload.bootstrap.actor} manifest={manifest} page={payload.page} /> : <Sidebar className="hp-panel-sidebar" collapsible={manifest.sidebarCollapsible ? manifest.layout?.sidebarFullyCollapsible ? 'offcanvas' : 'icon' : 'none'} side={payload.bootstrap.direction === 'rtl' ? 'right' : 'left'}>
        {renderHook(PanelsRenderHook.SIDEBAR_START)}
        <SidebarHeader className="hp-panel-navigation-header">{renderHook(PanelsRenderHook.TOPBAR_LOGO_BEFORE)}{brand}{renderHook(PanelsRenderHook.TOPBAR_LOGO_AFTER)}{payload.bootstrap.tenancy && manifest.tenancy?.switcher !== false ? <ReactTenantSwitcher onSwitched={url => router.push(url)} store={store} transport={resolvedTenantTransport} /> : null}</SidebarHeader>
        <SidebarContent className="hp-panel-navigation-body"><nav aria-label="Panel navigation" className="hp-panel-navigation hp:h-full">{renderHook(PanelsRenderHook.SIDEBAR_NAV_START)}<NavigationItems activeId={state.activeNavigationId} collapsibleGroups={manifest.layout?.collapsibleNavigationGroups} groups={manifest.navigationGroups} icons={manifest.icons} items={manifest.navigation} mode="sidebar" onNavigate={() => undefined} />{renderHook(PanelsRenderHook.SIDEBAR_NAV_END)}</nav></SidebarContent>
        <SidebarFooter>{notificationConfiguration?.placement === 'sidebar' ? <div className="hp-panel-notification-action hp:contents">{notificationTrigger}</div> : null}{accountMenu}{renderHook(PanelsRenderHook.SIDEBAR_FOOTER)}</SidebarFooter><SidebarRail />
      </Sidebar> : null}
      {page}
    </SidebarProvider>
    {renderHook(PanelsRenderHook.FOOTER)}<ReactToastViewport navigate={browserNavigate} panelId={state.panelId} registry={registry} store={toastStore} />{renderHook(PanelsRenderHook.LAYOUT_END)}{renderHook(PanelsRenderHook.BODY_END)}
  </div></PanelsPortalProvider></PanelsPageActionsProvider></ReactPanelsRenderHookProvider></ReactFeedbackProvider>
}
