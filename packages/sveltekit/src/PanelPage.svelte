<script lang="ts">
  import { goto } from '$app/navigation'
  import { onMount, tick, untrack } from 'svelte'
  import {
    ClientEffectSession,
    ClientNotificationInboxStore,
    ClientToastStore,
    GlobalSearchStore,
    installPanelSpaNavigation,
    navigatePanelUrl,
    DashboardRenderer,
    PanelsRenderHook,
    PanelsRenderHookRenderer,
    PanelsTransport,
    PanelShellStore,
    WidgetStore,
    createWidgetActionStore,
    panelConfigurationStyleAttribute,
    providePanelsRenderHooks,
    registerPanelNotificationStore,
    setPanelsPortalTarget,
    SvelteNotificationInboxTrigger,
    SvelteNotificationToastViewport,
    SvelteTenantSwitcher,
    createPanelNotificationTransport,
    createPanelTranslator,
    createPanelTenantSwitcherTransport,
    executePanelAuthRequest,
    syncDocumentLocale,
    type ClientNotificationRealtime,
    type ClientSearchResponse,
    type ClientSearchState,
    type PanelAvatarComponentProps,
    type PanelChromeComponentProps,
    type SvelteNotificationInboxTriggerProps,
    type SveltePanelComponent,
    type SvelteWidgetManifest,
  } from '@holo-js/panels-svelte'
  import { Avatar, AvatarFallback, AvatarImage } from '@holo-js/panels-svelte/ui/avatar'
  import { Badge } from '@holo-js/panels-svelte/ui/badge'
  import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@holo-js/panels-svelte/ui/breadcrumb'
  import { Button } from '@holo-js/panels-svelte/ui/button'
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@holo-js/panels-svelte/ui/collapsible'
  import { Command, CommandEmpty, CommandItem, CommandList } from '@holo-js/panels-svelte/ui/command'
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@holo-js/panels-svelte/ui/dropdown-menu'
  import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@holo-js/panels-svelte/ui/empty'
  import { InputGroup, InputGroupAddon, InputGroupInput } from '@holo-js/panels-svelte/ui/input-group'
  import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from '@holo-js/panels-svelte/ui/sidebar'
  import type { PanelPageProps } from './contracts'
  import ResourcePage from './ResourcePage.svelte'
  import Icon from './Icon.svelte'

  const REALTIME_CHANNEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u
  type PanelColorMode = 'light' | 'dark' | 'system'

  let { data, notificationRealtime, registry }: PanelPageProps = $props()
  let searchState = $state<ClientSearchState | null>(null)
  let viewportWidth = $state(1280)
  let navigationOpen = $state(false)
  let sidebarCollapsed = $state(false)
  let selectedColorMode = $state<PanelColorMode | null>(null)
  let pageActionsElement = $state<HTMLDivElement>()
  let shellElement = $state<HTMLDivElement>()
  setPanelsPortalTarget(() => shellElement)
  const initialPanelId = untrack(() => data.panel.manifest.id)
  const translate = createPanelTranslator(untrack(() => data.panel.locale))
  const navigationId = `hp-panel-navigation-${initialPanelId}`
  const navigationToggleId = `hp-panel-navigation-toggle-${initialPanelId}`
  const tenantStore = new PanelShellStore(initialPanelId)
  const tenantTransport = createPanelTenantSwitcherTransport(browserTransport(), initialPanelId)
  tenantStore.bootstrap(untrack(() => data.panel), untrack(() => data.page.manifest.path))
  const notificationConfiguration = $derived(data.panel.manifest.databaseNotifications)
  const NotificationTrigger = $derived(notificationConfiguration?.component && registry
    ? registry.resolve<SvelteNotificationInboxTriggerProps>(notificationConfiguration.component, data.panel.manifest.id, 'database notification component')
    : SvelteNotificationInboxTrigger) as SveltePanelComponent<SvelteNotificationInboxTriggerProps>
  const toastStore = new ClientToastStore()
  const effects = new ClientEffectSession({
    panelId: initialPanelId,
    redirect: effect => { if (effect.newTab) { window.open(effect.url, '_blank', 'noopener,noreferrer'); return } return navigate(effect.url, effect.replace) },
    toastStore,
  })
  let appliedEffects = untrack(() => data.effects)
  toastStore.connectActions(createPanelNotificationTransport(browserTransport(), {
    applyEffects: response => effects.apply(response),
    endpoint: `/holo/panels/${initialPanelId}/notification`,
    panelId: initialPanelId,
  }))
  let effectBatch = 0
  void effects.apply({ data: null, effects: [...appliedEffects], id: 'session-effects-0', ok: true, protocolVersion: '1.0' }).catch(() => undefined)
  const notificationStore = $derived.by(() => notificationConfiguration
    ? new ClientNotificationInboxStore({
        polling: notificationConfiguration.polling,
        realtime: realtimeConnection(notificationConfiguration.realtime, data.panel.notifications?.realtimeChannel ?? null),
        transport: createPanelNotificationTransport(browserTransport(), {
          applyEffects: response => effects.apply(response),
          endpoint: `/holo/panels/${data.panel.manifest.id}/notification`,
          panelId: data.panel.manifest.id,
        }),
      })
    : null)
  const body = $derived(data.page.manifest.body)
  const pageScopes = $derived([
    data.page.manifest.id,
    ...(typeof body?.properties.resourceId === 'string' ? [body.properties.resourceId] : []),
  ])
  providePanelsRenderHooks({
    get data() { return data.page.data },
    get manifest() { return data.panel.manifest },
    get registry() { return registry },
    get scopes() { return pageScopes },
  })
  const resourceBody = $derived(body?.component === 'resource-page')
  const Body = $derived(body && !resourceBody && registry
    ? registry.resolve<Record<string, unknown>>(body.component, data.panel.manifest.id, `page "${data.page.manifest.id}"`)
    : null) as SveltePanelComponent<Record<string, unknown>> | null
  type ChromeProperties = PanelChromeComponentProps<PanelPageProps['data']['page']>
  const TopbarComponent = $derived(data.panel.manifest.components?.topbar && registry
    ? registry.resolve<ChromeProperties>(data.panel.manifest.components.topbar, data.panel.manifest.id, 'panel topbar')
    : null) as SveltePanelComponent<ChromeProperties> | null
  const SidebarComponent = $derived(data.panel.manifest.components?.sidebar && registry
    ? registry.resolve<ChromeProperties>(data.panel.manifest.components.sidebar, data.panel.manifest.id, 'panel sidebar')
    : null) as SveltePanelComponent<ChromeProperties> | null
  const AvatarComponent = $derived(data.panel.manifest.branding.avatarProvider && registry
    ? registry.resolve<PanelAvatarComponentProps>(data.panel.manifest.branding.avatarProvider, data.panel.manifest.id, 'panel avatar provider')
    : null) as SveltePanelComponent<PanelAvatarComponentProps> | null
  const navigation = $derived(orderedNavigation([...data.panel.manifest.navigation].sort((left, right) => left.sort - right.sort || left.label.localeCompare(right.label))))
  const navigationSections = $derived(groupedNavigation(navigation))
  const account = $derived(actorLabel(data.panel.actor))
  const avatarUrl = $derived(actorAvatarUrl(data.panel.actor))
  const colorMode = $derived(selectedColorMode ?? data.panel.manifest.theme.darkMode)
  const themeMenuItems = $derived(data.panel.manifest.theme.switcher === false ? [] : [
    { id: 'panel-theme-light', label: `${colorMode === 'light' ? '✓ ' : ''}${translate('theme.light')}` },
    { id: 'panel-theme-dark', label: `${colorMode === 'dark' ? '✓ ' : ''}${translate('theme.dark')}` },
    { id: 'panel-theme-system', label: `${colorMode === 'system' ? '✓ ' : ''}${translate('theme.system')}` },
  ])
  const userMenuItems = $derived([
    ...themeMenuItems,
    ...(data.panel.manifest.auth?.profile && !data.panel.manifest.userMenu.some(item => item.id === 'profile') ? [{ icon: 'user', id: 'profile', label: translate('navigation.profile') }] : []),
    ...data.panel.manifest.userMenu.map(item => ({ icon: item.icon ? configuredIcon(item.icon) : null, id: item.id, label: item.label })),
    ...(data.panel.manifest.auth?.logout ? [{ icon: 'log-out', id: 'panel-logout', label: translate('navigation.signOut') }] : []),
  ])
  const globalSearchStore = $derived.by(() => data.panel.manifest.globalSearch ? new GlobalSearchStore({
    async search(term, signal) {
      const response = await browserTransport().execute({ kind: 'read', name: 'global-search' }, {
        endpoint: `/holo/panels/${encodeURIComponent(data.panel.manifest.id)}/global-search`,
        panelId: data.panel.manifest.id,
        payload: { term },
        signal,
      })
      if (!response.ok) throw new Error(response.error.message)
      return searchResponse(response.data, data.panel.manifest.id, term)
    },
  }, {
    debounceMilliseconds: data.panel.manifest.globalSearchConfiguration?.debounce,
    keybindings: data.panel.manifest.globalSearchConfiguration?.keybindings,
  }) : null)
  const headerWidgets = $derived(data.widgets.header.map(widget => ({
    actions: widget.actions,
    actionStore: createWidgetActionStore({ applyEffects: response => effects.apply(response), panelId: data.panel.manifest.id, resourceId: widget.resourceId, transport: browserTransport(), widgetId: widget.manifest.id }),
    manifest: widget.manifest as SvelteWidgetManifest,
    panelId: data.panel.manifest.id,
    placement: 'dashboard' as const,
    registry,
    store: new WidgetStore(widget.manifest, async () => widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status }, {
      initialResult: widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status },
    }),
  })))
  const footerWidgets = $derived(data.widgets.footer.map(widget => ({
    actions: widget.actions,
    actionStore: createWidgetActionStore({ applyEffects: response => effects.apply(response), panelId: data.panel.manifest.id, resourceId: widget.resourceId, transport: browserTransport(), widgetId: widget.manifest.id }),
    manifest: widget.manifest as SvelteWidgetManifest,
    panelId: data.panel.manifest.id,
    placement: 'dashboard' as const,
    registry,
    store: new WidgetStore(widget.manifest, async () => widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status }, {
      initialResult: widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status },
    }),
  })))

  $effect(() => {
    const widgets = [...headerWidgets, ...footerWidgets]
    return () => { for (const widget of widgets) while (widget.actionStore.activeFrame) widget.actionStore.close() }
  })

  function searchResponse(value: unknown, panelId: string, term: string): ClientSearchResponse {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Global search returned an invalid response')
    const source = value as Record<string, unknown>
    const results = Array.isArray(source.results) ? source.results.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return []
      const result = item as Record<string, unknown>
      if (typeof result.id !== 'string' || typeof result.resourceId !== 'string' || typeof result.title !== 'string' || typeof result.url !== 'string') return []
      const details = result.details && typeof result.details === 'object' && !Array.isArray(result.details)
        ? Object.fromEntries(Object.entries(result.details).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
        : {}
      return [{ actions: [], details, icon: typeof result.icon === 'string' ? result.icon : null, id: result.id, image: typeof result.image === 'string' ? result.image : null, resourceId: result.resourceId, title: result.title, url: result.url }]
    }) : []
    return Object.freeze({ panelId, results: Object.freeze(results), term })
  }

  function actorLabel(actor: Readonly<Record<string, unknown>>): string {
    for (const key of ['name', 'email', 'username']) {
      const value = actor[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return translate('navigation.account')
  }

  function actorAvatarUrl(actor: Readonly<Record<string, unknown>>): string | null {
    for (const key of ['avatarUrl', 'avatar_url', 'avatar', 'image']) {
      const value = actor[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return null
  }

  function configuredIcon(name: string): string {
    const configured = data.panel.manifest.icons?.[name]
    return typeof configured === 'string' && configured.trim() ? configured : name
  }

  function toggleNavigation(): void {
    if (data.panel.manifest.navigationMode === 'topbar') {
      navigationOpen = !navigationOpen
      return
    }
    if (data.panel.manifest.sidebarCollapsible) sidebarCollapsed = !sidebarCollapsed
  }

  type PanelNavigationItem = PanelPageProps['data']['panel']['manifest']['navigation'][number]
  type OrderedNavigationItem = Readonly<{ depth: number; item: PanelNavigationItem }>
  type NavigationSection = Readonly<{ entries: readonly OrderedNavigationItem[]; group: string | null }>

  function orderedNavigation(items: readonly PanelNavigationItem[]): readonly OrderedNavigationItem[] {
    const children = new Map<string | null, PanelNavigationItem[]>()
    for (const item of items) {
      const siblings = children.get(item.parent) ?? []
      siblings.push(item)
      children.set(item.parent, siblings)
    }
    const ordered: OrderedNavigationItem[] = []
    const append = (parent: string | null, depth: number): void => {
      for (const item of children.get(parent) ?? []) {
        ordered.push({ depth, item })
        append(item.id, depth + 1)
      }
    }
    append(null, 0)
    return ordered
  }

  function groupedNavigation(items: readonly OrderedNavigationItem[]): readonly NavigationSection[] {
    const sections: NavigationSection[] = []
    for (let index = 0; index < items.length;) {
      const current = items[index]!
      if (!current.item.group) {
        sections.push({ entries: [current], group: null })
        index += 1
        continue
      }
      const group = current.item.group
      const entries: OrderedNavigationItem[] = []
      while (index < items.length && items[index]!.item.group === group) {
        entries.push(items[index]!)
        index += 1
      }
      sections.push({ entries, group })
    }
    return sections
  }

  function isNavigationGroupCollapsible(group: string): boolean {
    if (data.panel.manifest.layout?.collapsibleNavigationGroups === false) return false
    return data.panel.manifest.navigationGroups?.find(candidate => candidate.label === group)?.collapsible !== false
  }

  function browserTransport(): PanelsTransport {
    return new PanelsTransport({
      adapter: {
        async send(request) {
          const response = await fetch(request.url, { body: request.body, credentials: request.credentials, headers: request.headers, method: request.method, signal: request.signal })
          const contents = await response.text()
          let responseBody: unknown
          try {
            responseBody = contents ? JSON.parse(contents) as unknown : undefined
          } catch {
            responseBody = contents
          }
          return { body: responseBody, status: response.status }
        },
      },
    })
  }

  async function navigate(url: string, replace = false): Promise<void> {
    await tick()
    await navigatePanelUrl(url, { enabled: data.panel.manifest.runtime?.spa !== false, exceptions: data.panel.manifest.runtime?.spaUrlExceptions ?? [], navigate: (path, replaceState) => goto(path, { replaceState }) }, replace)
  }

  function realtimeConnection(enabled: boolean, channel: string | null): ClientNotificationRealtime | undefined {
    if (
      typeof window === 'undefined'
      || !enabled
      || !channel
      || !notificationRealtime
      || channel !== channel.trim()
      || !REALTIME_CHANNEL.test(channel)
      || channel.startsWith('private-')
      || channel.startsWith('presence-')
    ) return undefined
    try {
      const realtime = notificationRealtime(channel)
      return {
        subscribe(invalidate) {
          try {
            return realtime.subscribe(invalidate)
          } catch {
            return () => undefined
          }
        },
      }
    } catch {
      return undefined
    }
  }

  $effect(() => {
    if (data.effects !== appliedEffects) {
      appliedEffects = data.effects
      effectBatch += 1
      void effects.apply({ data: null, effects: [...appliedEffects], id: `session-effects-${effectBatch}`, ok: true, protocolVersion: '1.0' }).catch(() => undefined)
    }
  })
  onMount(() => {
    const panelElement = shellElement
    if (!panelElement) throw new Error('Panel shell did not mount')
    const unregisterNotificationStore = registerPanelNotificationStore(data.panel.manifest.id, toastStore)
    const restoreDocumentLocale = syncDocumentLocale(data.panel, document)
    const storedColorMode = window.localStorage.getItem(`holo-panels:${data.panel.manifest.id}:color-mode`)
    if (isPanelColorMode(storedColorMode)) selectedColorMode = storedColorMode
    const updateWidth = (): void => { viewportWidth = window.innerWidth }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    const searchShortcut = (event: KeyboardEvent): void => {
      if (!globalSearchStore?.shortcut(event.key, { alt: event.altKey, ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey })) return
      event.preventDefault()
      window.document.querySelector<HTMLInputElement>('[data-panel-global-search]')?.focus()
    }
    window.addEventListener('keydown', searchShortcut)
    const runtime = data.panel.manifest.runtime
    const unregisterSpa = runtime?.spa !== false
      ? installPanelSpaNavigation(panelElement, {
          exceptions: runtime?.spaUrlExceptions ?? [],
          navigate: url => goto(url),
          prefetching: runtime?.spaPrefetching ?? false,
        })
      : undefined
    return () => {
      effects.dispose()
      unregisterNotificationStore()
      restoreDocumentLocale()
      unregisterSpa?.()
      window.removeEventListener('keydown', searchShortcut)
      window.removeEventListener('resize', updateWidth)
    }
  })

  function isPanelColorMode(value: string | null): value is PanelColorMode {
    return value === 'light' || value === 'dark' || value === 'system'
  }

  function selectUserMenuItem(id: string): void {
    const mode = id.replace('panel-theme-', '')
    if (isPanelColorMode(mode)) {
      selectedColorMode = mode
      window.localStorage.setItem(`holo-panels:${data.panel.manifest.id}:color-mode`, mode)
      return
    }
    if (id === 'profile' && data.panel.manifest.auth?.profile && !data.panel.manifest.userMenu.some(item => item.id === 'profile')) {
      void navigate(data.panel.manifest.auth.profile.path)
      return
    }
    if (id === 'panel-logout') {
      void executePanelAuthRequest({ csrfToken: '', operation: 'logout', panelId: data.panel.manifest.id, payload: {} }).then(result => {
        if (result.ok) window.location.assign(result.url ?? data.panel.manifest.auth?.login?.path ?? data.panel.manifest.path)
      })
      return
    }
    const item = data.panel.manifest.userMenu.find(candidate => candidate.id === id)
    if (item) void navigate(item.path)
  }
  $effect(() => {
    if (!globalSearchStore) {
      searchState = null
      return
    }
    return globalSearchStore.subscribe(state => { searchState = state })
  })
</script>

<svelte:head>
  <title>{data.page.title} · {data.panel.manifest.branding.name}</title>
  {#if data.panel.manifest.branding.favicon}<link rel="icon" href={data.panel.manifest.branding.favicon} />{/if}
  {#each data.panel.manifest.assets ?? [] as asset (asset.id)}
    {#if asset.type === 'css'}<link data-panel-asset={asset.id} href={asset.src} rel="stylesheet" />{:else}<script data-panel-asset={asset.id} defer src={asset.src}></script>{/if}
  {/each}
</svelte:head>

{#snippet accountMenu()}
  {#if data.panel.manifest.userMenuEnabled !== false}<DropdownMenu><DropdownMenuTrigger>{#snippet child({ props })}<Button {...props} aria-label={translate('navigation.accountMenu')} class="hp-panel-user-trigger hp-panel-user-action hp-panel-action--compact" variant="outline">{#if AvatarComponent}<AvatarComponent actor={data.panel.actor} label={account} />{:else}<Avatar class="hp-panel-user-glyph hp:size-6">{#if avatarUrl}<AvatarImage alt={account} src={avatarUrl} />{/if}<AvatarFallback>{account.slice(0, 2).toLocaleUpperCase()}</AvatarFallback></Avatar>{/if}<span>{account}</span><Icon aria-hidden="true" name="chevrons-up-down" /></Button>{/snippet}</DropdownMenuTrigger><DropdownMenuContent align="end" data-holo-panel>{#each userMenuItems as item (item.id)}<DropdownMenuItem variant={item.id === 'panel-logout' ? 'destructive' : 'default'} onSelect={() => selectUserMenuItem(item.id)}>{#if 'icon' in item && item.icon}<Icon name={item.icon} />{/if}{item.label}</DropdownMenuItem>{/each}</DropdownMenuContent></DropdownMenu>{/if}
{/snippet}

<SidebarProvider open={!sidebarCollapsed} onOpenChange={(open) => { sidebarCollapsed = !open }}>
<div
  bind:this={shellElement}
  class="hp-panel hp-panel-shell hp:grid hp:min-h-svh hp:w-full hp:grid-cols-[auto_minmax(0,1fr)] hp:grid-rows-[auto_minmax(0,1fr)]"
  data-holo-panel
  data-navigation={data.panel.manifest.navigationMode}
  data-navigation-open={navigationOpen}
  data-panel-id={data.panel.manifest.id}
  data-sidebar-collapsed={sidebarCollapsed}
  data-sidebar-collapsible={data.panel.manifest.sidebarCollapsible}
  data-sidebar-fully-collapsible={data.panel.manifest.layout?.sidebarFullyCollapsible ?? false}
  data-theme={colorMode}
  data-density={data.panel.manifest.theme.density}
  data-width={data.panel.manifest.layout?.maxContentWidth === 'full' ? 'full' : 'constrained'}
  dir={data.panel.direction}
  lang={data.panel.locale}
  style={panelConfigurationStyleAttribute(data.panel.manifest)}
>
  <PanelsRenderHookRenderer hook={PanelsRenderHook.BODY_START} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
  <PanelsRenderHookRenderer hook={PanelsRenderHook.LAYOUT_START} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
  <PanelsRenderHookRenderer hook={PanelsRenderHook.TOPBAR_BEFORE} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
  {#if data.panel.manifest.layout?.topbar !== false}
  {#if TopbarComponent}<TopbarComponent actor={data.panel.actor} manifest={data.panel.manifest} page={data.page} />{:else}<header class="hp-panel-header hp:sticky hp:top-0 hp:z-20 hp:col-start-2 hp:row-start-1 hp:flex hp:h-16 hp:min-w-0 hp:items-center hp:gap-2 hp:border-b hp:bg-background hp:px-4">
    <PanelsRenderHookRenderer hook={PanelsRenderHook.TOPBAR_START} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    {#if data.panel.manifest.navigationEnabled !== false}{#if data.panel.manifest.navigationMode === 'sidebar' && !SidebarComponent}<SidebarTrigger aria-label="Toggle navigation" class="hp-panel-navigation-toggle hp-panel-topbar-start-action" id={navigationToggleId} />{:else}<Button aria-controls={navigationId} aria-expanded={navigationOpen} aria-label="Toggle navigation" class="hp-panel-navigation-toggle hp-panel-topbar-start-action" id={navigationToggleId} onclick={toggleNavigation} size="icon" type="button" variant="ghost"><Icon aria-hidden="true" name="menu" /></Button>{/if}{/if}
    <PanelsRenderHookRenderer hook={PanelsRenderHook.TOPBAR_LOGO_BEFORE} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <Button class={`hp-panel-brand hp-panel-topbar-start${data.panel.manifest.navigationMode === 'sidebar' ? ' hp-panel-navigation-header' : ''}`} href={data.panel.manifest.routing?.homeUrl ?? data.panel.manifest.path} variant="ghost">{#if data.panel.manifest.branding.logo}<img alt="" src={data.panel.manifest.branding.logo} />{:else}<span aria-hidden="true" class="hp-panel-brand-mark">H</span>{/if}<strong>{data.panel.manifest.branding.name}</strong></Button>
    <PanelsRenderHookRenderer hook={PanelsRenderHook.TOPBAR_LOGO_AFTER} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    {#if data.panel.manifest.navigationEnabled !== false && data.panel.manifest.navigationMode === 'topbar'}
      <nav aria-label="Panel navigation" class="hp-panel-navigation hp-panel-navigation--topbar hp-panel-navigation-body hp-panel-topbar-center" data-open={navigationOpen} id={navigationId}>
        {#each navigation as entry (entry.item.id)}
          <Button aria-current={data.page.manifest.path === entry.item.path ? 'page' : undefined} href={entry.item.path} onclick={() => { navigationOpen = false }} style={`--hp-navigation-depth:${entry.depth}`} variant="ghost">
            {#if entry.item.icon}<Icon aria-hidden="true" class="hp-panel-icon" name={configuredIcon(entry.item.icon)} />{/if}
            <span>{entry.item.label}</span>
            {#if entry.item.badge}<Badge variant="secondary">{entry.item.badge}</Badge>{/if}
          </Button>
        {/each}
      </nav>
    {/if}
    <PanelsRenderHookRenderer hook={PanelsRenderHook.GLOBAL_SEARCH_BEFORE} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    {#if globalSearchStore && searchState}
      <div class="hp-global-search hp-panel-topbar-center hp:relative hp:w-full hp:max-w-md" role="search">
        <PanelsRenderHookRenderer hook={PanelsRenderHook.GLOBAL_SEARCH_START} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
        <InputGroup><InputGroupAddon><Icon name="search" /></InputGroupAddon><InputGroupInput aria-controls="hp-global-search-results" aria-expanded={searchState.open} aria-label={translate('search.label')} data-panel-global-search="" placeholder={translate('search.placeholder')} role="combobox" value={searchState.term} onfocus={() => globalSearchStore?.open()} oninput={(event) => globalSearchStore?.input(event.currentTarget.value)} onkeydown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') globalSearchStore?.move(event.key === 'ArrowDown' ? 1 : -1)
          else if (event.key === 'Enter') {
            const url = globalSearchStore?.selectedUrl()
            if (url) void navigate(url)
          } else if (event.key === 'Escape') globalSearchStore?.close()
        }} />{#if data.panel.manifest.globalSearchConfiguration?.fieldSuffix}<InputGroupAddon align="inline-end">{data.panel.manifest.globalSearchConfiguration.fieldSuffix}</InputGroupAddon>{/if}{#if data.panel.manifest.globalSearchConfiguration?.keybindingSuffix}<InputGroupAddon align="inline-end"><kbd class="hp:rounded hp:border hp:bg-muted hp:px-1.5 hp:text-xs hp:text-muted-foreground">{data.panel.manifest.globalSearchConfiguration.keybindingSuffix}</kbd></InputGroupAddon>{/if}</InputGroup>
        {#if searchState.open && searchState.term}<Command class="hp:absolute hp:left-0 hp:top-full hp:z-50 hp:mt-2 hp:w-full hp:rounded-md hp:border hp:bg-popover hp:shadow-md"><CommandList id="hp-global-search-results">{#if searchState.loading}<CommandEmpty>{translate('search.loading')}</CommandEmpty>{:else if searchState.error}<CommandEmpty>{searchState.error}</CommandEmpty>{:else if searchState.results.length === 0}<CommandEmpty>{translate('search.none')}</CommandEmpty>{/if}{#each searchState.results as result, index (`${result.resourceId}:${result.id}`)}<CommandItem aria-selected={index === searchState.selectedIndex} value={result.title} onclick={() => void navigate(result.url)}>{result.title}</CommandItem>{/each}</CommandList></Command>{/if}
        <PanelsRenderHookRenderer hook={PanelsRenderHook.GLOBAL_SEARCH_END} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
      </div>
    {/if}
    <PanelsRenderHookRenderer hook={PanelsRenderHook.GLOBAL_SEARCH_AFTER} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <div class="hp-panel-header-actions hp-panel-topbar-end hp-panel-actions--compact">
      {#if notificationStore && notificationConfiguration?.placement === 'topbar'}
        <div class="hp-panel-notification-action hp-panel-action--compact"><NotificationTrigger emptyMessage={translate('notifications.empty')} label={translate('notifications.label')} lazy={notificationConfiguration.lazy ?? true} locale={data.panel.locale} navigate={navigate} panelId={data.panel.manifest.id} placement="topbar" {registry} store={notificationStore} /></div>
      {/if}
      {#if data.panel.manifest.navigationMode === 'topbar' && data.panel.tenancy && data.panel.manifest.tenancy?.switcher !== false}<div class="hp-panel-tenant-action hp-panel-action--compact"><SvelteTenantSwitcher shell={{ onSwitched: () => window.location.reload(), store: tenantStore, transport: tenantTransport }} /></div>{/if}
      {#if data.panel.manifest.navigationMode === 'topbar'}{@render accountMenu()}{/if}
    </div>
    <PanelsRenderHookRenderer hook={PanelsRenderHook.TOPBAR_END} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
  </header>{/if}
  {/if}
  <PanelsRenderHookRenderer hook={PanelsRenderHook.TOPBAR_AFTER} manifest={data.panel.manifest} {registry} scopes={pageScopes} />

  {#if data.panel.manifest.navigationEnabled !== false && data.panel.manifest.navigationMode === 'sidebar'}
  {#if SidebarComponent}<SidebarComponent actor={data.panel.actor} manifest={data.panel.manifest} page={data.page} />{:else}<Sidebar class="hp-panel-sidebar" collapsible={data.panel.manifest.sidebarCollapsible ? (data.panel.manifest.layout?.sidebarFullyCollapsible ? 'offcanvas' : 'icon') : 'none'} side={data.panel.direction === 'rtl' ? 'right' : 'left'}>
    <SidebarHeader><Button class="hp-panel-brand hp:w-full hp:justify-start" href={data.panel.manifest.routing?.homeUrl ?? data.panel.manifest.path} variant="ghost">{#if data.panel.manifest.branding.logo}<img alt="" src={data.panel.manifest.branding.logo} />{:else}<span aria-hidden="true" class="hp-panel-brand-mark">H</span>{/if}<strong>{data.panel.manifest.branding.name}</strong></Button>{#if data.panel.tenancy && data.panel.manifest.tenancy?.switcher !== false}<div class="hp-panel-tenant-action"><SvelteTenantSwitcher shell={{ onSwitched: () => window.location.reload(), store: tenantStore, transport: tenantTransport }} /></div>{/if}</SidebarHeader>
    <PanelsRenderHookRenderer hook={PanelsRenderHook.SIDEBAR_START} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <PanelsRenderHookRenderer hook={PanelsRenderHook.SIDEBAR_NAV_START} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <SidebarContent><nav aria-label="Panel navigation" class="hp-panel-navigation hp-panel-navigation-body" id={navigationId}>
      {#each navigationSections as section, index (`${section.group ?? 'item'}:${index}`)}
        <Collapsible open={true}>
          <SidebarGroup>
            {#if section.group}{#if isNavigationGroupCollapsible(section.group)}<CollapsibleTrigger>{#snippet child({ props })}<SidebarGroupLabel {...props}>{section.group}</SidebarGroupLabel>{/snippet}</CollapsibleTrigger>{:else}<SidebarGroupLabel>{section.group}</SidebarGroupLabel>{/if}{/if}
            <CollapsibleContent><SidebarGroupContent><SidebarMenu>
              {#each section.entries as entry (entry.item.id)}
                <SidebarMenuItem><SidebarMenuButton isActive={data.page.manifest.path === entry.item.path} tooltipContent={entry.item.label}>{#snippet child({ props })}<a {...props} aria-current={data.page.manifest.path === entry.item.path ? 'page' : undefined} href={entry.item.path} onclick={() => { navigationOpen = false }}>{#if entry.item.icon}<Icon aria-hidden="true" name={configuredIcon(entry.item.icon)} />{/if}<span>{entry.item.label}</span>{#if entry.item.badge}<SidebarMenuBadge>{entry.item.badge}</SidebarMenuBadge>{/if}</a>{/snippet}</SidebarMenuButton></SidebarMenuItem>
              {/each}
            </SidebarMenu></SidebarGroupContent></CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      {/each}
    </nav></SidebarContent>
    <PanelsRenderHookRenderer hook={PanelsRenderHook.SIDEBAR_NAV_END} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <SidebarFooter>{#if notificationStore && notificationConfiguration?.placement === 'sidebar'}<NotificationTrigger emptyMessage={translate('notifications.empty')} label={translate('notifications.label')} lazy={notificationConfiguration.lazy ?? true} locale={data.panel.locale} navigate={navigate} panelId={data.panel.manifest.id} placement="sidebar" {registry} store={notificationStore} />{/if}{@render accountMenu()}<PanelsRenderHookRenderer hook={PanelsRenderHook.SIDEBAR_FOOTER} manifest={data.panel.manifest} {registry} scopes={pageScopes} /></SidebarFooter>
  </Sidebar>{/if}
  {/if}

  <PanelsRenderHookRenderer hook={PanelsRenderHook.CONTENT_BEFORE} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
  <SidebarInset class="hp-panel-content hp:col-start-2 hp:row-start-2 hp:mx-auto hp:flex hp:w-full hp:min-w-0 hp:flex-col hp:gap-6 hp:p-4 hp:pt-6 hp:md:p-6" style="max-width: var(--hp-content-max-width)">
    <PanelsRenderHookRenderer hook={PanelsRenderHook.CONTENT_START} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_START} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <header class="hp-panel-page-header hp-panel-main-header hp:flex hp:flex-col hp:gap-4 hp:sm:flex-row hp:sm:items-center hp:sm:justify-between"><div class="hp-panel-page-heading hp:space-y-1">{#if data.panel.manifest.layout?.breadcrumbs !== false && data.page.breadcrumbs.length > 0}<Breadcrumb class="hp-panel-breadcrumbs"><BreadcrumbList>{#each data.page.breadcrumbs as breadcrumb, index (breadcrumb.path)}<BreadcrumbItem>{#if index === data.page.breadcrumbs.length - 1}<BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>{:else}<BreadcrumbLink href={breadcrumb.path}>{breadcrumb.label}</BreadcrumbLink>{/if}</BreadcrumbItem>{#if index < data.page.breadcrumbs.length - 1}<BreadcrumbSeparator />{/if}{/each}</BreadcrumbList></Breadcrumb>{/if}<PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_HEADER_HEADING_BEFORE} manifest={data.panel.manifest} {registry} scopes={pageScopes} /><h1 class="hp:text-3xl hp:font-bold hp:tracking-tight">{data.page.heading ?? data.page.title}</h1>
    {#if data.page.subheading}<p class="hp:text-muted-foreground">{data.page.subheading}</p>{/if}<PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_HEADER_HEADING_AFTER} manifest={data.panel.manifest} {registry} scopes={pageScopes} /></div><div aria-label="Page actions" class="hp-panel-page-actions hp:flex hp:flex-wrap hp:items-center hp:justify-end hp:gap-2" role="group"><PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_HEADER_ACTIONS_BEFORE} manifest={data.panel.manifest} {registry} scopes={pageScopes} /><div bind:this={pageActionsElement} class="hp:contents"></div><PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_HEADER_ACTIONS_AFTER} manifest={data.panel.manifest} {registry} scopes={pageScopes} /></div></header>
    <div class="hp-panel-main-body hp:flex hp:flex-col hp:gap-6">
    <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_HEADER_WIDGETS_BEFORE} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_HEADER_WIDGETS_START} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    {#if headerWidgets.length > 0}
      <DashboardRenderer label="Page header widgets" widgets={headerWidgets} width={viewportWidth} />
    {/if}
    <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_HEADER_WIDGETS_END} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_HEADER_WIDGETS_AFTER} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    {#if resourceBody}
      <ResourcePage {data} {effects} pageActionsTarget={pageActionsElement} {registry} />
    {:else if Body && body}
      <Body {...body.properties} />
    {:else if ['create', 'edit', 'list', 'manage', 'view'].includes(data.page.manifest.pageType)}
      <ResourcePage {data} {effects} pageActionsTarget={pageActionsElement} {registry} />
    {:else if data.page.schema}
      <section aria-label={data.page.title} data-panels-schema={data.page.manifest.schemaId}></section>
    {:else if headerWidgets.length === 0 && footerWidgets.length === 0}
      <Empty><EmptyHeader><EmptyTitle>{data.page.title}</EmptyTitle><EmptyDescription>This page has no configured content.</EmptyDescription></EmptyHeader></Empty>
    {/if}
    <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_FOOTER_WIDGETS_BEFORE} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_FOOTER_WIDGETS_START} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    {#if footerWidgets.length > 0}
      <DashboardRenderer label="Page footer widgets" widgets={footerWidgets} width={viewportWidth} />
    {/if}
    <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_FOOTER_WIDGETS_END} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_FOOTER_WIDGETS_AFTER} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    </div>
    <PanelsRenderHookRenderer data={data.page.data} hook={PanelsRenderHook.PAGE_END} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
    <PanelsRenderHookRenderer hook={PanelsRenderHook.CONTENT_END} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
  </SidebarInset>
  <PanelsRenderHookRenderer hook={PanelsRenderHook.CONTENT_AFTER} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
  <PanelsRenderHookRenderer hook={PanelsRenderHook.FOOTER} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
  <SvelteNotificationToastViewport navigate={navigate} panelId={data.panel.manifest.id} {registry} store={toastStore} />
  <PanelsRenderHookRenderer hook={PanelsRenderHook.LAYOUT_END} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
  <PanelsRenderHookRenderer hook={PanelsRenderHook.BODY_END} manifest={data.panel.manifest} {registry} scopes={pageScopes} />
</div>
</SidebarProvider>
