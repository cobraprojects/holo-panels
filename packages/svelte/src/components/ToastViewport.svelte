<script lang="ts">
  interface Toast { id: string; message: string; tone?: 'danger' | 'info' | 'success' | 'warning' }
  interface Props { toasts?: readonly Toast[] }
  let { toasts = [] }: Props = $props()
</script>

<div aria-label="Notifications" class="hp-toast-viewport" data-panels-component="toast-viewport" data-slot="toast-viewport" role="region">
  {#each toasts as toast (toast.id)}<div aria-atomic="true" class="hp-toast hp-tone-{toast.tone ?? 'info'}" data-slot="toast" data-variant={toast.tone ?? 'info'} role={toast.tone === 'danger' ? 'alert' : 'status'}>{toast.message}</div>{/each}
</div>
