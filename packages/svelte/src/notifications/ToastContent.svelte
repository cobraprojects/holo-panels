<script lang="ts">
  import { createPanelTranslator, type ClientToast, type ClientToastStore } from '@holo-js/panels-client'
  import { panelColorValue } from '@holo-js/panels-ui'
  import X from 'lucide-svelte/icons/x'
  import { Button } from '../ui/button'
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
  import Icon from '../components/Icon.svelte'
  import { notificationActions, notificationUrl } from './helpers'
  import ActionRenderer from '../actions/ActionRenderer.svelte'
  import type { SvelteToastViewportProps } from './contracts'

  let { locale, navigate, panelId, registry, store, toast }: {
    readonly locale: string
    readonly panelId?: SvelteToastViewportProps['panelId']
    readonly registry?: SvelteToastViewportProps['registry']
    readonly navigate?: (url: string) => void
    readonly store: ClientToastStore
    readonly toast: ClientToast
  } = $props()
  const host = $derived(store.actionHost(toast.id))
  const translate = $derived(createPanelTranslator(locale))

  function ignoreFailure(operation: Promise<unknown>): void {
    void operation.catch(() => undefined)
  }
</script>

<Card class="hp-notification-toast hp:relative hp:w-full hp:border-0 hp:shadow-none" data-color={toast.color ?? undefined} data-persistent={toast.persistent || undefined} data-status={toast.status} style={`border-inline-start-color: ${panelColorValue(toast.color ?? toast.status)}; border-inline-start-style: solid; border-inline-start-width: 3px`}>
  <CardHeader class="hp:gap-1 hp:pr-10">
    <CardTitle class="hp:flex hp:items-center hp:gap-2 hp:text-sm">{#if toast.icon}<span data-slot="notification-icon" style:color={panelColorValue(toast.iconColor ?? toast.color ?? toast.status)}><Icon name={toast.icon} /></span>{/if}{toast.title}</CardTitle>
    {#if toast.body}<CardDescription>{toast.body}</CardDescription>{/if}
  </CardHeader>
  {#if notificationActions(toast.actions).length > 0}
    <CardContent class="hp:flex hp:flex-wrap hp:gap-2">
      {#each notificationActions(toast.actions) as action (action.id)}
        {@const url = notificationUrl(action)}
        {#if url}
          <Button href={url} size="sm" variant="outline" onclick={(event) => { ignoreFailure(store.trigger(toast.id, action.id)); if (navigate) { event.preventDefault(); navigate(url) } }}><Icon name="arrow-right" />{action.label}</Button>
        {:else}
          <Button size="sm" type="button" variant={action.kind === 'dismiss' ? 'destructive' : 'outline'} onclick={() => ignoreFailure(store.trigger(toast.id, action.id))}><Icon name={action.kind === 'mark-read' ? 'check' : action.kind === 'mark-unread' ? 'mail' : 'trash'} />{action.label}</Button>
        {/if}
      {/each}
    </CardContent>
  {/if}
  {#if toast.closeable}<Button aria-label={`${translate('actions.close')}: ${toast.title}`} class="hp:absolute hp:end-2 hp:top-2" size="icon-sm" type="button" variant="ghost" onclick={() => store.dismiss(toast.id)}><X /></Button>{/if}
  {#if host?.actions[0]}<CardContent><ActionRenderer action={host.actions[0]} actions={host.actions} direction={locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'} {locale} {panelId} {registry} store={host.store} /></CardContent>{/if}
</Card>
