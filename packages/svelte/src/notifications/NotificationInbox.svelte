<script lang="ts">
  import { onMount, type Component } from 'svelte'
  import { panelColorValue } from '@holo-js/panels-ui'
  import Icon from '../components/Icon.svelte'
  import ChevronLeft from 'lucide-svelte/icons/chevron-left'
  import ChevronRight from 'lucide-svelte/icons/chevron-right'
  import Check from 'lucide-svelte/icons/check'
  import CheckCheck from 'lucide-svelte/icons/check-check'
  import Mail from 'lucide-svelte/icons/mail'
  import Trash from 'lucide-svelte/icons/trash'
  import * as AlertDialog from '../ui/alert-dialog'
  import { Alert, AlertDescription } from '../ui/alert'
  import { Badge } from '../ui/badge'
  import { Button } from '../ui/button'
  import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
  import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../ui/empty'
  import { PaginationContent, PaginationItem } from '../ui/pagination'
  import { Separator } from '../ui/separator'
  import { toSvelteState } from '../stores'
  import ActionRenderer from '../actions/ActionRenderer.svelte'
  import type { SvelteCustomNotificationProps, SvelteDatabaseNotification, SvelteNotificationControls, SvelteNotificationInboxProps } from './contracts'
  import { notificationActions, notificationUrl, svelteNotificationRendererName } from './helpers'
  import { createPanelTranslator } from '@holo-js/panels-client'

  let { emptyMessage = 'No notifications', locale = 'en', navigate, panelId, placement = 'page', registry, store }: SvelteNotificationInboxProps = $props()
  const translate = $derived(createPanelTranslator(typeof locale === 'string' ? locale : 'en'))
  const inboxState = $derived.by(() => toSvelteState(store))
  const pages = $derived(Math.max(1, Math.ceil($inboxState.total / $inboxState.pageSize)))
  let deleting = $state<SvelteDatabaseNotification | null>(null)

  function controls(id: string): SvelteNotificationControls {
    return { delete: () => store.delete([id]), markRead: () => store.markRead([id]), markUnread: () => store.markUnread([id]) }
  }

  function custom(type: string, id: string): Component<SvelteCustomNotificationProps> | undefined {
    const rendererName = svelteNotificationRendererName(type)
    return registry?.hasRenderer(rendererName, panelId) ? registry.resolve<SvelteCustomNotificationProps>(rendererName, panelId, `notification "${id}"`) : undefined
  }

  function ignoreFailure(operation: Promise<unknown>): void {
    void operation.catch(() => undefined)
  }

  onMount(() => {
    ignoreFailure(store.start())
    return () => store.dispose()
  })
</script>

