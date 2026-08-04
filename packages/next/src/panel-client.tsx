'use client'

import {
  ClientEffectSession,
  ClientNotificationInboxStore,
  ClientToastStore,
  createDefaultComponentRegistry,
  registerReactFieldRenderers,
  PanelShellStore,
  PanelsTransport,
  PROTOCOL_VERSION,
  ReactNotificationInboxTrigger,
  ReactTenantSwitcher,
  ReactToastViewport,
  createPanelNotificationTransport,
  type ClientNotificationRealtime,
  type ComponentRegistry,
  type JsonValue,
} from '@holo-js/panels-react'
import { lazy, Suspense, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import type { NextPanelClientProps } from './contracts'

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
  const toastStore = useMemo(() => new ClientToastStore(), [state.panelId])
  const effects = useMemo(() => new ClientEffectSession({
    panelId: state.panelId,
    redirect: effect => browserNavigate(effect.url),
    toastStore,
  }), [state.panelId, toastStore])
  useEffect(() => () => effects.dispose(), [effects])
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
        endpoint: `/_holo/panels/${state.panelId}/notification`,
        panelId: state.panelId,
      }),
    })
  }, [notificationConfiguration, notificationRealtime, state.notifications?.realtimeChannel, state.panelId])
  const notificationTrigger = notificationStore && notificationConfiguration
    ? <ReactNotificationInboxTrigger navigate={browserNavigate} panelId={state.panelId} placement={notificationConfiguration.placement} registry={registry} store={notificationStore} />
    : null
  const body = payload.page.manifest.body
  return <div className="hp-panel-shell" data-panel={state.panelId} data-theme={manifest.theme.darkMode}>
    <header><a href={manifest.path}>{manifest.branding.logo ? <img alt="" src={manifest.branding.logo} /> : null}{manifest.branding.name}</a>{tenantTransport ? <ReactTenantSwitcher onSwitched={() => globalThis.location.reload()} store={store} transport={tenantTransport} /> : null}{notificationConfiguration?.placement === 'topbar' ? notificationTrigger : null}</header>
    <nav aria-label="Panel navigation">{manifest.navigation.map(item => <a aria-current={item.id === state.activeNavigationId ? 'page' : undefined} href={item.path} key={item.id}>{item.label}{item.badge ? <span>{item.badge}</span> : null}</a>)}{notificationConfiguration?.placement === 'sidebar' ? notificationTrigger : null}</nav>
    <main>
      <header><h1>{payload.page.heading ?? payload.page.title}</h1>{payload.page.subheading ? <p>{payload.page.subheading}</p> : null}</header>
      {payload.page.breadcrumbs.length > 0 ? <nav aria-label="Breadcrumbs">{payload.page.breadcrumbs.map(item => <a href={item.path} key={item.path}>{item.label}</a>)}</nav> : null}
      <section data-page={payload.page.manifest.id}>{body?.component === 'resource-page'
        ? <Suspense fallback={<div aria-busy="true">Loading resource…</div>}><LazyResourcePage data={payload.page.data} effects={effects} panelId={state.panelId} panelPath={manifest.path} properties={body.properties} registry={registry} /></Suspense>
        : displayJson(payload.page.data)}</section>
    </main>
    <ReactToastViewport navigate={browserNavigate} store={toastStore} />
  </div>
}
