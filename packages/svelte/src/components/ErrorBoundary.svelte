<script lang="ts">
  import type { Snippet } from 'svelte'
  import Button from './Button.svelte'
  interface Props { children?: Snippet; error?: string; fallback?: string; onerror?: (error: unknown) => void }
  let { children, error, fallback = 'This panel could not be rendered.', onerror }: Props = $props()
</script>

{#snippet failed(error: unknown, reset: () => void)}
  <section class="hp-error-boundary" data-panels-component="error-boundary" role="alert"><p>{fallback}</p><Button onclick={reset} type="button">Try again</Button></section>
{/snippet}

{#if error}
  <section class="hp-error-boundary" data-panels-component="error-boundary" role="alert"><p>{error}</p></section>
{:else}
  <svelte:boundary {failed} {onerror}>{@render children?.()}</svelte:boundary>
{/if}
