<script lang="ts">
  import { onMount, tick, untrack } from 'svelte'
  import {
    ClientEffectSession,
    ClientNotificationInboxStore,
    ClientToastStore,
    GlobalSearchStore,
    installPanelSpaNavigation,
    DashboardRenderer,
    PanelsAvatar,
    PanelsBadge,
    PanelsDropdown,
    PanelsEmptyState,
    PanelsLink,
    PanelsTransport,
    PanelShellStore,
    WidgetStore,
    panelConfigurationStyleAttribute,
    SvelteNotificationInboxTrigger,
    SvelteNotificationToastViewport,
    SvelteTenantSwitcher,
    createPanelNotificationTransport,
    createPanelTenantSwitcherTransport,
    executePanelAuthRequest,
    type ClientNotificationRealtime,
    type ClientSearchResponse,
    type ClientSearchState,
    type PanelAvatarComponentProps,
    type PanelChromeComponentProps,
    type SvelteNotificationInboxTriggerProps,
    type SveltePanelComponent,
    type SvelteWidgetManifest,
  } from '@holo-js/panels-svelte'
  import type { PanelPageProps } from './contracts'
  import ResourcePage from './ResourcePage.svelte'
  import Button from './Button.svelte'
  import Input from './Input.svelte'
  import Icon from './Icon.svelte'

  const REALTIME_CHANNEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u
  type PanelColorMode = 'light' | 'dark' | 'system'

  let { data, notificationRealtime, registry }: PanelPageProps = $props()
  let searchState = $state<ClientSearchState | null>(null)
  let viewportWidth = $state(1280)
  let navigationOpen = $state(false)
  let sidebarCollapsed = $state(false)
  let selectedColorMode = $state<PanelColorMode | null>(null)
  let shellElement: HTMLDivElement
  const initialPanelId = untrack(() => data.panel.manifest.id)
  const tenantStore = new PanelShellStore(initialPanelId)
  const tenantTransport = createPanelTenantSwitcherTransport(browserTransport(), initialPanelId)
  tenantStore.bootstrap(untrack(() => data.panel), untrack(() => data.page.manifest.path))
  const notificationConfiguration = $derived(data.panel.manifest.databaseNotifications)
  const NotificationTrigger = $derived(notificationConfiguration?.component && registry
    ? registry.resolve<SvelteNotificationInboxTriggerProps>(notificationConfiguration.component, data.panel.manifest.id, 'database notification component')
    : SvelteNotificationInboxTrigger) as SveltePanelComponent<SvelteNotificationInboxTriggerProps>
  const clientSession = $derived.by(() => {
    const toastStore = new ClientToastStore()
    const effects = new ClientEffectSession({
      panelId: data.panel.manifest.id,
      redirect: effect => navigate(effect.url, effect.replace),
      toastStore,
    })
    void effects.apply({ data: null, effects: [...data.effects], id: 'session-effects', ok: true, protocolVersion: '1.0' }).catch(() => undefined)
    return { effects, toastStore }
  })
  const effects = $derived(clientSession.effects)
  const toastStore = $derived(clientSession.toastStore)
  const notificationStore = $derived.by(() => notificationConfiguration
    ? new ClientNotificationInboxStore({
        polling: notificationConfiguration.polling,
        realtime: realtimeConnection(notificationConfiguration.realtime, data.panel.notifications?.realtimeChannel ?? null),
        transport: createPanelNotificationTransport(browserTransport(), {
          endpoint: `/holo/panels/${data.panel.manifest.id}/notification`,
          panelId: data.panel.manifest.id,
        }),
      })
    : null)
  const body = $derived(data.page.manifest.body)
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
  const colorMode = $derived(selectedColorMode ?? data.panel.manifest.theme.darkMode)
  const themeMenuItems = $derived(data.panel.manifest.theme.switcher === false ? [] : [
    { id: 'panel-theme-light', label: `${colorMode === 'light' ? '✓ ' : ''}Light theme` },
    { id: 'panel-theme-dark', label: `${colorMode === 'dark' ? '✓ ' : ''}Dark theme` },
    { id: 'panel-theme-system', label: `${colorMode === 'system' ? '✓ ' : ''}System theme` },
  ])
  const userMenuItems = $derived([
    ...themeMenuItems,
    ...(data.panel.manifest.auth?.profile && !data.panel.manifest.userMenu.some(item => item.id === 'profile') ? [{ icon: 'user', id: 'profile', label: 'Profile' }] : []),
    ...data.panel.manifest.userMenu.map(item => ({ icon: item.icon ? configuredIcon(item.icon) : null, id: item.id, label: item.label })),
    ...(data.panel.manifest.auth?.logout ? [{ icon: 'log-out', id: 'panel-logout', label: 'Sign out' }] : []),
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
    manifest: widget.manifest as SvelteWidgetManifest,
    panelId: data.panel.manifest.id,
    placement: 'dashboard' as const,
    registry,
    store: new WidgetStore(widget.manifest, async () => widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status }, {
      initialResult: widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status },
    }),
  })))
  const footerWidgets = $derived(data.widgets.footer.map(widget => ({
    manifest: widget.manifest as SvelteWidgetManifest,
    panelId: data.panel.manifest.id,
    placement: 'dashboard' as const,
    registry,
    store: new WidgetStore(widget.manifest, async () => widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status }, {
      initialResult: widget.data === null ? { status: widget.status } : { data: widget.data, status: widget.status },
    }),
  })))

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
    return 'Account'
  }

  function configuredIcon(name: string): string {
    const configured = data.panel.manifest.icons?.[name]
    return typeof configured === 'string' && configured.trim() ? configured : name
  }

  function toggleNavigation(): void {
    if (viewportWidth <= 768 || data.panel.manifest.navigationMode === 'topbar') {
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
    if (replace) globalThis.location.replace(url)
    else globalThis.location.assign(url)
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

  $effect(() => () => effects.dispose())
  onMount(() => {
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
    const unregisterSpa = runtime?.spa
      ? installPanelSpaNavigation(shellElement, {
          exceptions: runtime.spaUrlExceptions,
          navigate: url => {
            window.history.pushState({}, '', url)
            window.dispatchEvent(new PopStateEvent('popstate'))
          },
          prefetching: runtime.spaPrefetching ?? false,
        })
      : undefined
    return () => {
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

<div
  bind:this={shellElement}
  class="hp-panel hp-panel-shell"
  data-holo-panel
  data-navigation={data.panel.manifest.navigationMode}
  data-panel-id={data.panel.manifest.id}
  data-sidebar-collapsed={sidebarCollapsed}
  data-sidebar-collapsible={data.panel.manifest.sidebarCollapsible}
  data-sidebar-fully-collapsible={data.panel.manifest.layout?.sidebarFullyCollapsible ?? false}
  data-slot="sidebar-wrapper"
  data-theme={colorMode}
  data-density={data.panel.manifest.theme.density}
  data-width={data.panel.manifest.layout?.maxContentWidth === 'full' ? 'full' : 'constrained'}
  style={panelConfigurationStyleAttribute(data.panel.manifest)}
>
  {#if data.panel.manifest.layout?.topbar !== false}
  {#if TopbarComponent}<TopbarComponent actor={data.panel.actor} manifest={data.panel.manifest} page={data.page} />{:else}<header class="hp-panel-header">
    {#if data.panel.manifest.navigationEnabled !== false}<Button aria-expanded={navigationOpen || !sidebarCollapsed} aria-label="Toggle navigation" class="hp-panel-navigation-toggle" data-variant="ghost" onclick={toggleNavigation} type="button"><Icon aria-hidden="true" name="menu" /></Button>{/if}
    <PanelsLink class="hp-panel-brand" href={data.panel.manifest.routing?.homeUrl ?? data.panel.manifest.path}>{#if data.panel.manifest.branding.logo}<img alt="" src={data.panel.manifest.branding.logo} />{:else}<span aria-hidden="true" class="hp-panel-brand-mark">H</span>{/if}<strong>{data.panel.manifest.branding.name}</strong></PanelsLink>
    {#if data.panel.manifest.navigationEnabled !== false && data.panel.manifest.navigationMode === 'topbar'}
      <nav aria-label="Panel navigation" class="hp-panel-navigation hp-panel-navigation--topbar" data-open={navigationOpen}>
        {#each navigation as entry (entry.item.id)}
          <PanelsLink current={data.page.manifest.path === entry.item.path} data-slot="sidebar-menu-button" href={entry.item.path} onclick={() => { navigationOpen = false }} style={`--hp-navigation-depth:${entry.depth}`}>
            {#if entry.item.icon}<Icon aria-hidden="true" class="hp-panel-icon" name={configuredIcon(entry.item.icon)} />{/if}
            <span>{entry.item.label}</span>
            {#if entry.item.badge}<PanelsBadge>{entry.item.badge}</PanelsBadge>{/if}
          </PanelsLink>
        {/each}
      </nav>
    {/if}
    {#if globalSearchStore && searchState}
      <div class="hp-global-search" data-slot="command" role="search">
        <label><span class="hp-sr-only">Global search</span><Icon aria-hidden="true" class="hp-global-search-icon" name="search" /><Input aria-controls="hp-global-search-results" aria-expanded={searchState.open} data-panel-global-search="" placeholder={data.panel.manifest.globalSearchConfiguration?.fieldSuffix ?? 'Search…'} role="combobox" value={searchState.term} onfocus={() => globalSearchStore?.open()} oninput={(event) => globalSearchStore?.input(event.currentTarget.value)} onkeydown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') globalSearchStore?.move(event.key === 'ArrowDown' ? 1 : -1)
          else if (event.key === 'Enter') {
            const url = globalSearchStore?.selectedUrl()
            if (url) void navigate(url)
          } else if (event.key === 'Escape') globalSearchStore?.close()
        }} />{#if data.panel.manifest.globalSearchConfiguration?.keybindingSuffix}<kbd>{data.panel.manifest.globalSearchConfiguration.keybindingSuffix}</kbd>{/if}</label>
        {#if searchState.loading}<span aria-live="polite" role="status">Searching…</span>{/if}
        {#if searchState.error}<span role="alert">{searchState.error}</span>{/if}
        <ul data-slot="command-list" id="hp-global-search-results" role="listbox">{#each searchState.results as result, index (`${result.resourceId}:${result.id}`)}<li aria-selected={index === searchState.selectedIndex} data-slot="command-item" role="option"><a href={result.url}>{result.title}</a></li>{/each}</ul>
      </div>
    {/if}
    {#if notificationStore && notificationConfiguration?.placement === 'topbar'}
      <NotificationTrigger lazy={notificationConfiguration.lazy ?? true} navigate={navigate} panelId={data.panel.manifest.id} placement="topbar" {registry} store={notificationStore} />
    {/if}
    <div class="hp-panel-header-actions">
      <SvelteTenantSwitcher shell={{ onSwitched: () => window.location.reload(), store: tenantStore, transport: tenantTransport }} />
      {#if data.panel.manifest.userMenuEnabled !== false}<div class="hp-panel-user-trigger">{#if AvatarComponent}<AvatarComponent actor={data.panel.actor} label={account} />{:else}<PanelsAvatar alt={account} fallback={account.slice(0, 2).toUpperCase()} />{/if}<PanelsDropdown items={userMenuItems} label={account} onselect={selectUserMenuItem} /></div>{/if}
    </div>
  </header>{/if}
  {/if}

  {#if data.panel.manifest.navigationEnabled !== false && data.panel.manifest.navigationMode === 'sidebar'}
  {#if SidebarComponent}<SidebarComponent actor={data.panel.actor} manifest={data.panel.manifest} page={data.page} />{:else}<nav aria-label="Panel navigation" class="hp-panel-navigation" data-open={navigationOpen} data-slot="sidebar">
    {#each navigationSections as section, index (`${section.group ?? 'item'}:${index}`)}
      {#if section.group}<details class="hp-panel-navigation-section" data-collapsible={isNavigationGroupCollapsible(section.group)} open><summary aria-disabled={!isNavigationGroupCollapsible(section.group)} class="hp-panel-navigation-group" onclick={(event) => { if (!isNavigationGroupCollapsible(section.group!)) event.preventDefault() }}>{section.group}</summary>
        {#each section.entries as entry (entry.item.id)}
          <PanelsLink current={data.page.manifest.path === entry.item.path} data-slot="sidebar-menu-button" href={entry.item.path} onclick={() => { navigationOpen = false }} style={`--hp-navigation-depth:${entry.depth}`}>
            {#if entry.item.icon}<Icon aria-hidden="true" class="hp-panel-icon" name={configuredIcon(entry.item.icon)} />{/if}
            <span>{entry.item.label}</span>
            {#if entry.item.badge}<PanelsBadge>{entry.item.badge}</PanelsBadge>{/if}
          </PanelsLink>
        {/each}
      </details>{:else}
        {@const entry = section.entries[0]!}
        <PanelsLink current={data.page.manifest.path === entry.item.path} data-slot="sidebar-menu-button" href={entry.item.path} onclick={() => { navigationOpen = false }} style={`--hp-navigation-depth:${entry.depth}`}>
          {#if entry.item.icon}<Icon aria-hidden="true" class="hp-panel-icon" name={configuredIcon(entry.item.icon)} />{/if}
          <span>{entry.item.label}</span>
          {#if entry.item.badge}<PanelsBadge>{entry.item.badge}</PanelsBadge>{/if}
        </PanelsLink>
      {/if}
    {/each}
    {#if notificationStore && notificationConfiguration?.placement === 'sidebar'}
      <NotificationTrigger lazy={notificationConfiguration.lazy ?? true} navigate={navigate} panelId={data.panel.manifest.id} placement="sidebar" {registry} store={notificationStore} />
    {/if}
  </nav>{/if}
  {/if}

  <main class="hp-panel-content" data-slot="sidebar-inset">
    {#if data.panel.manifest.layout?.breadcrumbs !== false && data.page.breadcrumbs.length > 0}
      <nav aria-label="Breadcrumbs" class="hp-panel-breadcrumbs">
        <ol>{#each data.page.breadcrumbs as breadcrumb}<li><PanelsLink href={breadcrumb.path}>{breadcrumb.label}</PanelsLink></li>{/each}</ol>
      </nav>
    {/if}
    <header class="hp-panel-page-header"><div><h1>{data.page.heading ?? data.page.title}</h1>
    {#if data.page.subheading}<p>{data.page.subheading}</p>{/if}</div></header>
    {#if headerWidgets.length > 0}
      <DashboardRenderer label="Page header widgets" widgets={headerWidgets} width={viewportWidth} />
    {/if}
    {#if resourceBody}
      <ResourcePage {data} {effects} />
    {:else if Body && body}
      <Body {...body.properties} />
    {:else if ['create', 'edit', 'list', 'view'].includes(data.page.manifest.pageType)}
      <ResourcePage {data} {effects} />
    {:else if data.page.schema}
      <section aria-label={data.page.title} data-panels-schema={data.page.manifest.schemaId}></section>
    {:else if headerWidgets.length === 0 && footerWidgets.length === 0}
      <PanelsEmptyState heading={data.page.title} description="This page has no configured content." />
    {/if}
    {#if footerWidgets.length > 0}
      <DashboardRenderer label="Page footer widgets" widgets={footerWidgets} width={viewportWidth} />
    {/if}
  </main>
  <SvelteNotificationToastViewport navigate={navigate} store={toastStore} />
</div>
