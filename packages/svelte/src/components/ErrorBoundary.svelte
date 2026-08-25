<script lang="ts">
  import type { Snippet } from 'svelte'
  import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
  import { Button } from '../ui/button'
  interface Props { children?: Snippet; error?: string; fallback?: string; onerror?: (error: unknown) => void }
  let { children, error, fallback = 'This panel could not be rendered.', onerror }: Props = $props()
</script>

{#snippet failed(error: unknown, reset: () => void)}
  <Alert class="hp-error-boundary" data-panels-component="error-boundary" variant="destructive"><AlertTitle>Something went wrong</AlertTitle><AlertDescription>{fallback}</AlertDescription><Button onclick={reset} type="button" variant="outline">Try again</Button></Alert>
{/snippet}

{#if error}
  <Alert class="hp-error-boundary" data-panels-component="error-boundary" variant="destructive"><AlertTitle>Something went wrong</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
{:else}
  <svelte:boundary {failed} {onerror}>{@render children?.()}</svelte:boundary>
{/if}
