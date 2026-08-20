<script lang="ts">
  import Button from '../components/Button.svelte'
  import { onMount, type Component } from 'svelte'
  import { toSvelteState } from '../stores'
  import type { SvelteCustomNotificationProps, SvelteNotificationControls, SvelteNotificationInboxProps } from './contracts'
  import { notificationActions, notificationUrl, svelteNotificationRendererName } from './helpers'

  let { emptyMessage = 'No notifications', navigate, panelId, placement = 'page', registry, store }: SvelteNotificationInboxProps = $props()
  const inboxState = $derived.by(() => toSvelteState(store))
  const pages = $derived(Math.max(1, Math.ceil($inboxState.total / $inboxState.pageSize)))

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

<section aria-busy={$inboxState.loading} aria-label="Notification inbox" class="hp-notification-inbox" data-placement={placement}>
  <header class="hp-notification-inbox-header" data-slot="notification-inbox-header">
    <h2 class="hp-notification-inbox-title" data-slot="notification-inbox-title">Notifications</h2>
    {#if $inboxState.unread > 0}<span aria-label={`${$inboxState.unread} unread`} class="hp-notification-inbox-count hp-notification-unread-badge" data-slot="notification-inbox-count">{$inboxState.unread}</span>{/if}
    <Button class="hp-notification-mark-all" disabled={$inboxState.unread === 0} type="button" onclick={() => ignoreFailure(store.markAllRead())}>Mark all read</Button>
  </header>
  {#if $inboxState.error}<p class="hp-notification-error" data-slot="notification-error" role="alert">{$inboxState.error}</p>{/if}
  {#if $inboxState.loading}<p aria-live="polite" class="hp-notification-loading" data-slot="notification-loading" role="status">Loading notifications</p>{/if}
  {#if !$inboxState.loading && $inboxState.items.length === 0}<p class="hp-notification-empty" data-slot="notification-empty" role="status">{emptyMessage}</p>{/if}
  {#if $inboxState.items.length > 0}<ol class="hp-notification-list" data-slot="notification-list">
    {#each $inboxState.items as item (item.id)}
      {@const itemControls = controls(item.id)}
      {@const Custom = custom(item.type, item.id)}
      <li class="hp-notification-item" data-color={item.presentation.color ?? undefined} data-notification={item.id} data-read={item.read} data-slot="notification-item">
        {#if Custom}
          <Custom controls={itemControls} notification={item} />
        {:else}
          <article aria-labelledby={`${item.id}-notification-title`} class="hp-notification-item-content" data-slot="notification-item-content">
            {#if item.presentation.icon}<span aria-hidden="true" class="hp-notification-item-icon" data-icon={item.presentation.icon} data-slot="notification-item-icon"></span>{/if}
            <div class="hp-notification-item-copy">
              <h3 class="hp-notification-item-title" data-slot="notification-item-title" id={`${item.id}-notification-title`}>{item.presentation.title}</h3>
              {#if item.presentation.body}<p class="hp-notification-item-body" data-slot="notification-item-body">{item.presentation.body}</p>{/if}
              <time class="hp-notification-item-time" data-slot="notification-item-time" datetime={item.createdAt}>{item.createdAt}</time>
            </div>
            <div aria-label={`${item.presentation.title} actions`} class="hp-notification-actions" data-slot="notification-actions" role="group">
              {#each notificationActions(item.presentation.actions) as action (action.id)}
                {@const url = notificationUrl(action)}
                {#if url}<a href={url} onclick={(event) => { if (navigate) { event.preventDefault(); navigate(url) } }}>{action.label}</a>
                {:else if action.kind === 'mark-read'}<Button type="button" onclick={() => ignoreFailure(itemControls.markRead())}>{action.label}</Button>
                {:else if action.kind === 'mark-unread'}<Button type="button" onclick={() => ignoreFailure(itemControls.markUnread())}>{action.label}</Button>
                {:else}<Button type="button" onclick={() => ignoreFailure(itemControls.delete())}>{action.label}</Button>{/if}
              {/each}
              {#if item.read}<Button type="button" onclick={() => ignoreFailure(itemControls.markUnread())}>Mark unread</Button>{:else}<Button type="button" onclick={() => ignoreFailure(itemControls.markRead())}>Mark read</Button>{/if}
              <Button type="button" onclick={() => ignoreFailure(itemControls.delete())}>Delete</Button>
            </div>
          </article>
        {/if}
      </li>
    {/each}
  </ol>{/if}
  {#if pages > 1}<nav aria-label="Notification pagination" class="hp-notification-pagination" data-slot="notification-pagination">
    <Button aria-label="Previous notification page" disabled={$inboxState.page <= 1} type="button" onclick={() => ignoreFailure(store.load($inboxState.page - 1))}>Previous</Button>
    <span>Page {$inboxState.page} of {pages}</span>
    <Button aria-label="Next notification page" disabled={$inboxState.page >= pages} type="button" onclick={() => ignoreFailure(store.load($inboxState.page + 1))}>Next</Button>
  </nav>{/if}
</section>