<Card aria-busy={$inboxState.loading} aria-label={translate('notifications.inbox')} class="hp-notification-inbox hp:w-full {placement === 'page' ? '' : 'hp:rounded-none hp:border-0 hp:shadow-none'}" data-placement={placement}>
  <CardHeader class="hp-notification-inbox-header hp:flex-row hp:items-center hp:gap-3 hp:space-y-0">
    <CardTitle class="hp:flex-1" data-slot="notification-inbox-title">{translate('notifications.label')}</CardTitle>
    {#if $inboxState.unread > 0}<Badge aria-label={translate('notifications.unreadCount', { count: $inboxState.unread })} class="hp-notification-inbox-count" variant="secondary">{$inboxState.unread}</Badge>{/if}
    <Button disabled={$inboxState.unread === 0} size="sm" type="button" variant="outline" onclick={() => ignoreFailure(store.markAllRead())}><CheckCheck />{translate('notifications.markAllRead')}</Button>
  </CardHeader>
  <CardContent class="hp:space-y-4 {placement === 'page' ? '' : 'hp:max-h-[min(36rem,calc(100vh-8rem))] hp:overflow-y-auto'}">
    {#if $inboxState.error}<Alert variant="destructive" data-slot="notification-error"><AlertDescription>{$inboxState.error}</AlertDescription></Alert>{/if}
    {#if $inboxState.loading}<p aria-live="polite" class="hp:text-sm hp:text-muted-foreground" data-slot="notification-loading" role="status">{translate('notifications.loading')}</p>{/if}
    {#if !$inboxState.loading && !$inboxState.error && $inboxState.items.length === 0}<Empty data-slot="notification-empty"><EmptyHeader><EmptyTitle>{emptyMessage}</EmptyTitle><EmptyDescription>{translate('notifications.noneDescription')}</EmptyDescription></EmptyHeader></Empty>{/if}
    {#if $inboxState.items.length > 0}<ol class="hp-notification-list hp:divide-y" data-slot="notification-list">
      {#each $inboxState.items as item (item.id)}
        {@const itemControls = controls(item.id)}
        {@const actionHost = store.actionHost(item.id)}
        {@const Custom = custom(item.type, item.id)}
        <li class="hp-notification-item hp:py-4 hp:ps-3 hp:first:pt-0 hp:last:pb-0" data-color={item.presentation.color ?? undefined} data-notification={item.id} data-read={item.read} data-slot="notification-item" style:border-inline-start-color={panelColorValue(item.presentation.color ?? item.presentation.status)} style:border-inline-start-style="solid" style:border-inline-start-width="3px">
          {#if Custom}
            <Custom controls={itemControls} notification={item} />
          {:else}
            <article aria-labelledby={`${item.id}-notification-title`} class="hp:space-y-3" data-slot="notification-item-content">
              <div class="hp:flex hp:items-start hp:gap-3">
                {#if item.presentation.icon}<span class="hp:mt-0.5" data-slot="notification-icon" style:color={panelColorValue(item.presentation.iconColor ?? item.presentation.color ?? item.presentation.status)}><Icon name={item.presentation.icon} /></span>{/if}
                <div class="hp:min-w-0 hp:flex-1 hp:space-y-1">
                  <h3 class="hp:text-sm hp:font-medium" id={`${item.id}-notification-title`}>{item.presentation.title}</h3>
                  {#if item.presentation.body}<p class="hp:text-sm hp:text-muted-foreground">{item.presentation.body}</p>{/if}
                  <time class="hp-notification-item-time hp:text-xs hp:text-muted-foreground" datetime={item.createdAt}>{item.createdAt}</time>
                </div>
                {#if !item.read}<Badge variant="secondary">{translate('notifications.unread')}</Badge>{/if}
              </div>
              <div aria-label={`${item.presentation.title} actions`} class="hp-notification-actions hp:flex hp:flex-wrap hp:gap-2" role="group">
                {#if actionHost?.actions[0]}<ActionRenderer action={actionHost.actions[0]} actions={actionHost.actions} direction={locale.toLowerCase().startsWith('ar') ? 'rtl' : 'ltr'} {locale} {panelId} {registry} store={actionHost.store} />{/if}
                {#each notificationActions(item.presentation.actions) as action (action.id)}
                  {@const url = notificationUrl(action)}
                  {#if url}<Button href={url} size="sm" variant="outline" onclick={(event) => { if (navigate) { event.preventDefault(); navigate(url) } }}>{action.label}</Button>
                  {:else if action.kind === 'mark-read'}<Button size="sm" type="button" variant="outline" onclick={() => ignoreFailure(itemControls.markRead())}><Check />{action.label}</Button>
                  {:else if action.kind === 'mark-unread'}<Button size="sm" type="button" variant="outline" onclick={() => ignoreFailure(itemControls.markUnread())}><Mail />{action.label}</Button>
                  {:else}<Button size="sm" type="button" variant="destructive" onclick={() => { deleting = item }}><Trash />{action.label}</Button>{/if}
                {/each}
                {#if item.read}<Button size="sm" type="button" variant="outline" onclick={() => ignoreFailure(itemControls.markUnread())}><Mail />{translate('notifications.markUnread')}</Button>{:else}<Button size="sm" type="button" variant="outline" onclick={() => ignoreFailure(itemControls.markRead())}><Check />{translate('notifications.markRead')}</Button>{/if}
                {#if !notificationActions(item.presentation.actions).some(action => action.kind === 'dismiss')}<Button size="sm" type="button" variant="destructive" onclick={() => { deleting = item }}><Trash />{translate('notifications.confirmDelete')}</Button>{/if}
              </div>
            </article>
          {/if}
        </li>
      {/each}
    </ol>{/if}
    {#if pages > 1}<Separator /><nav aria-label="Notification pagination" class="hp-notification-pagination"><PaginationContent>
      <PaginationItem><Button aria-label="Previous notification page" disabled={$inboxState.page <= 1} size="sm" type="button" variant="outline" onclick={() => ignoreFailure(store.load($inboxState.page - 1))}><ChevronLeft />Previous</Button></PaginationItem>
      <PaginationItem><span class="hp:px-2 hp:text-sm hp:text-muted-foreground">{translate('notifications.page', { page: $inboxState.page, pages })}</span></PaginationItem>
      <PaginationItem><Button aria-label="Next notification page" disabled={$inboxState.page >= pages} size="sm" type="button" variant="outline" onclick={() => ignoreFailure(store.load($inboxState.page + 1))}>Next<ChevronRight /></Button></PaginationItem>
    </PaginationContent></nav>{/if}
  </CardContent>
</Card>

<AlertDialog.Root open={deleting !== null} onOpenChange={(open) => { if (!open) deleting = null }}>
  <AlertDialog.Content data-holo-panel>
    <AlertDialog.Header><AlertDialog.Title>{translate('notifications.deleteTitle')}</AlertDialog.Title><AlertDialog.Description>{translate('notifications.deleteDescription')}</AlertDialog.Description></AlertDialog.Header>
    <AlertDialog.Footer><AlertDialog.Cancel>{translate('notifications.cancelDelete')}</AlertDialog.Cancel><AlertDialog.Action variant="destructive" onclick={() => { if (deleting) ignoreFailure(store.delete([deleting.id])); deleting = null }}><Trash />{translate('notifications.confirmDelete')}</AlertDialog.Action></AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
