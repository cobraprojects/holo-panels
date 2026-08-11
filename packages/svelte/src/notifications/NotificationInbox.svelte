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
  <header><h2>Notifications</h2><span aria-label={`${$inboxState.unread} unread`}>{$inboxState.unread}</span><Button disabled={$inboxState.unread === 0} type="button" onclick={() => ignoreFailure(store.markAllRead())}>Mark all read</Button></header>
  {#if $inboxState.error}<p role="alert">{$inboxState.error}</p>{/if}
  {#if $inboxState.loading}<p aria-live="polite" role="status">Loading notifications</p>{/if}
  {#if !$inboxState.loading && $inboxState.items.length === 0}<p>{emptyMessage}</p>{/if}
  <ol>
    {#each $inboxState.items as item (item.id)}
      {@const itemControls = controls(item.id)}
      {@const Custom = custom(item.type, item.id)}
      <li data-color={item.presentation.color ?? undefined} data-notification={item.id} data-read={item.read}>
        {#if Custom}
          <Custom controls={itemControls} notification={item} />
        {:else}
          <article aria-labelledby={`${item.id}-notification-title`}>
            {#if item.presentation.icon}<span aria-hidden="true" data-icon={item.presentation.icon}></span>{/if}
            <h3 id={`${item.id}-notification-title`}>{item.presentation.title}</h3>
            {#if item.presentation.body}<p>{item.presentation.body}</p>{/if}
            <time datetime={item.createdAt}>{item.createdAt}</time>
            <div class="hp-notification-actions">
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
  </ol>
  <nav aria-label="Notification pagination">
    <Button aria-label="Previous notification page" disabled={$inboxState.page <= 1} type="button" onclick={() => ignoreFailure(store.load($inboxState.page - 1))}>Previous</Button>
    <span>Page {$inboxState.page} of {pages}</span>
    <Button aria-label="Next notification page" disabled={$inboxState.page >= pages} type="button" onclick={() => ignoreFailure(store.load($inboxState.page + 1))}>Next</Button>
  </nav>
</section>
