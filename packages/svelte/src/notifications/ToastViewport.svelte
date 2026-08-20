<script lang="ts">
  import Button from '../components/Button.svelte'
  import { toSvelteState } from '../stores'
  import type { SvelteToastViewportProps } from './contracts'
  import { notificationActions, notificationUrl } from './helpers'

  let { navigate, placement = 'top', store }: SvelteToastViewportProps = $props()
  const toastState = $derived.by(() => toSvelteState(store))

  function ignoreFailure(operation: Promise<unknown>): void {
    void operation.catch(() => undefined)
  }
</script>

<section aria-label="Notifications" class="hp-notification-toasts" data-placement={placement}>
  <div aria-atomic="true" aria-live="polite" class="hp-visually-hidden" role="status">{$toastState.liveMessage}</div>
  <ol aria-label="Notification queue" class="hp-notification-toast-list" data-slot="notification-toast-list">
    {#each $toastState.items as toast (toast.id)}
      <li data-color={toast.color ?? undefined} data-persistent={toast.persistent || undefined} data-status={toast.status}>
        <article aria-labelledby={`${toast.id}-toast-title`} class="hp-notification-toast" data-slot="notification-toast">
          <span aria-hidden="true" class="hp-notification-toast-accent" data-color={toast.color ?? undefined} data-slot="notification-toast-accent"></span>
          {#if toast.icon}<span aria-hidden="true" class="hp-notification-toast-icon" data-icon={toast.icon} data-slot="notification-toast-icon"></span>{/if}
          <div class="hp-notification-toast-content" data-slot="notification-toast-content">
            <h2 class="hp-notification-toast-title" id={`${toast.id}-toast-title`}>{toast.title}</h2>
            {#if toast.body}<p class="hp-notification-toast-body">{toast.body}</p>{/if}
          </div>
          <div aria-label={`${toast.title} actions`} class="hp-notification-toast-actions" data-slot="notification-toast-actions" role="group">
            {#each notificationActions(toast.actions) as action (action.id)}
              {@const url = notificationUrl(action)}
              {#if url}<a href={url} onclick={(event) => { ignoreFailure(store.trigger(toast.id, action.id)); if (navigate) { event.preventDefault(); navigate(url) } }}>{action.label}</a>{:else}<Button type="button" onclick={() => ignoreFailure(store.trigger(toast.id, action.id))}>{action.label}</Button>{/if}
            {/each}
          </div>
          {#if toast.closeable}<Button aria-label={`Close ${toast.title}`} class="hp-notification-toast-close" type="button" onclick={() => store.dismiss(toast.id)}>×</Button>{/if}
        </article>
      </li>
    {/each}
  </ol>
</section>
