<script lang="ts">
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
  <ol aria-label="Notification queue">
    {#each $toastState.items as toast (toast.id)}
      <li data-color={toast.color ?? undefined} data-persistent={toast.persistent || undefined} data-status={toast.status}>
        <article aria-labelledby={`${toast.id}-toast-title`}>
          {#if toast.icon}<span aria-hidden="true" data-icon={toast.icon}></span>{/if}
          <h2 id={`${toast.id}-toast-title`}>{toast.title}</h2>
          {#if toast.body}<p>{toast.body}</p>{/if}
          <div>
            {#each notificationActions(toast.actions) as action (action.id)}
              {@const url = notificationUrl(action)}
              {#if url}<a href={url} onclick={(event) => { ignoreFailure(store.trigger(toast.id, action.id)); if (navigate) { event.preventDefault(); navigate(url) } }}>{action.label}</a>{:else}<button type="button" onclick={() => ignoreFailure(store.trigger(toast.id, action.id))}>{action.label}</button>{/if}
            {/each}
          </div>
          {#if toast.closeable}<button aria-label={`Close ${toast.title}`} type="button" onclick={() => store.dismiss(toast.id)}>×</button>{/if}
        </article>
      </li>
    {/each}
  </ol>
</section>
