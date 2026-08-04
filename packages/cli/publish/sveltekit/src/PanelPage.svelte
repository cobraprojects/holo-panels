<script lang="ts">
  import { tick } from 'svelte'
  import {
    ClientEffectSession,
    ClientNotificationInboxStore,
    ClientToastStore,
    PanelsBadge,
    PanelsEmptyState,
    PanelsLink,
    PanelsTransport,
    SvelteNotificationInboxTrigger,
    SvelteNotificationToastViewport,
    createPanelNotificationTransport,
    type ClientNotificationRealtime,
    type SveltePanelComponent,
  } from '@holo-js/panels-svelte'
  import type { PanelPageProps } from './contracts'
  import ResourcePage from './ResourcePage.svelte'

  const REALTIME_CHANNEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u

  let { data, notificationRealtime, registry }: PanelPageProps = $props()
  const notificationConfiguration = $derived(data.panel.manifest.databaseNotifications)
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
          endpoint: `/_holo/panels/${data.panel.manifest.id}/notification`,
          panelId: data.panel.manifest.id,
        }),
      })
    : null)
  const body = $derived(data.page.manifest.body)
  const Body = $derived(body && registry
    ? registry.resolve<Record<string, unknown>>(body.component, data.panel.manifest.id, `page "${data.page.manifest.id}"`)
    : null) as SveltePanelComponent<Record<string, unknown>> | null
  const navigation = $derived([...data.panel.manifest.navigation].sort((left, right) => left.sort - right.sort || left.label.localeCompare(right.label)))

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
</script>

<svelte:head>
  <title>{data.page.title} · {data.panel.manifest.branding.name}</title>
  {#if data.panel.manifest.branding.favicon}<link rel="icon" href={data.panel.manifest.branding.favicon} />{/if}
</svelte:head>

<div
  class="hp-panel-shell"
  data-navigation={data.panel.manifest.navigationMode}
  data-panel-id={data.panel.manifest.id}
  data-theme={data.panel.manifest.theme.darkMode}
>
  <header class="hp-panel-header">
    {#if data.panel.manifest.branding.logo}<img alt="" src={data.panel.manifest.branding.logo} />{/if}
    <strong>{data.panel.manifest.branding.name}</strong>
    {#if notificationStore && notificationConfiguration?.placement === 'topbar'}
      <SvelteNotificationInboxTrigger navigate={navigate} panelId={data.panel.manifest.id} placement="topbar" {registry} store={notificationStore} />
    {/if}
    <nav aria-label="User menu">
      {#each data.panel.manifest.userMenu as item (item.id)}
        <PanelsLink href={item.path}>{item.label}</PanelsLink>
      {/each}
    </nav>
  </header>

  <nav aria-label="Panel navigation" class="hp-panel-navigation">
    {#each navigation as item (item.id)}
      <PanelsLink current={data.page.manifest.path === item.path} href={item.path}>
        {item.label}
        {#if item.badge}<PanelsBadge>{item.badge}</PanelsBadge>{/if}
      </PanelsLink>
    {/each}
    {#if notificationStore && notificationConfiguration?.placement === 'sidebar'}
      <SvelteNotificationInboxTrigger navigate={navigate} panelId={data.panel.manifest.id} placement="sidebar" {registry} store={notificationStore} />
    {/if}
  </nav>

  <main class="hp-panel-content">
    {#if data.page.breadcrumbs.length > 0}
      <nav aria-label="Breadcrumbs">
        <ol>{#each data.page.breadcrumbs as breadcrumb}<li><PanelsLink href={breadcrumb.path}>{breadcrumb.label}</PanelsLink></li>{/each}</ol>
      </nav>
    {/if}
    <h1>{data.page.heading ?? data.page.title}</h1>
    {#if data.page.subheading}<p>{data.page.subheading}</p>{/if}
    {#if Body && body}
      <Body {...body.properties} />
    {:else if ['create', 'edit', 'list', 'view'].includes(data.page.manifest.pageType)}
      <ResourcePage {data} {effects} />
    {:else if data.page.schema}
      <section aria-label={data.page.title} data-panels-schema={data.page.manifest.schemaId}></section>
    {:else}
      <PanelsEmptyState heading={data.page.title} description="This page has no configured content." />
    {/if}
  </main>
  <SvelteNotificationToastViewport navigate={navigate} store={toastStore} />
</div>
